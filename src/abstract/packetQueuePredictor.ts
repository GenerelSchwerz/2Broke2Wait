import { ConstructorOptions, EventEmitter2 } from "eventemitter2";
import { StrictEventEmitter } from "strict-event-emitter-types";
import { Client } from "minecraft-protocol";
import { Conn } from "@rob9315/mcproxy";

import type { Bot, BotEvents } from "mineflayer";

import type { ClientListener, ClientEvent, PromiseLike, ClientEmitters } from "../util/utilTypes";

export interface PacketQueuePredictorEvents {
  invalidData: (...any: any[]) => PromiseLike;
  enteredQueue: () => PromiseLike;
  leftQueue: () => PromiseLike;
  queueUpdate: (oldPos: number, newPos: number, eta: number) => PromiseLike;
  "*": PacketQueuePredictorEvents[Exclude<keyof PacketQueuePredictorEvents, "*">]
}

export type StrictPacketQueuePredictorEvents = Omit<PacketQueuePredictorEvents, "*">

type PacketQueuePredictorEmitter<
  T extends PacketQueuePredictorEvents = PacketQueuePredictorEvents
> = StrictEventEmitter<EventEmitter2, T>;


export abstract class PacketQueuePredictor<
  Src extends ClientEmitters,
  T extends ClientEvent<Src>
> extends (EventEmitter2 as {
  new (options?: ConstructorOptions): PacketQueuePredictorEmitter;
}) {
  protected _inQueue: boolean = false;
  protected _lastPos: number = NaN;
  protected _eta: number = NaN;

  public get lastPos() {
    return this._lastPos;
  }

  public get eta() {
    return this._eta;
  }

  public get inQueue() {
    return this._inQueue;
  }

  public readonly remoteBot;

  public readonly remoteClient;

  constructor(
    protected readonly conn: Conn,
    protected readonly emitter: Src,
    protected readonly wantedEvent: T
  ) {
    super({ wildcard: true });
    this.remoteBot = conn.stateData.bot;
    this.remoteClient = conn.stateData.bot._client;
  }

  protected abstract listener: T extends ClientEvent<Bot>
    ? BotEvents[T]
    : T extends ClientEvent<Client>
    ? ClientListener<T>[1]
    : never;

  public begin() {
    this.emitter.on(this.wantedEvent as any, this.listener);
  }

  public end() {
    this.emitter.removeListener(this.wantedEvent as any, this.listener);
    this._eta = NaN;
    this._lastPos = NaN;
  }

  public getInfo() {}
}
