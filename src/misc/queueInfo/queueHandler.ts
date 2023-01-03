import { ServerOptions } from "minecraft-protocol";

import type { BotOptions } from "mineflayer";

import {
  BaseCommand,
  isBaseCommand,
  QueueCommand,
} from "../constants.js";
import { ProxyLogic } from "../proxyUtil/proxyLogic.js";
import { IProxyServerOpts } from "../proxyUtil/proxyServer.js";
import { QueuePlugin } from "./queueFollower.js";
import { QueueResult } from "./index.js";


export class QueueHandler extends ProxyLogic {

  public get queuePos() {
    return this.proxyServer.remoteBot.queuePlugin.currentPosition;
  }

  public get queueHistory() {
    return this.proxyServer.remoteBot.queuePlugin.positionHistory;
  }


  private get queuePlugin() {
    return this.proxyServer.remoteBot.queuePlugin;
  }

  public constructor(
    bOptions: BotOptions,
    sOptions: ServerOptions,
    psOptions: Partial<IProxyServerOpts> = {}
  ) {
    super(bOptions, sOptions, psOptions);
  }


  public override async handleCommand(
    command: QueueCommand | BaseCommand,
    ...args: any[]
  ) {
    if (isBaseCommand(command)) {
      return super.handleCommand(command, ...args);
    }
    switch (command) {
      case "qpos":
        return this.queuePos;
      case "qhistory":
        return this.queueHistory;
      case "qinfo":
        return this.getQueueInfo();
    }
  }

  public override start() {
    super.start();
    const inject = QueuePlugin.makeInjection();
    this.proxyServer.remoteBot.loadPlugin(inject);
    return true;
  }

  public getQueueInfo(): QueueResult | {currentPosition: number} {
    const summarize: any = this.queuePlugin.summarize();
    if (!summarize) return {currentPosition: this.queuePos };
    return summarize;
  }

}
