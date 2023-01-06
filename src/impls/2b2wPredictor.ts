import * as mc from "minecraft-protocol";
import * as everpolate from "everpolate";

import { EventEmitter } from "events";
import * as path from "path";
import * as fs from "fs";

import type { Bot, BotOptions } from "mineflayer";
import { PacketQueuePredictor } from "../abstract/packetQueuePredictor";
import { ChatMessage } from "prismarine-chat";
import { Conn } from "@rob9315/mcproxy";
import { getWaitTime, GQueueLookup, PositionHistory } from "../util/remoteInfo";


export class OldPredictor extends PacketQueuePredictor<Bot, "message"> {
  private _startedQueue: number = 0; // epoch
  private _expectedEnd: number = 0; // epoch
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
