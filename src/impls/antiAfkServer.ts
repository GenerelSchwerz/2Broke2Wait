import { IProxyServerEvents, ProxyServer } from "../abstract/proxyServer";
import { Bot, BotOptions, BotEvents } from "mineflayer";
import {
  ServerOptions,
  createServer,
  Server,
  ServerClient,
  PacketMeta,
  Client
} from "minecraft-protocol";
import { IProxyServerOpts } from "../abstract/proxyServer";
import { Conn, ConnOptions } from "@rob9315/mcproxy";
import antiAFK, {
  DEFAULT_MODULES,
  DEFAULT_PASSIVES,
  unloadDefaultModules
} from "@nxg-org/mineflayer-antiafk";
import autoEat from "@nxg-org/mineflayer-auto-eat";
import { PacketQueuePredictor, PacketQueuePredictorEvents } from "../abstract/packetQueuePredictor";
import { ClientEventRegister, ServerEventRegister } from "../abstract/eventRegisters";
import { CombinedPredictor } from "./combinedPredictor";

export interface AntiAFKOpts extends IProxyServerOpts {
  antiAFK: boolean;
  autoEat: boolean;
}


export interface AntiAFKEvents extends IProxyServerEvents, PacketQueuePredictorEvents {
  "botSpawn": (bot: Bot) => void,
  "health":(bot: Bot) => void,
  "breath":(bot: Bot) => void,
  "*": AntiAFKEvents[Exclude<keyof AntiAFKEvents, "*">];
}
export type StrictAntiAFKEvents = Omit<AntiAFKEvents, "*">

export class AntiAFKServer<Opts extends AntiAFKOpts = AntiAFKOpts, Events extends StrictAntiAFKEvents = StrictAntiAFKEvents> extends ProxyServer<Opts, Events> {

  private _queue: PacketQueuePredictor<any, any>;

  public get queue() {
    return this._queue;
  }

  private _registeredQueueListeners: Set<string> = new Set();
  private _runningQueueListeners: any[] = [];

  public constructor(
    onlineMode: boolean,
    server: Server,
    bOpts: BotOptions,
    cOpts: Partial<ConnOptions> = {},
    psOpts: Partial<Opts>
  ) {
    super(onlineMode, server, bOpts, cOpts, psOpts);
    this.convertToDisconnected();
  }

  /**
   * Creates Proxy server based on given arguments.
   *
   * DOES re-use the server.
   * @param {BotOptions} bOptions Mineflayer bot options.
   * @param {Plugin[]} plugins Mineflayer bot plugins to load into the remote bot.
   * @param {ServerOptions} sOptions Minecraft-protocol server options.
   * @param {Partial<IProxyServerOpts>} psOptions Partial list of ProxyServer options.
   * @returns {ProxyServer} Built proxy server.
   */
  public static wrapServer(
    online: boolean,
    server: Server,
    bOpts: BotOptions,
    cOpts: Partial<ConnOptions> = {},
    psOptions: Partial<AntiAFKOpts> = {}
  ): AntiAFKServer {
    return new AntiAFKServer(
      online,
      server,
      bOpts,
      cOpts,
      psOptions
    );
  }

  public override setupProxy(): void {
      super.setupProxy();
      this.remoteBot!.on("health", () => { this.emit("health" as any, this.remoteBot) });
      this.remoteBot!.on("breath", () => { this.emit("breath" as any, this.remoteBot) });
      this.remoteBot!.on("spawn", () => { this.emit("botSpawn" as any, this.remoteBot) });
  }


  public override start(): Conn {
    if (this.isProxyConnected()) return this._proxy!;
    const conn = super.start();
    this._queue = new CombinedPredictor(conn);
    this._queue.begin();
    this._queue.on("*", (...args: any[]) => { this.emit(this._queue["event"], ...args); });
    return conn;
  }
  
  public override stop() {
    if (!this.isProxyConnected()) return;
    this._queue.end();
    super.stop();
  }

  protected override optionValidation = () => {
    this.psOpts.antiAFK = this.psOpts.antiAFK && this.remoteBot!.hasPlugin(antiAFK);
    this.psOpts.autoEat = this.psOpts.autoEat && this.remoteBot!.hasPlugin(autoEat);
    return this.psOpts;
  }

  protected override initialBotSetup(bot: Bot): void {
    if (this.psOpts.antiAFK) {
      bot.loadPlugin(antiAFK);
      unloadDefaultModules(bot);
      bot.antiafk.addModules(
        // DEFAULT_MODULES["BlockBreakModule"]!, 
        // DEFAULT_MODULES["LookAroundModule"], 
        DEFAULT_MODULES["WalkAroundModule"]!,
        // DEFAULT_MODULES["ChatBotModule"]
      );

      bot.antiafk.on('moduleStarted', (module) => console.log("started", module.constructor.name, ))


      bot.antiafk.on('moduleCompleted', (module, success, reason) => console.log("completed", module.constructor.name, success, reason))



      bot.antiafk.setOptionsForModule(DEFAULT_MODULES["BlockBreakModule"]!, {
        enabled: true,
      });

      bot.antiafk.setOptionsForModule(DEFAULT_MODULES["LookAroundModule"], {
        enabled: true,
      });

      bot.antiafk.setOptionsForModule(DEFAULT_MODULES["WalkAroundModule"]!, {
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
      this.remoteBot!.antiafk.start();
    }

    if (this.psOpts.autoEat && !this._queue.inQueue) {
      this.remoteBot!.autoEat.enable();
    }
  }

  public override endBotLogic = () => {
    if (this.psOpts.antiAFK) {
      this.remoteBot?.antiafk.forceStop();
    }

    if (this.psOpts.autoEat) {
      this.remoteBot?.autoEat.disable();
    }
  }

  /**
    * This WILL be moved later.
    * @param actualUser 
    */
  protected override notConnectedCommandHandler(actualUser: ServerClient) {
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
  protected whileConnectedCommandHandler(actualUser: ServerClient) {

    actualUser.on("chat", ({ message }: { message: string }, packetMeta: PacketMeta) => {
      switch (message) {
        case "/quit":
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
}
