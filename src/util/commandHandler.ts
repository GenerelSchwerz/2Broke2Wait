import { TypedEventEmitter } from "./utilTypes";
import { ProxyServer } from "../abstract/proxyServer";
import { PacketMeta, ServerClient } from "minecraft-protocol";
import type { Block } from "prismarine-block";
import { Client, PacketMiddleware } from "@rob9315/mcproxy";
import { sleep } from "./index";

interface CommandHandlerEvents {
  command: (cmd: string, func?: Function) => void;
}

type CommandFunc = (client: Client | ServerClient, ...args: string[]) => void;
interface CommandMap {
  [key: string]: CommandFunc;
}

export class CommandHandler<Server extends ProxyServer> extends TypedEventEmitter<CommandHandlerEvents> {
  private _prefix: string = "/";

  public get prefix() {
    return this._prefix;
  }

  public set prefix(prefix: string) {
    this.cleanupCmds(this._prefix, prefix);
    this._prefix = prefix;
  }
  constructor(
    private srv: Server,
    prefix: string = "/",
    public readonly proxyCmds: CommandMap = {},
    public readonly disconnectedCmds: CommandMap = {}
  ) {
    super();
    this.prefix = prefix;
  }

  private cleanupCmds(oldPrefix: string, newPrefix: string) {
    for (let key of Object.keys(this.proxyCmds)) {
      if (key.startsWith(oldPrefix)) {
        const oldKey = key;
        key = key.substring(this.prefix.length);
        this.proxyCmds[newPrefix + key] = this.proxyCmds[oldKey];
        delete this.proxyCmds[oldKey];
      } else if (!key.startsWith(newPrefix)) {
        this.proxyCmds[newPrefix + key] = this.proxyCmds[key];
        delete this.proxyCmds[key];
      }
    }
  }

  public getActiveCmds() {
    return this.srv.isProxyConnected() ? this.proxyCmds : this.disconnectedCmds;
  }

  loadProxyCommands(obj: CommandMap) {
    for (const entry of Object.entries(obj)) {
      const key = entry[0].startsWith(this.prefix) ? entry[0] : this.prefix + entry[0];
      this.proxyCmds[key] = entry[1];
    }
  }

  loadDisconnectedCommands(obj: CommandMap) {
    for (const entry of Object.entries(obj)) {
      const key = entry[0].startsWith(this.prefix) ? entry[0] : this.prefix + entry[0];
      this.disconnectedCmds[key] = entry[1];
    }
  }

  unlinkedChatHandler = async (
    client: Client | ServerClient,
    { message }: { message: string },
    meta: PacketMeta
  ) => {
    if (this.srv.isProxyConnected()) return;
    const cmds = message.split("|");
    if (cmds.length === 1) {
      const [cmd, ...args] = cmds;
      if (!cmd.startsWith(this.prefix)) return this.srv.proxy?.write("chat", {message});
      const cmdRunner = this.srv.isProxyConnected() ? this.proxyCmds : this.disconnectedCmds;
      const cmdFunc = cmdRunner[cmd];
      if (cmdFunc) cmdFunc.call(this.srv, client, ...args);
      else cmdRunner["default"]?.call(this.srv, client, ...args);
      return;
    } else {
      for (const cmdLine of cmds) {
        let [cmd, ...args] = cmdLine.trimStart().split(" ");
        if (!cmd.startsWith(this.prefix)) cmd = this.prefix + cmd;
        const cmdRunner = this.srv.isProxyConnected() ? this.proxyCmds : this.disconnectedCmds;
        const cmdFunc = cmdRunner[cmd];
        if (cmdFunc) {
          cmdFunc.call(this.srv, client, ...args);
          await sleep(300);
        } else {
          cmdRunner["default"]?.call(this.srv, client, ...args);
          return;
        }
      }
    }
  };

  proxyCommandHandler: PacketMiddleware = async ({ meta, data, pclient }) => {
    if (!this.srv.proxy || !pclient) return;
    if (meta.name !== "chat") return;
    const cmds: string[] = data.message.split("|");
    if (cmds.length === 1) {
      const [cmd, ...args] = cmds;
      if (!cmd.startsWith(this.prefix)) return true;
      const cmdRunner = this.proxyCmds;
      const cmdFunc = cmdRunner[cmd];
      if (cmdFunc) cmdFunc.call(this.srv, pclient, ...args);
      else {
        cmdRunner[this.prefix + "default"]?.call(this.srv, pclient, ...args);
        return true;
      }
      return false;
    } else {
      for (const cmdLine of cmds) {
        let [cmd, ...args] = cmdLine.trimStart().split(" ");
        if (!cmd.startsWith(this.prefix)) cmd = this.prefix + cmd;
        const cmdRunner = this.proxyCmds;
        const cmdFunc = cmdRunner[cmd];
        if (cmdFunc) {
          cmdFunc.call(this.srv, pclient, ...args);
          await sleep(300);
        } else {
          cmdRunner["default"]?.call(this.srv, pclient, ...args);
          return false;
        }
      }
    }
  };

  tabCompleteHandler = (
    client: Client | ServerClient,
    { text, assumeCommand, lookedAtBlock }: { text: string; assumeCommand: boolean; lookedAtBlock?: Block },
    packetMeta: PacketMeta
  ) => {
    const matches = [];
    const cmds = this.srv.isProxyConnected() ? Object.keys(this.proxyCmds) : Object.keys(this.disconnectedCmds);
    for (const cmd of cmds) {
      if (cmd.startsWith(text)) {
        matches.push(cmd);
      }
    }
    client.write("tab_complete", { matches });
  };

  updateClientCmds(client: Client | ServerClient) {
    this.srv.proxy?.attach(client as any, { toServerMiddleware: [this.proxyCommandHandler] });
    client.on("chat", (...args) => this.unlinkedChatHandler(client, ...args));
    client.on("tab_complete", (...args) => this.tabCompleteHandler(client, ...args));
  }

  isCmd(cmd: string) {
    const cmdRunner = this.srv.isProxyConnected() ? this.proxyCmds : this.disconnectedCmds;
    return cmdRunner[cmd];
  }

  manualRun(cmd: string, client: Client | ServerClient = {} as any, ...args: any[]) {
    if (!cmd.startsWith(this.prefix)) cmd = this.prefix + cmd;
    const cmdRunner = this.srv.isProxyConnected() ? this.proxyCmds : this.disconnectedCmds;
    cmdRunner[cmd]?.call(this.srv, client, ...args);
  }
}
