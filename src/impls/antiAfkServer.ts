import { IProxyServerEvents, OldProxyServer } from "../abstract/proxyServer";
import { Bot, BotOptions } from "mineflayer";
import {
  ServerOptions,
  createServer,
  Server,
  ServerClient,
  PacketMeta,
  Client
} from "minecraft-protocol";
import { IProxyServerOpts } from "../abstract/proxyServer";
import { Conn } from "@rob9315/mcproxy";
import antiAFK, {
  DEFAULT_MODULES,
  DEFAULT_PASSIVES
} from "@nxg-org/mineflayer-antiafk";
import autoEat from "@nxg-org/mineflayer-auto-eat";
import { PacketQueuePredictor, PacketQueuePredictorEvents } from "../abstract/packetQueuePredictor";
import { ClientEventRegister, ServerEventRegister } from "../abstract/eventRegisters";
import { CombinedPredictor } from "./combinedPredictor";
import { BuildProxyBase, ProxyServer } from "../abstract/proxyBuilder";
import EventEmitter2, { ConstructorOptions } from "eventemitter2";
import StrictEventEmitter from "strict-event-emitter-types/types/src/index";

export interface AntiAFKOpts extends IProxyServerOpts {
  antiAFK: boolean;
  autoEat: boolean;
}


export interface AntiAFKEvents extends IProxyServerEvents, PacketQueuePredictorEvents {
  "*": AntiAFKEvents[Exclude<keyof AntiAFKEvents, "*">];
}
export type StrictAntiAFKEvents = Omit<AntiAFKEvents, "*">

class Shit extends (EventEmitter2 as { new(options?: ConstructorOptions): StrictEventEmitter<EventEmitter2, StrictAntiAFKEvents>}) {};

const AntiAFKBase = BuildProxyBase<AntiAFKOpts, StrictAntiAFKEvents>(Shit);

export class AntiAFKServer extends AntiAFKBase {

  private _queue: PacketQueuePredictor<any, any>;

  public get queue() {
    return this._queue;
  }

  private _registeredQueueListeners: Set<string> = new Set();
  private _runningQueueListeners: any[] = [];

  // public constructor(
  //   onlineMode: boolean,
  //   bOpts: BotOptions,
  //   server: Server,
  //   psOpts: Partial<AntiAFKOpts>
  // ) {
  //   super(onlineMode, bOpts, server, psOpts);
  // }

  public constructor(...args: any[]) {
    super(args[0], args[1], args[2], args[3]);
  }

  /**
   * Creates Proxy server based on given arguments.
   *
   * DOES re-use the server.
   * @param {BotOptions} bOptions Mineflayer bot options.
   * @param {Plugin[]} plugins Mineflayer bot plugins to load into the remote bot.
   * @param {ServerOptions} sOptions Minecraft-protocol server options.
   * @param {Partial<IProxyServerOpts>} psOptions Partial list of ProxyServer options.
   * @returns {OldProxyServer} Built proxy server.
   */
  public static wrapServer(
    online: boolean,
    bOpts: BotOptions,
    server: Server,
    psOptions: Partial<AntiAFKOpts> = {}
  ): AntiAFKServer {
    return new AntiAFKServer(
      online,
      bOpts,
      server,
      psOptions
    );
  }


  public override start() {
    const conn = super.start();
    this._queue = new CombinedPredictor(conn);
    this._queue.begin();
    this._queue.on("*", (...args: any[]) => { this.emit(this._queue["event"], ...args); });
    return conn;
  }
  
  public override stop () {
    super.stop();
    this._queue.end();
  }

  protected override optionValidation = () => {
    this.psOpts.antiAFK = this.psOpts.antiAFK && this.remoteBot.hasPlugin(antiAFK);
    this.psOpts.autoEat = this.psOpts.autoEat && this.remoteBot.hasPlugin(autoEat);
    return this.psOpts;
  }

