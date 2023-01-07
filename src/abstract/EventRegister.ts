import { ConstructorOptions, EventEmitter2 } from "eventemitter2";
import { StrictEventEmitter } from "strict-event-emitter-types";
import { Client, PacketMeta, PromiseLike } from "minecraft-protocol";
import { Conn } from "@rob9315/mcproxy";

import type { Bot, BotEvents } from "mineflayer";

type Overloads<T extends (...args: any[]) => any> = T extends {
  (...args: infer A1): infer R1;
  (...args: infer A2): infer R2;
  (...args: infer A3): infer R3;
  (...args: infer A4): infer R4;
  (...args: infer A5): infer R5;
  (...args: infer A6): infer R6;
  (...args: infer A7): infer R7;
  (...args: infer A8): infer R8;
  (...args: infer A9): infer R9;
}
  ?
      | ((...args: A1) => R1)
      | ((...args: A2) => R2)
      | ((...args: A3) => R3)
      | ((...args: A4) => R4)
      | ((...args: A5) => R5)
      | ((...args: A6) => R6)
      | ((...args: A7) => R7)
      | ((...args: A8) => R8)
      | ((...args: A9) => R9)
  : T extends {
      (...args: infer A1): infer R1;
      (...args: infer A2): infer R2;
      (...args: infer A3): infer R3;
      (...args: infer A4): infer R4;
      (...args: infer A5): infer R5;
      (...args: infer A6): infer R6;
      (...args: infer A7): infer R7;
      (...args: infer A8): infer R8;
    }
  ?
      | ((...args: A1) => R1)
      | ((...args: A2) => R2)
      | ((...args: A3) => R3)
      | ((...args: A4) => R4)
      | ((...args: A5) => R5)
      | ((...args: A6) => R6)
      | ((...args: A7) => R7)
      | ((...args: A8) => R8)
  : T extends {
      (...args: infer A1): infer R1;
      (...args: infer A2): infer R2;
      (...args: infer A3): infer R3;
      (...args: infer A4): infer R4;
      (...args: infer A5): infer R5;
      (...args: infer A6): infer R6;
      (...args: infer A7): infer R7;
    }
  ?
      | ((...args: A1) => R1)
      | ((...args: A2) => R2)
      | ((...args: A3) => R3)
      | ((...args: A4) => R4)
      | ((...args: A5) => R5)
      | ((...args: A6) => R6)
      | ((...args: A7) => R7)
  : T extends {
      (...args: infer A1): infer R1;
      (...args: infer A2): infer R2;
      (...args: infer A3): infer R3;
      (...args: infer A4): infer R4;
      (...args: infer A5): infer R5;
      (...args: infer A6): infer R6;
    }
  ?
      | ((...args: A1) => R1)
      | ((...args: A2) => R2)
      | ((...args: A3) => R3)
      | ((...args: A4) => R4)
      | ((...args: A5) => R5)
      | ((...args: A6) => R6)
  : T extends {
      (...args: infer A1): infer R1;
      (...args: infer A2): infer R2;
      (...args: infer A3): infer R3;
      (...args: infer A4): infer R4;
      (...args: infer A5): infer R5;
    }
  ?
      | ((...args: A1) => R1)
      | ((...args: A2) => R2)
      | ((...args: A3) => R3)
      | ((...args: A4) => R4)
      | ((...args: A5) => R5)
  : T extends {
      (...args: infer A1): infer R1;
      (...args: infer A2): infer R2;
      (...args: infer A3): infer R3;
      (...args: infer A4): infer R4;
    }
  ?
      | ((...args: A1) => R1)
      | ((...args: A2) => R2)
      | ((...args: A3) => R3)
      | ((...args: A4) => R4)
  : T extends {
      (...args: infer A1): infer R1;
      (...args: infer A2): infer R2;
      (...args: infer A3): infer R3;
    }
  ? ((...args: A1) => R1) | ((...args: A2) => R2) | ((...args: A3) => R3)
  : T extends { (...args: infer A1): infer R1; (...args: infer A2): infer R2 }
  ? ((...args: A1) => R1) | ((...args: A2) => R2)
  : T extends { (...args: infer A1): infer R1 }
  ? (...args: A1) => R1
  : never;

type OverloadedParameters<T extends (...args: any[]) => any> = Parameters<
  Overloads<T>
>;

type ValidEmitters = Bot | Client;

type ValidClientFuncs = Extract<
  OverloadedParameters<Client["on"]>,
  [
    event: any, //"packet" | "raw" | "session" | "state" | "end" | "connect"
    handler: any
  ]
>;
type ValidClientEvents = ValidClientFuncs[0];

type ClientListener<T extends ValidClientEvents> = Extract<
  ValidClientFuncs,
  [event: T, handler: any]
>;

type EmitterEvent<T extends ValidEmitters> = T extends Bot
  ? keyof BotEvents
  : T extends Client
  ? ValidClientEvents
  : never;


export abstract class EventRegister<
  Src extends ValidEmitters,
  T extends EmitterEvent<Src>
> {

  constructor(
    public readonly emitter: Src,
    public readonly wantedEvent: T
  ) {}

  protected abstract listener: T extends EmitterEvent<Bot>
    ? BotEvents[T]
    : T extends EmitterEvent<Client>
    ? ClientListener<T>[1]
    : never;

  public begin() {
    this.emitter.on(this.wantedEvent as any, this.listener);
  }

  public end() {
    this.emitter.removeListener(this.wantedEvent as any, this.listener);
  }
}