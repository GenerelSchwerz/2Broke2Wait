import mc from "minecraft-protocol";

import EventEmitter from "events";
import path from "path";
import fs from "fs";

import type { Bot, BotOptions } from "mineflayer";
import {
  IQueuePluginOpts,
  PositionHistory,
  QueueLength,
  QueueResult,
} from "./index.js";
import { getWaitTime } from "./queuePredictor.js";

class QueueLookup {
  private lastQueueLookup: Date;
  private lastQueueLength: QueueLength | null = null;

  public constructor() {
    this.lastQueueLookup = new Date();
  }

  public async getQueueLength(): Promise<QueueLength | null> {
    const now = new Date();

    if (
      this.lastQueueLength &&
      now.getTime() - this.lastQueueLookup.getTime() < 2000
    ) {
      return this.lastQueueLength;
    }

    this.lastQueueLength = null;

    try {
      const r = (await mc.ping({
        host: "connect.2b2t.org",
        version: "1.12.2",
      })) as mc.NewPingResult;
      const parsedData = QueueLookup.parseQueueLength(r);
      this.lastQueueLookup = new Date();
      this.lastQueueLength = parsedData;
      return parsedData;
    } catch (e) {
      this.lastQueueLookup = new Date();
      this.lastQueueLength = null;
      return null;
    }
  }

  private static parseQueueLength(motd: mc.NewPingResult): QueueLength | null {
    if (!motd) return null;

    const returnValue = {};
    for (const server of motd.players.sample) {
      const serverName = server.name.split(":")[0].replace(/§./g, "");
      const matches = server.name.match(/normal: (\d+), priority: (\d+)/);

      if (!matches) throw new Error("Could not parse queue length");

      const normal = parseInt(matches[1]);
      const priority = parseInt(matches[2]);

      if (isNaN(normal) || isNaN(priority)) {
        throw new Error("Could not parse queue length got " + server.name);
      }

      if (!["main", "test"].includes(serverName)) {
        throw new Error("Invalid server name " + serverName);
      }

      returnValue[serverName] = {
        normal,
        priority,
      };
    }
    return returnValue as QueueLength;
  }
}

export class QueuePlugin extends EventEmitter implements IQueuePluginOpts {
  startTime: Date | null = null;
  endTime: Date | null = null;
  inQueue: boolean = false;
  currentPosition: number = NaN;
  lastPosition: number = NaN;
  positionHistory: PositionHistory[] = [];
  sawQueuePosition: boolean = false;

  queueLookup: QueueLookup;

  constructor(private bot: Bot, opts: Partial<IQueuePluginOpts> = {}) {
    super();
    Object.assign(this, opts);
    this.queueLookup = new QueueLookup();

    bot.once("login", this.onceInitialLogin);
    bot.on("message", this.chatHandler);
  }

  /**
   * TODO: make cleaner
   * @param bot
   * @param options
   */
  public static makeInjection(opts: Partial<IQueuePluginOpts> = {}) {
    return (bot: Bot, options: BotOptions) => {
      bot.queuePlugin = new QueuePlugin(bot, opts);
    };
  }

  private onceInitialLogin = () => {
    this.sawQueuePosition = false;
    this.bot.once("login", this.onceSecondaryLogin);
  };

  private onceSecondaryLogin = () => {
    const sumResult = this.summarize();
    this.emit("queueEnd", sumResult);
    this.endTime = new Date();
    this.resetQueueTracker();
  };

