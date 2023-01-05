import { ProxyServer } from "../abstract/proxyServer";
import { Bot, BotOptions, Plugin } from "mineflayer";
import { ServerOptions, createServer, Server } from "minecraft-protocol";
import { IProxyServerOpts } from "../abstract/proxyServer";
import { Conn } from "@rob9315/mcproxy";
import antiAFK, {
  DEFAULT_MODULES,
  DEFAULT_PASSIVES,
} from "@nxg-org/mineflayer-antiafk";
import autoEat from "@nxg-org/mineflayer-auto-eat";

export interface AntiAFKOpts extends IProxyServerOpts {
  antiAFK: boolean;
  autoEat: boolean;
}

export class AntiAFKServer extends ProxyServer<AntiAFKOpts> {
  public constructor(
    reuseServer: boolean,
    onlineMode: boolean,
    server: Server,
    proxy: Conn,
    opts: Partial<AntiAFKOpts>
  ) {
    super(reuseServer, onlineMode, server, proxy, opts);
  }

  /**
   * Creates Proxy server based on given arguments.
   *
   * Does NOT re-use the server.
   * @param {BotOptions} bOptions Mineflayer bot options.
   * @param {Plugin[]} plugins Mineflayer bot plugins to load into the remote bot.
   * @param {ServerOptions} sOptions Minecraft-protocol server options.
   * @param {Partial<IProxyServerOpts>} psOptions Partial list of ProxyServer options.
   * @returns {ProxyServer} Built proxy server.
   */
  public static createServer(
    bOptions: BotOptions,
    plugins: Plugin[],
    sOptions: ServerOptions,
    psOptions: Partial<AntiAFKOpts>
  ): AntiAFKServer {
    const conn = new Conn(bOptions);
    conn.stateData.bot.loadPlugins(plugins);
    return new AntiAFKServer(
      true,
      !!sOptions["online-mode"],
      createServer(sOptions),
      conn,
      psOptions
    );
  }

  protected override optionValidation(): AntiAFKOpts {
    this.opts.antiAFK = this.opts.antiAFK && this.remoteBot.hasPlugin(antiAFK);
    this.opts.autoEat = this.opts.autoEat && this.remoteBot.hasPlugin(autoEat);
    return this.opts;
  }

  protected override initialBotSetup(bot: Bot): void {

    if (this.opts.antiAFK) {
      bot.loadPlugin(antiAFK);
      bot.antiafk.on("moduleStarted", (mod) =>
        console.log(mod.constructor.name)
      );

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

    if (this.opts.autoEat) {
      bot.loadPlugin(autoEat);
      bot.autoEat.enable();


      bot.autoEat.setOptions({
        eatUntilFull: true,
        eatingTimeout: 3000,
        minHealth: 12,
        minHunger: 15,
        returnToLastItem: true,
        useOffHand: true,
        bannedFood: [ "rotten_flesh", "pufferfish", "chorus_fruit", "poisonous_potato", "spider_eye" ]
      })
    }
  }

  protected override beginBotLogic() {
    if (this.opts.antiAFK) {
      this.remoteBot.antiafk.start();
    }

    if (this.opts.autoEat) {
      this.remoteBot.autoEat.enable();
    }
  }

  protected override endBotLogic() {
    if (this.opts.antiAFK) {
      this.remoteBot.antiafk.forceStop();
    }

    if (this.opts.autoEat) {
      this.remoteBot.autoEat.disable();
    }
  }
}
