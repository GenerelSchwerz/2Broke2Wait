import * as mc from "minecraft-protocol";
import * as everpolate from "everpolate";

import { EventEmitter } from "events";
import * as path from "path";
import * as fs from "fs";

import type { Bot, BotOptions } from "mineflayer";
import { PacketQueuePredictor } from "../abstract/packetQueuePredictor";
import { ChatMessage } from "prismarine-chat";
import { ProxyServer } from "../abstract/proxyServer";
import { sleep } from "@nxg-org/mineflayer-antiafk/lib/utils";
import { Conn } from "@rob9315/mcproxy";

const c = 150;
const queueData = {
  place: [257, 789, 93, 418, 666, 826, 231, 506, 550, 207, 586, 486, 412, 758],
  factor: [
    0.9999291667668093, 0.9999337457796981, 0.9998618838664679,
    0.9999168965649361, 0.9999219189483673, 0.9999279556964097,
    0.9999234240704379, 0.9999262577896301, 0.9999462301738332,
    0.9999220416881794, 0.999938895110192, 0.9999440195022513,
    0.9999410569845172, 0.9999473463335498,
  ],
};

export function getWaitTime(queueLength: number, queuePos: number) {
  let b = everpolate.linear(queueLength, queueData.place, queueData.factor)[0];
  return Math.log((queuePos + c) / (queueLength + c)) / Math.log(b); // see issue 141
}

export interface QueueResult {
  startingPosition: number;
  currentPosition: number;
  queueStartTime: number;
  minutesInQueue: number;
  averagePositionsPerMinute: number;
  averageMinutesPerPosition: number;
  predictedETA: number;
}

export type QueueLength = {
  main: { normal: number; priority: number };
  test: { normal: number; priority: number };
};

export type PositionHistory = {
  time: number; // unix timestamp
  position: number;
  currentQueueLength: number;
};

export interface IQueuePluginOpts {
  startTime: Date | null;
  endTime: Date | null;
  inQueue: boolean;
  currentPosition: number;
  lastPosition: number;
  positionHistory: PositionHistory[];
  sawQueuePosition: boolean;
}

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

const GQueueLookup = new QueueLookup();

export class OldPredictor extends PacketQueuePredictor<Bot, "message"> {
  private _startedQueue: number = 0; // epoch
  private _expectedEnd: number = 0; // epoch
  private _inQueue: boolean = false;
  private _posHistory: PositionHistory[] = [];

  public constructor(protected srv: Conn) {
    super(srv, srv.stateData.bot, "message");
  }

  public getPredictedEta(): number {
    const startingPosition = this._posHistory[0];
    if (!startingPosition) {
      return NaN;
    }
    const totalWaitTime = getWaitTime(startingPosition.position, 0);
    const timepassed = getWaitTime(startingPosition.position, this._lastPos);
    const predictedETA = totalWaitTime - timepassed;
    return Math.floor(Date.now() / 1000) + Math.floor(predictedETA);
  }


  protected listener = async (jsonMessage: ChatMessage, position: string) => {
    const strings: string[] = jsonMessage.toString().split("\n");
    for (const string of strings) {
      // replace newlines, trim and split, '' if string empty.
      const beginning = string.replace(/\n/g, "").trim().split(" ")[0];
      if (beginning.length === 0) continue;

      switch (beginning) {
        case "Connecting":
          this._expectedEnd = Math.floor(Date.now() / 1000);
          this._inQueue = false;
          this._lastPos = NaN;
          this.emit("leftQueue");
          return;

        case "Position":
          const pos = parseMessageToPosition(string);
          if (pos === null) {
            this.emit("invalidData", string);
            break;
          }

          if (Number.isNaN(this._lastPos)) {
            this._inQueue = true;
            this._startedQueue = Math.floor(Date.now() / 1000);
            this.emit("enteredQueue");
          }

          if (this._lastPos < pos) {
            this._startedQueue = Math.floor(Date.now() / 1000);
            this._expectedEnd = NaN;
            this._posHistory = [];
          }

          if (this._lastPos > pos) {
            const queueLengths = await GQueueLookup.getQueueLength();
            this._posHistory.push({
              time: Math.floor(Date.now() / 1000),
              position: pos,
              currentQueueLength: queueLengths.main?.normal ?? 0,
            });
            this.emit("queueUpdate", this._lastPos, pos, this.getPredictedEta());
          }

          this._lastPos = pos;
          break;

        default:
          continue;
      }
    }
  };
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
