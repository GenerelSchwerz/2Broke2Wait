import { ProxyServer } from "../abstract/proxyServer";
import { Bot, BotOptions, Plugin } from "mineflayer";
import { ServerOptions, createServer, Server } from "minecraft-protocol";
import { IProxyServerOpts } from "../abstract/proxyServer";
import { Conn } from "@rob9315/mcproxy";
import antiAFK, {unloadDefaultModules, MODULE_DEFAULT_SETTINGS, DEFAULT_MODULES, DEFAULT_PASSIVES} from "@nxg-org/mineflayer-antiafk"


export interface AntiAFKOpts extends IProxyServerOpts {
    antiAFK: boolean
}

export class AntiAFKServer extends ProxyServer<AntiAFKOpts> {

    public constructor(
        reuseServer: boolean,
        onlineMode: boolean,
        server: Server,
        proxy: Conn,
        opts: Partial<AntiAFKOpts> = {antiAFK: false}
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
    psOptions: Partial<AntiAFKOpts> = {antiAFK: false}
  ): AntiAFKServer {
    const conn = new Conn(bOptions);
    conn.stateData.bot.loadPlugins(plugins);
    return new AntiAFKServer(false, sOptions["onlineMode"], createServer(sOptions), conn, psOptions);
  }

  /**
   * Creates Proxy server based on given arguments.
   * 
   * DOES re-use the server.
   * @param {Server} server running Minecraft-protocol server.
   * @param {BotOptions} bOptions Mineflayer bot options.
   * @param {Plugin[]} plugins Mineflayer bot plugins to load into the remote bot.
   * @param {Partial<IProxyServerOpts>} psOptions Partial list of ProxyServer options.
   * @returns {ProxyServer} Built proxy server.
   */
  public static ProxyServerReuseServer(
    server: Server,
    bOptions: BotOptions,
    plugins: Plugin[],
    psOptions: Partial<AntiAFKOpts> = {antiAFK: false}
  ): AntiAFKServer {
    const conn = new Conn(bOptions);
    conn.stateData.bot.loadPlugins(plugins);
    return new AntiAFKServer(true, false, server, conn, psOptions);
  }


  protected override optionValidation(): AntiAFKOpts {
    this.opts.antiAFK = this.opts.antiAFK && !!this.remoteBot.hasPlugin(antiAFK);
    return this.opts;
  }


  protected override initialBotSetup(bot: Bot): void {
    if (this.opts.antiAFK) {
      bot.loadPlugin(antiAFK);
      bot.antiafk.on('moduleStarted', (mod) => console.log(mod.constructor.name))

      bot.antiafk.setOptionsForModule(DEFAULT_MODULES["LookAroundModule"], {
        enabled: true
      })
  
      bot.antiafk.setOptionsForModule(DEFAULT_MODULES["ChatBotModule"], {
        enabled: true,
        delay: 2000
      })
  
      bot.antiafk.setOptionsForModule(DEFAULT_MODULES["WalkAroundModule"], {
        enabled: true,
        timeout: 10000,
      })

      bot.antiafk.setOptionsForPassive(DEFAULT_PASSIVES["KillAuraPassive"], {
        enabled: true,
        playerWhitelist: new Set(["Generel_Schwerz"])
      })
    }
  }

  protected override beginBotLogic() {
    if (this.opts.antiAFK) {
        this.remoteBot.antiafk.start();
    }
  }

  protected override endBotLogic() {
    if (this.opts.antiAFK) {
        this.remoteBot.antiafk.forceStop();
    }
  }
}
