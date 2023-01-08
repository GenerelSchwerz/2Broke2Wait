import { ConstructorOptions, EventEmitter2 } from "eventemitter2";
import { StrictEventEmitter } from "strict-event-emitter-types";
import { Client, PacketMeta, PromiseLike } from "minecraft-protocol";
import { Conn } from "@rob9315/mcproxy";
import { ClientListener, ClientEvent, ClientEmitters } from "../util/utilTypes";

import type { Bot, BotEvents } from "mineflayer";
import { IProxyServerEvents, ProxyServer } from "./proxyServer";
import { PacketQueuePredictor, PacketQueuePredictorEvents } from "./packetQueuePredictor";

export interface EventRegister {
  begin(): void;
  end(): void;
}

export abstract class ClientEventRegister<
  Src extends ClientEmitters,
  T extends ClientEvent<Src>
> implements EventRegister {

  constructor(
    public readonly emitter: Src,
    public readonly wantedEvent: T
  ) { }

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
  }
}

export abstract class ServerEventRegister<
  K extends keyof T,
  T extends IProxyServerEvents = IProxyServerEvents,
  Srv extends ProxyServer = ProxyServer,
> implements EventRegister {

  constructor(
    protected readonly srv: Srv,
    public readonly wantedEvent: K
  ) { }

  protected abstract listener: T[K];

  public begin() {
    this.srv.on(this.wantedEvent as any, this.listener as any);
  }

  public end() {
    this.srv.removeListener(this.wantedEvent as any, this.listener as any);
  }
}

export abstract class QueueEventRegister<
  Src extends ClientEmitters,
  T extends keyof PacketQueuePredictorEvents,
> implements EventRegister {

  constructor(
    protected readonly queue: PacketQueuePredictor<Src, any>,
    public readonly wantedEvent: T
  ) { }

  protected abstract listener: PacketQueuePredictorEvents[T];

  public begin() {
    this.queue.on(this.wantedEvent as any, this.listener);
  }

  public end() {
    this.queue.removeListener(this.wantedEvent as any, this.listener);
  }
}