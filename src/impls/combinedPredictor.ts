import { PacketQueuePredictor } from "../abstract/packetQueuePredictor";
import type { Client, PacketMeta } from "minecraft-protocol";

import { ProxyServer } from "../abstract/proxyServer";
import * as everpolate from "everpolate";
import { Conn } from "@rob9315/mcproxy";


export let status = {
  // Stores pertinent information (to-do: set up setters and getters)
  position: "CHECKING...",
  eta: "CHECKING...",
  restart: "None",
  mineflayer: "CHECKING...",
  inQueue: true,
  ngrokUrl: "None",
  livechatRelay: "false",
  controller: "None",
};

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

export type PositionHistory = {
    time: number; // unix timestamp
    position: number;
    currentQueueLength: number;
  };
  

export class CombinedPredictor extends PacketQueuePredictor<Client, "packet"> {
  private _inQueue: boolean = false;
  private _startingPos: number = NaN;
  private _eta: number = NaN;

  public get inQueue() {
    return this._inQueue;
  }

  public get eta() {
    return this._eta;
  }

  public constructor(conn: Conn) {
    super(conn, conn.stateData.bot._client, "packet");
    this.begin();
  }

  public getPredictedEta(): number {
    if (Number.isNaN(this._startingPos)) return NaN;

    const totalWaitTime = getWaitTime(this._startingPos, 0);
    const timepassed = getWaitTime(this._startingPos, this._lastPos);
    const predictedETA = totalWaitTime - timepassed;
    return Math.floor(Date.now() / 1000) + Math.floor(predictedETA);
  }


  protected listener = (data: any, packetMeta: PacketMeta) => {
    // console.log(packetMeta.name);
    switch (packetMeta.name) {
      case "difficulty":
        this.difficultyPacketHandler(data);
        break;
      case "playerlist_header":
        this.playerlistHeaderPacketHandler(data);
        break;
    }
  };

  /**
   * Difficulty packet handler.
   * checks whether or not we're in queue.
   *
   * When rerouted by Velocity, the difficulty packet is always sent after the MC|Brand packet.
   */
  public difficultyPacketHandler(packetData: any) {
    const inQueue = (this.remoteBot.game as any).serverBrand === "2b2t (Velocity)" && this.remoteBot.game.dimension === ("minecraft:end" as any) && packetData.difficulty === 1;
    if (this._inQueue !== inQueue) {
      this.emit(inQueue === false ? "leftQueue" : "enteredQueue");
      this._lastPos = NaN;
      this._startingPos = NaN;
    }
    this._inQueue = inQueue;
  }

  /**
   * Playerlist packet handler, checks position in queue
   */
  public playerlistHeaderPacketHandler(packetData: any) {
    // If no longer in queue, stop here
    if (!this._inQueue) {
      return;
    }

    // Parse header packets
    const header = JSON.parse(packetData.header).extra;
    if (header && header.length === 6) {
      const position: number = Number(
        header[4].extra[0].text.replace(/\n/, "")
      );
        
      if (Number.isNaN(position)) {
        this.emit("invalidData", { position, eta: this._eta });
        return;
      }

      if (this._lastPos !== position) {
        if (Number.isNaN(this._lastPos)) {
          this._startingPos = position;
        }
        const eta = this.getPredictedEta();
        this.emit("queueUpdate", this._lastPos, position, eta);
        this._lastPos = position;
        this._eta = eta;
      }
    }
  }
}