  private chatHandler = async (chatMessage) => {
    const chatString: string = chatMessage.toString();
    const strings = chatString.split("\n");
    for (const string of strings) {
      if (string.replace(/\n/g, "").trim() === "") continue;
      // log("Parsing message: " + string);

      const beginning = string.split(" ")[0];
      switch (beginning) {
        case "Connecting":
          const sumResult = this.summarize();
          this.endTime = new Date();
          this.resetQueueTracker();
          this.emit("queueEnd", sumResult);
          break;

        case "Position":
          const pos = parseMessageToPosition(string);
          if (pos === null) {
            // log("Parsing message failed got null");
            return;
          }
          this.lastPosition = this.currentPosition;
          if (this.lastPosition) {
            if (this.lastPosition < pos) {
              // We are moving backwoods in the queue (? why hause why???)
              console.info(
                "[Queue speed] Position moved backwards, resetting start time"
              );
              this.endTime = null;
              this.startTime = new Date();
              if (this.positionHistory.length > 0) {
                this.positionHistory = [];
              }
            } else if (this.lastPosition > pos) {
              // We are moving forwards in the queue
              console.info("Getting queue length", this.lastPosition, pos);
              const now = new Date();
              try {
                const queueLengths = await this.queueLookup.getQueueLength();
                this.positionHistory.push({
                  time: now,
                  position: pos,
                  currentQueueLength: queueLengths.main.normal ?? 0,
                });
              } catch (e) {
                console.error(e);
              }
            }
          } else if (!this.sawQueuePosition) {
            this.sawQueuePosition = true;
            this.startTime = new Date();
            console.info(
              "[Queue speed] Detected queue. Starting to record queue speed"
            );
            this.emit("queueStart", pos);
          }
          // console.info('Last position', this.lastPosition, pos)
          if (this.currentPosition !== pos) {
            this.currentPosition = pos;
            // log("Emit position: " + pos);
            this.emit("position", pos);
          }
          break;

        case "You": // unimportant
        default:
          return;
      }
    }
  };

  public resetQueueTracker() {
    this.sawQueuePosition = false;
    this.positionHistory = [];
    this.currentPosition = NaN;
    this.inQueue = false;
    this.startTime = null;
    this.endTime = null;
    this.bot.removeListener("login", this.onceSecondaryLogin);
    this.bot.once("login", this.onceSecondaryLogin);
  }

  public async writeQueueHistoryToFile(dirname: string) {
    if (this.positionHistory.length === 0) return;
    const now = Date.now();
    const dataPrefix = process.env.DATA_PREFIX
      ? `${process.env.DATA_PREFIX}\n`
      : "";
    let str = `${dataPrefix}time,position,currentQueueLength\n`;

    for (const entry of this.positionHistory) {
      str += `${entry.time.getTime()},${entry.position},${
        entry.currentQueueLength
      }\n`;
    }
    await fs.promises.mkdir(dirname, { recursive: true });
    await fs.promises.writeFile(path.join(dirname, `${now}.csv`), str, "utf-8");
    return;
  }

  public summarize(): QueueResult | null {
    // writeQueueHistoryToFile().catch(console.error);

    const startingPosition = this.positionHistory[0];
    if (!startingPosition) {
      // console.info("[Queue speed] No starting position");
      return null;
    }
    const queueStartTime = startingPosition.time;
    const now = new Date();
    const timeDelta = now.getTime() - startingPosition.time.getTime();
    const minDelta = timeDelta / (1000 * 60);

    const curPos = this.currentPosition;
    const posDiff = startingPosition.position - curPos;

    const averagePositionsPerMinute = posDiff / minDelta;
    const averageMinutesPerPosition = minDelta / posDiff;

    const totalWaitTime = getWaitTime(startingPosition.position, 0);
    const timepassed = getWaitTime(startingPosition.position, this.currentPosition);
    const predictedETA = (totalWaitTime - timepassed) / 60;

    return {
      startingPosition: startingPosition.position,
      currentPosition: this.currentPosition,
      queueStartTime: startingPosition.time.getTime(),
      minutesInQueue: Math.floor(minDelta),
      averagePositionsPerMinute,
      averageMinutesPerPosition,
      predictedETA: Math.floor(predictedETA)
    };

    // console.info(`[Qeueue speed Summary]
    // Started recording at: ${queueStartTime}
    // Starting position: ${startingPosition.position}
    // End time: ${now}
    // Total time: ${millisecondsToStringTime(timeDelta)}
    // Average positions per minute: ${averagePositionsPerMinute} (${
    //       startingPosition.position / (timeDelta / 1000)
    //     } [per seconds])
    // Average minutes per position: ${averageMinutesPerPosition} (${
    //       timeDelta / 1000 / startingPosition.position
    //     } [seconds per position])`);
  }
}

function parseMessageToPosition(message: string) {
  if (!message.includes("Position in queue:")) {
    // log("No position in message", message);
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
