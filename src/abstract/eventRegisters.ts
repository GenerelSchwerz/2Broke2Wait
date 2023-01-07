import { ConstructorOptions, EventEmitter2 } from "eventemitter2";
import { StrictEventEmitter } from "strict-event-emitter-types";
import { Client, PacketMeta, PromiseLike } from "minecraft-protocol";
import { Conn } from "@rob9315/mcproxy";
import { ClientListener, ClientEvent, ClientEmitters } from "../util/utilTypes";

import type {Bot, BotEvents} from "mineflayer";
import { ServerLogic, ServerLogicEvents, StrictServerLogicEvents } from "../serverLogic";

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
  ) {}

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
  T extends keyof StrictServerLogicEvents
> implements EventRegister {

  constructor(
    protected readonly srv: ServerLogic,
    public readonly wantedEvent: T
  ) {}

  protected abstract listener: ServerLogicEvents[T];

  public begin() {
    this.srv.on(this.wantedEvent as any, this.listener);
  }

  public end() {
    this.srv.removeListener(this.wantedEvent as any, this.listener);
  }
}