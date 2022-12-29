import EventEmitter from "events";
import { BaseCommand, BaseCommands, QueueCommand } from "./constants.js";
import { ProxyLogic } from "./proxyUtil/proxyLogic.js";
import { ProxyServer } from "./proxyUtil/proxyServer.js";
import fs from "fs";
import { Bot } from "mineflayer";
import path from "path";

import { NewPingResult, ping } from "minecraft-protocol";
import { debug } from "debug";

function isBaseCommand(command: string): command is BaseCommand {
  return BaseCommands.includes(command as any);
}

export class QueueHandler extends ProxyLogic {
  public get queuePos() {
    return this.proxy?.stateData?.bot?.queueSpeed?.currentPosition ?? 0
  }

  public async handleCommand(
    command: QueueCommand | BaseCommand,
    ...args: any[]
  ) {
    if (isBaseCommand(command)) {
      return super.handleCommand(command, ...args);
    }

    switch (command) {
    }
  }

  public override start() {
    super.start();
    this.proxy.stateData.bot.loadPlugin(inject);
    return true;
  }
}

const WriteQueueStats = false;

declare module "mineflayer" {
  interface Bot {
    queueSpeed: QueueSpeed;
  }

  interface BotEvents {
    "queueSpeed:queueEnd": (queueResult: QueueResult | null) => void;
    "queueSpeed:queueStart": (pos: number) => void;
    "queueSpeed:position": (pos: number) => void;
  }
}

interface QueueResult {
  queueStartTime: number;
  startingPosition: number;
  minutesInQueue: number;
  averagePositionsPerMinute: number;
  averageMinutesPerPosition: number;
}

interface QueueSpeed {
  startTime: Date | null;
  endTime: Date | null;
  currentPosition: number | null;
  lastPosition: number | null;
  positionHistory: {
    time: Date;
    position: number;
    currentQueueLength: number;
  }[];
  outFolder: string;
  sawQueuePosition: boolean;
  _incrementalVersion: number;
  inQueue: boolean;
}

const log = debug("queueSpeed");

let lastQueueLookup = new Date();
let lastQueueLength: {
  main: { normal: number; priority: number };
  test: { normal: number; priority: number };
} | null = null;

async function getQueueLengths(): Promise<{
  main: { normal: number; priority: number };
  test: { normal: number; priority: number };
} | null> {
  function parseQueueLength(motd: any): {
    main: { normal: number; priority: number };
    test: { normal: number; priority: number };
  } {
    const returnValue: {
      main: { normal: number; priority: number };
      test: { normal: number; priority: number };
    } = {} as any;
    for (const server of motd?.players?.sample ?? []) {
      const serverName = server.name.split(":")[0].replace(/§./g, "");
      const matches = server.name.match(/normal: (\d+), priority: (\d+)/);
      if (!matches) throw new Error("Could not parse queue length");
      const normal = parseInt(matches[1]);
      const priority = parseInt(matches[2]);
      if (isNaN(normal) || isNaN(priority))
        throw new Error("Could not parse queue length got " + server.name);
      if (!["main", "test"].includes(serverName))
        throw new Error("Invalid server name " + serverName);
      // @ts-ignore
      returnValue[serverName] = {
        normal,
        priority,
      };
    }
    return returnValue;
  }

  const now = new Date();
  if (lastQueueLength && now.getTime() - lastQueueLookup.getTime() < 2000) {
    return lastQueueLength;
  }

  // console.info('Queue length lookup')
  lastQueueLength = null;
  const r = (await ping({
    host: "connect.2b2t.org",
    version: "1.12.2",
  })) as NewPingResult;
  if (!r.players) {
    return null;
  }
  const parsedData = parseQueueLength(r);
  // Cache results
  lastQueueLookup = new Date();
  lastQueueLength = parsedData;
  return parsedData;
}

