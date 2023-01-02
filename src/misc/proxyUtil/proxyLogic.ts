import { IProxyServerOpts, ProxyServer } from "./proxyServer.js";
import mc, { ServerOptions } from "minecraft-protocol";
import {
  AnyCommand,
  BaseCommand,
  ConnectMode,
  isBaseCommand,
  isLoopMode,
  LoopMode,
  LoopModes,
  promisedPing,
  sleep,
} from "../constants.js";
import { Conn } from "@rob9315/mcproxy";
import merge from "ts-deepmerge";

import type { BotOptions } from "mineflayer";
import { waitUntilTimeToStart } from "../queueInfo/queuePredictor.js";

export class ProxyLogic {
  private _rawServer: mc.Server;

  private _currentConnectMode: ConnectMode = "auth";
  private _currentLoopMode: LoopMode = "enabled";

  private _proxyServer: ProxyServer | null;

  public get currentConnectMode() {
    return this._currentConnectMode;
  }

  public get currentLoopMode() {
    return this._currentLoopMode;
  }

  public get proxyServer() {
    return this._proxyServer;
  }

  public get proxy() {
    return this._proxyServer.proxy ?? null;
  }

  public constructor(
    public bOptions: BotOptions,
    public sOptions: ServerOptions,
    public psOptions: Partial<IProxyServerOpts> = {}
  ) {
    if (this.sOptions["online-mode"] !== false) {
      this.sOptions["online-mode"] = this.bOptions.auth !== "offline";
    }

    // this._rawServer = mc.createServer(sOptions);
  }

  public isConnected(): boolean {
    return !!this._proxyServer;
  }

  public async handleCommand(
    command: BaseCommand,
    ...args: any[]
  ): Promise<unknown> {
    switch (command) {
      case "shutdown":
      case "exit":
      case "stop":
      case "quit":
        return this.shutdown();

      case "start":
        return this.start();

      case "play":
        return await this.playat(Number(args[0]), Number(args[1]));

      case "loop":
        return this.loop(args[0]);

      case "pingtime":
        return await this.pingTime(args[0], Number(args[1]));

      case "stats":
        return this.getStats();

      default:
        // should be only occurrence of returning undefined.
        return undefined;
    }
  }

  public start() {
    this._proxyServer = ProxyServer.createProxyServer(
      this.bOptions,
      this.sOptions,
      this.psOptions
    );

    this._proxyServer.on("disconnect", async (reason: string | Error) => {
      if (reason instanceof Error && this._currentLoopMode !== "disabled") {
        await this.haltUntilPingable(this.bOptions.host, this.bOptions.port);
        this.restart();
        if (this.currentLoopMode === "once") this._currentLoopMode = "disabled";
      }
    });
    // this._proxyServer = ProxyServer.ProxyServerReuseServer(
    //   this._rawServer,
    //   this.bOptions,
    //   this.psOptions
    // );
    return true;
  }


  public shutdown(): number {
    const localPlayerCount = Object.values(
      this._proxyServer.server.clients
    ).length;
    this._proxyServer.close();
    this._proxyServer = null;
    return localPlayerCount;
  }

  public restart() {
    this.shutdown();
    this.start();
  }

  public async playat(hour: number, minute: number): Promise<boolean> {
    // bad handling, we have no way of actually stopping this.
    // TODO: rewrite wailUntilTimeToStart to localize here.
    // TODO: cancel internally.
    const res = await waitUntilTimeToStart(hour, minute);
    if (!res) return false;
    if (this.isConnected()) return false; // don't run if we already decided to manually run.
    console.log(this._proxyServer)
    return this.start();
  }



  public loop(mode: LoopMode | "status"): boolean {
    if (isLoopMode(mode)) {
      const loopChanged = this._currentLoopMode !== mode;
      this._currentLoopMode = mode;
      return loopChanged;
    } else {
      return this._currentLoopMode !== "disabled";
    }
  }

  public async pingTime(host: string, port: number): Promise<number> {
    let pingStart = performance.now();
    try {
      await promisedPing({ host, port });
    } catch (e) {
      return NaN;
    }
    return performance.now() - pingStart;
  }

  public getStats() {
    if (!this._proxyServer) {
      return { health: NaN, food: NaN };
    }

    return {
      health: this._proxyServer.remoteBot.health,
      food: this._proxyServer.remoteBot.food,
    };
  }

  public async haltUntilPingable(host: string, port: number) {
    while (true) {
      try {
        await promisedPing({ host, port });
        break;
      } catch (e) {
        await sleep(3000);
      }
    }
  }
}
