import {promisify} from "util";
import mc from "minecraft-protocol";


export const LoopModes = ["enabled", "disabled", "once"] as const
export const ConnectModes = ["connecting", "auth"] as const;
export const Commands = [
    "shutdown",
    "start",
    "loop",
    "stats",
    "pingtime"
] as const;

export type ConnectMode = typeof ConnectModes[number];
export type LoopMode = typeof LoopModes[number];
export type Command = typeof Commands[number];


export const sleep = promisify(setTimeout)
export const promisedPing = promisify(mc.ping)
