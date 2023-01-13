import EventEmitter2, { ConstructorOptions, event, Listener, ListenerFn, OnOptions } from "eventemitter2";
import type { Client } from "minecraft-protocol";
import type { Bot, BotEvents } from "mineflayer";
import StrictEventEmitter from "strict-event-emitter-types/types/src/index";
import { IProxyServerEvents } from "../abstract/proxyServer";
import { AntiAFKServer } from "../impls/antiAfkServer";

export type Overloads<T extends (...args: any[]) => any> = T extends {
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

/**
 * Note: this removes the string and raw-string implementations of emit from minecraft-protocol's client.
 */
type CustomOverload<T extends (...args: any[]) => any> = T extends {
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
  :
  never;

type CustomOverloadedParameters<T extends (...args: any[]) => any> = Parameters<
  CustomOverload<T>
>;

export type OverloadedParameters<T extends (...args: any[]) => any> =
  Parameters<Overloads<T>>;
export type OverloadedReturnType<T extends (...args: any[]) => any> =
  ReturnType<Overloads<T>>;

export type ClientEmitters = Bot | Client;

// type ValidClientFuncs = Extract<
//   OverloadedParameters<Client["on"]>,
//   [event: any, handler: any]
// >; // event: "packet" | "raw" | "session" | "state" | "end" | "connect"

type ValidClientFuncs = CustomOverloadedParameters<Client["on"]>;

type ValidClientEvents = ValidClientFuncs[0];

export type ClientListener<T extends ValidClientEvents> = Extract<
  ValidClientFuncs,
  [event: T, handler: any]
>;

export type ClientEvent<T extends ClientEmitters> = T extends Bot
  ? keyof BotEvents
  : T extends Client
  ? ValidClientEvents
  : never;

export type PromiseLike = void | Promise<void>;


type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

// type IsValidArg<T> = T extends object ? keyof T extends never ? false : true : true;

type OnSignatures<T> = { [P in keyof T]: (event: P, listener: T[P]) => void }
type OnAll<T> = UnionToIntersection<OnSignatures<T>[keyof T]>

type AddParameters<T, P> = T extends (...a: infer A) => infer R ? (event: keyof P, ...a: A) => R : never;

type EmitSignatures<T> = { [P in keyof T]: AddParameters<T[P], T> };

type EmitAll<T> = UnionToIntersection<EmitSignatures<T>[keyof T]>

interface ITypedEventEmitter<T, K = T> {
  on: OnAll<T>,
  emit: EmitAll<K>
}
type ListenerType<T> = [T] extends [(...args: infer U) => any] ? U : [T] extends [void] ? [] : [T];
// Optional derived class if we need it (if we have nothing to add we can just us EventEmitter directly 
//(EventEmitter2 as { new(): StrictEventEmitter<EventEmitter2, any, any> }) {
class TypedEventEmitterImpl extends (EventEmitter2 as { new(): StrictEventEmitter<EventEmitter2, any, any> }) {

}
// Define the actual constructor, we need to use a type assertion to make the `EventEmitter` fit  in here 

export const TypedEventEmitter: {
  new <T, K = T>(options?: ConstructorOptions): StrictEventEmitter<EventEmitter2, T, K>
} = TypedEventEmitterImpl as any;

// Define the type for our emitter 
export type TypedEventEmitter<T, K = T> = StrictEventEmitter<EventEmitter2, T, K>  // Order matters here, we want our overloads to be considered first

// ITypedEventEmitter<T, K> &
