import {promisify} from "util";
import mc from "minecraft-protocol";


export const LoopModes = ["enabled", "disabled", "once"] as const
export const ConnectModes = ["connecting", "auth"] as const;
export const BaseCommands = [
    "shutdown",
    "start",
    "startat",
    "loop",
    "stats",
    "pingtime"
] as const;
export const QueueCommands = [
    "queue"
] as const;

export const RecognizedCustomServers = [
    "2b2t.org"
] as const;

export type ConnectMode = typeof ConnectModes[number];
export type LoopMode = typeof LoopModes[number];
export type BaseCommand = typeof BaseCommands[number];
export type QueueCommand = typeof QueueCommands[number];


export type RecognizedCustomServer = typeof RecognizedCustomServers[number];


export const sleep = promisify(setTimeout)
export const promisedPing = promisify(mc.ping)
