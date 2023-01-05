// import { EventEmitter } from "events";
// import { StrictEventEmitter } from "strict-event-emitter-types";

// import type { Bot, BotEvents } from "mineflayer";
// import { Client } from "minecraft-protocol";

// type Overloads<T extends (...args: any[]) => any> = T extends {
//   (...args: infer A1): infer R1;
//   (...args: infer A2): infer R2;
//   (...args: infer A3): infer R3;
//   (...args: infer A4): infer R4;
//   (...args: infer A5): infer R5;
//   (...args: infer A6): infer R6;
// }
//   ?
//       | ((...args: A1) => R1)
//       | ((...args: A2) => R2)
//       | ((...args: A3) => R3)
//       | ((...args: A4) => R4)
//       | ((...args: A5) => R5)
//       | ((...args: A6) => R6)
//   : T extends {
//       (...args: infer A1): infer R1;
//       (...args: infer A2): infer R2;
//       (...args: infer A3): infer R3;
//       (...args: infer A4): infer R4;
//       (...args: infer A5): infer R5;
//     }
//   ?
//       | ((...args: A1) => R1)
//       | ((...args: A2) => R2)
//       | ((...args: A3) => R3)
//       | ((...args: A4) => R4)
//       | ((...args: A5) => R5)
//   : T extends {
//       (...args: infer A1): infer R1;
//       (...args: infer A2): infer R2;
//       (...args: infer A3): infer R3;
//       (...args: infer A4): infer R4;
//     }
//   ?
//       | ((...args: A1) => R1)
//       | ((...args: A2) => R2)
//       | ((...args: A3) => R3)
//       | ((...args: A4) => R4)
//   : T extends {
//       (...args: infer A1): infer R1;
//       (...args: infer A2): infer R2;
//       (...args: infer A3): infer R3;
//     }
//   ? ((...args: A1) => R1) | ((...args: A2) => R2) | ((...args: A3) => R3)
//   : T extends { (...args: infer A1): infer R1; (...args: infer A2): infer R2 }
//   ? ((...args: A1) => R1) | ((...args: A2) => R2)
//   : T extends { (...args: infer A1): infer R1 }
//   ? (...args: A1) => R1
//   : never;

// type OverloadedParameters<T extends (...args: any[]) => any> = Parameters<
//   Overloads<T>
// >;
// type OverloadedReturnType<T extends (...args: any[]) => any> = ReturnType<
//   Overloads<T>
// >;

// export interface PacketQueuePredictorEvents {
//   queueUpdate: (oldPos: number, newPos: number, eta?: number) => void;
// }

// type PacketQueuePredictorEmitter<
//   T extends PacketQueuePredictorEvents = PacketQueuePredictorEvents
// > = StrictEventEmitter<EventEmitter, T>;

// type ValidEmitters = Bot | Client;

// type ValidClientFuncs = OverloadedParameters<Client["on"]>;
// type ValidClientEvents = ValidClientFuncs[0];
// type ValidClientListeners = ValidClientFuncs[1];

// type ClientListener<T extends ValidClientEvents> = Extract<
//   ValidClientFuncs,
//   [event: T, handler: any]
// >;

// type EmitterEvent<T extends ValidEmitters> = T extends Bot
//   ? keyof BotEvents
//   : ValidClientEvents;

// const test: EmitterEvent<Client> = "end";

// function isClient(emitter: ValidEmitters): emitter is Client {
//   return emitter instanceof Client;
// }

// export abstract class PacketQueuePredictor<
//   Src extends ValidEmitters,
//   T extends EmitterEvent<Src>
// > extends (EventEmitter as { new (): PacketQueuePredictorEmitter }) {
//   private _queuePos: number;

//   public get queuePos() {
//     return this._queuePos;
//   }

//   constructor(private emitter: ValidEmitters, private wantedEvent: T) {
//     super();
//   }

//   protected abstract listener: T extends EmitterEvent<Bot>
//     ? BotEvents[T]
//     : T extends EmitterEvent<Client>
//     ? ClientListener<T>[1]
//     : never;

//   public begin() {
//     if (isClient(this.emitter)) {
//         this.emitter.on(this.wantedEvent satisfies EmitterEvent<Client>, this.listener);
//     }
   
//   }

//   public end() {
//     this.emitter.removeListener(this.wantedEvent as any, this.listener);
//   }

//   protected async onUpdate(newPos: number, eta?: number) {
//     this.emit("queueUpdate", this._queuePos, newPos, eta);
//     this._queuePos = newPos;
//   }
// }