function inject(bot: Bot, options = {}) {
  bot.queueSpeed = {} as any;
  bot.queueSpeed.startTime = null;
  bot.queueSpeed.endTime = null;
  bot.queueSpeed.inQueue = false;
  bot.queueSpeed.currentPosition = null;
  bot.queueSpeed.lastPosition = null;
  bot.queueSpeed.positionHistory = [];
  bot.queueSpeed.outFolder = "./queue-speed";
  bot.queueSpeed.sawQueuePosition = false;

  const onceInitialLogin = () => {
    bot.queueSpeed.sawQueuePosition = false;
    bot.once("login", onceSecondaryLogin);
  };

  const onceSecondaryLogin = () => {
    const sumResult = summarize();
    bot.emit("queueSpeed:queueEnd", sumResult);
    bot.queueSpeed.endTime = new Date();
    resetQueueTracker();
  };

  bot.once("login", onceInitialLogin);
  bot.on("message", (chatMessage) => {
    const chatString = chatMessage.toString();
    const strings = chatString.split("\n");
    for (const string of strings) {
      if (string.replace(/\n/g, "").trim() === "") continue;
      log("Parsing message: " + string);
      try {
        if (string.startsWith("Connecting to the server...")) {
          const sumResult = summarize();
          bot.emit("queueSpeed:queueEnd", sumResult);
          bot.queueSpeed.endTime = new Date();
          resetQueueTracker();
        } else if (string.startsWith("You can purchase priority queue")) {
          return;
        } else if (string.startsWith("Position in queue")) {
          const pos = parseMessageToPosition(string);
          if (pos === null) {
            log("Parsing message failed got null");
            return;
          }
          bot.queueSpeed.lastPosition = bot.queueSpeed.currentPosition;
          if (bot.queueSpeed.lastPosition) {
            if (bot.queueSpeed.lastPosition < pos) {
              // We are moving backwoods in the queue (? why hause why???)
              bot.queueSpeed.endTime = null;
              bot.queueSpeed.startTime = new Date();
              console.info(
                "[Queue speed] Position moved backwards, resetting start time"
              );
              if (bot.queueSpeed.positionHistory.length > 0) {
                // summarize()
                bot.queueSpeed.positionHistory = [];
              }
            } else if (bot.queueSpeed.lastPosition > pos) {
              // We are moving forwards in the queue
              // console.info('Getting queue length', bot.queueSpeed.lastPosition, pos)
              const now = new Date();
              getQueueLengths()
                .then((queueLengths) => {
                  bot.queueSpeed.positionHistory.push({
                    time: now,
                    position: pos,
                    currentQueueLength: queueLengths?.main?.normal ?? 0,
                  });
                })
                .catch(console.error);
            }
          } else if (!bot.queueSpeed.sawQueuePosition) {
            bot.queueSpeed.sawQueuePosition = true;
            bot.queueSpeed.startTime = new Date();
            console.info(
              "[Queue speed] Detected queue. Starting to record queue speed"
            );
            bot.emit("queueSpeed:queueStart", pos);
          }
          // console.info('Last position', bot.queueSpeed.lastPosition, pos)
          if (bot.queueSpeed.currentPosition !== pos) {
            bot.queueSpeed.currentPosition = pos;
            log("Emit position: " + pos);
            bot.emit("queueSpeed:position", pos);
          }
        }
      } catch (err) {}
    }
  });

  function resetQueueTracker() {
    bot.queueSpeed.sawQueuePosition = false;
    bot.queueSpeed.positionHistory = [];
    bot.queueSpeed.currentPosition = null;
    bot.queueSpeed.inQueue = false;
    bot.queueSpeed.startTime = null;
    bot.queueSpeed.endTime = null;
    bot.removeListener("login", onceSecondaryLogin);
    bot.once("login", onceSecondaryLogin);
  }

  async function writeQueueHistoryToFile() {
    if (!WriteQueueStats) return;
    if (bot.queueSpeed.positionHistory.length === 0) return;
    const now = Date.now();
    const dataPrefix = process.env.DATA_PREFIX
      ? `${process.env.DATA_PREFIX}\n`
      : "";
    let str = `${dataPrefix}time,position,currentQueueLength\n`;
    for (const entry of bot.queueSpeed.positionHistory) {
      str += `${entry.time.getTime()},${entry.position},${
        entry.currentQueueLength
      }\n`;
    }
    await fs.promises.mkdir(bot.queueSpeed.outFolder, { recursive: true });
    await fs.promises.writeFile(
      path.join(bot.queueSpeed.outFolder, `${now}.csv`),
      str,
      "utf-8"
    );
    return;
  }

  function millisecondsToStringTime(mili: number) {
    const date = new Date(mili);
    return `${date.getDate() - 1}d ${
      date.getHours() - 1
    }h ${date.getMinutes()}min ${date.getSeconds()}sec`;
  }

  function summarize() {
    writeQueueHistoryToFile().catch(console.error);
    const startingPosition = bot.queueSpeed.positionHistory[0];
    if (!startingPosition) {
      console.info("[Queue speed] No starting position");
      return null;
    }
    const queueStartTime = startingPosition.time;
    const now = new Date();
    const timeDelta = now.getTime() - startingPosition.time.getTime();
    const averagePositionsPerMinute =
      startingPosition.position / (timeDelta / 1000 / 60);
    const averageMinutesPerPosition =
      timeDelta / 1000 / 60 / startingPosition.position;
    console.info(`[Qeueue speed Summary]
Started recording at: ${queueStartTime}
Starting position: ${startingPosition.position}
End time: ${now}
Total time: ${millisecondsToStringTime(timeDelta)}
Average positions per minute: ${averagePositionsPerMinute} (${
      startingPosition.position / (timeDelta / 1000)
    } [per seconds])
Average minutes per position: ${averageMinutesPerPosition} (${
      timeDelta / 1000 / startingPosition.position
    } [seconds per position])`);
    return {
      queueStartTime: startingPosition.time.getTime(),
      startingPosition: startingPosition.position,
      minutesInQueue: Math.floor(timeDelta / (1000 * 60)),
      averagePositionsPerMinute,
      averageMinutesPerPosition,
    };
  }
}

function parseMessageToPosition(message: string) {
  if (!message.includes("Position in queue:")) {
    log("No position in message", message);
    return null;
  }
  const match = message.match(/(\d+)/);
  if (!match) {
    console.warn("Could not find position in message", message);
    return null;
  }
  const num = Number(match[0]);
  if (isNaN(num)) {
    console.warn("Parsing match failed", match[0]);
    return null;
  }
  return num;
}
