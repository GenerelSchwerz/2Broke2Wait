import { promisify } from "util";
import * as mc from "minecraft-protocol";

export const LoopModes = ["enabled", "disabled", "once"] as const;
export const ConnectModes = ["connecting", "auth"] as const;
export const BaseCommands = [
  "shutdown",
  "stop",
  "exit",
  "quit",
  "start",
  "play",
  "loop",
  "stats",
  "pingtime",
] as const;
export const QueueCommands = [
  "qpos", 
  "qinfo",
  "qhistory",
  "qlog"
] as const;

export const RecognizedCustomServers = ["2b2t.org"] as const;

export type ConnectMode = typeof ConnectModes[number];
export type LoopMode = typeof LoopModes[number];
export type BaseCommand = typeof BaseCommands[number];
export type QueueCommand = typeof QueueCommands[number];

export type AnyCommand = BaseCommand | QueueCommand;

export function isLoopMode(mode: string): mode is LoopMode {
  return LoopModes.includes(mode as any);
}

export function isBaseCommand(command: string): command is BaseCommand {
  return BaseCommands.includes(command as any);
}

export function isQueueCommand(command: string): command is QueueCommand {
  return QueueCommands.includes(command as any);
}

export function isAnyCommand(command: string): command is AnyCommand {
  return (
    BaseCommands.includes(command as any) ||
    QueueCommands.includes(command as any)
  );
}

export type RecognizedCustomServer = typeof RecognizedCustomServers[number];

export const sleep = promisify(setTimeout);
export const promisedPing = promisify(mc.ping);