  protected override initialBotSetup(bot: Bot): void {
    if (this.psOpts.antiAFK) {
      bot.loadPlugin(antiAFK);

      bot.antiafk.setOptionsForModule(DEFAULT_MODULES["LookAroundModule"], {
        enabled: true,
      });

      bot.antiafk.setOptionsForModule(DEFAULT_MODULES["ChatBotModule"], {
        enabled: true,
        delay: 2000,
      });

      bot.antiafk.setOptionsForModule(DEFAULT_MODULES["WalkAroundModule"], {
        enabled: true,
        timeout: 10000,
      });

      bot.antiafk.setOptionsForPassive(DEFAULT_PASSIVES["KillAuraPassive"], {
        enabled: true,
        playerWhitelist: new Set(["Generel_Schwerz"]),
      });
    }

    if (this.psOpts.autoEat) {
      bot.loadPlugin(autoEat);

      bot.autoEat.setOptions({
        eatUntilFull: true,
        eatingTimeout: 3000,
        minHealth: 14,
        minHunger: 15,
        returnToLastItem: true,
        useOffHand: true,
        bannedFood: [
          "rotten_flesh",
          "pufferfish",
          "chorus_fruit",
          "poisonous_potato",
          "spider_eye",
        ],
      });
    }
  }

  protected override beginBotLogic = () => {
    if (this.psOpts.antiAFK && !this._queue.inQueue) {
      this.remoteBot.antiafk.start();
    }

    if (this.psOpts.autoEat && !this._queue.inQueue) {
      this.remoteBot.autoEat.enable();
    }
  }

  protected override endBotLogic = () => {
    if (this.psOpts.antiAFK) {
      this.remoteBot.antiafk.forceStop();
    }

    if (this.psOpts.autoEat) {
      this.remoteBot.autoEat.disable();
    }
  }

  /**
    * This WILL be moved later.
    * @param actualUser 
    */
  protected notConnectedCommandHandler = (actualUser: ServerClient) => {
    actualUser.on("chat", ({ message }: { message: string }, packetMeta: PacketMeta) => {
      switch (message) {
        case "/start":


          this.closeConnections("Host started proxy.");
          this.start();
          break;
        default:
          break;
      }

    })
    actualUser.on("tab_complete", (packetData: { text: string, assumeCommand: boolean, lookedAtBlock?: any }, packetMeta: PacketMeta) => {
      if ("/start".startsWith(packetData.text)) {
        actualUser.write('tab_complete', {
          matches: ["/start"]
        })
      }
    });
  };

  /**
   * This WILL be moved later.
   * @param actualUser 
   */
  protected whileConnectedCommandHandler = (actualUser: ServerClient) => {
    actualUser.on("chat", ({ message }: { message: string }, packetMeta: PacketMeta) => {
      switch (message) {
        case "/stop":
          this.stop();
          break;
        default:
          break;
      }

    })
    actualUser.on("tab_complete", (packetData: { text: string, assumeCommand: boolean, lookedAtBlock?: any }, packetMeta: PacketMeta) => {
      if ("/stop".startsWith(packetData.text)) {
        actualUser.write('tab_complete', {
          matches: ["/stop"]
        })
      }
    });
  };

  /// new



  public registerQueueListeners(...listeners: ServerEventRegister<any, any>[]) {
    for (const listener of listeners) {
      if (this._registeredQueueListeners.has(listener.constructor.name)) continue;
      this._registeredQueueListeners.add(listener.constructor.name);
      listener.begin();
      this._runningQueueListeners.push(listener);
    }
  }

  public removeServerListeners(...listeners: ServerEventRegister<any, any>[]) {
    for (const listener of listeners) {
      console.log(listener.constructor.name)
      if (!this._registeredQueueListeners.has(listener.constructor.name)) continue;
      this._registeredQueueListeners.delete(listener.constructor.name);
      listener.end();
      this._runningQueueListeners = this._runningQueueListeners.filter(l => l.constructor.name !== listener.constructor.name);
    }
  }

  public removeAllQueueListeners() {
    this._registeredQueueListeners.clear();
    for (const listener of this._runningQueueListeners) {
      listener.end();
    }
    this._runningQueueListeners = [];
  }


}
