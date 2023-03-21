import { IProxyServerEvents, ProxyServer, IProxyServerOpts } from '../abstract/proxyServer'
import { Bot, BotOptions, BotEvents } from 'mineflayer'
import {
  Server
} from 'minecraft-protocol'
import { Conn, ConnOptions } from '@rob9315/mcproxy'
import antiAFK, {
  AllPassiveSettings,
  DEFAULT_MODULES,
  DEFAULT_PASSIVES,
  AllModuleSettings, MODULE_DEFAULT_SETTINGS,
  unloadDefaultModules
} from '@nxg-org/mineflayer-antiafk'
import autoEat from '@nxg-org/mineflayer-auto-eat'
import { PacketQueuePredictor, PacketQueuePredictorEvents } from '../abstract/packetQueuePredictor'
import { CombinedPredictor } from './combinedPredictor'
import { pathfinder } from 'mineflayer-pathfinder'
import merge from 'ts-deepmerge'
import { WalkAroundModuleOptions } from '@nxg-org/mineflayer-antiafk/lib/modules/index'


export interface AntiAFKOpts extends IProxyServerOpts, Partial<AllModuleSettings>, Partial<AllPassiveSettings> {
  antiAFK: boolean;
  autoEat: boolean;
}

export interface AntiAFKEvents extends IProxyServerEvents, PacketQueuePredictorEvents {
  botSpawn: (bot: Bot) => void
  health: (bot: Bot) => void
  breath: (bot: Bot) => void
  '*': AntiAFKEvents[Exclude<keyof AntiAFKEvents, '*'>]
}
export type StrictAntiAFKEvents = Omit<AntiAFKEvents, '*'>

export class AntiAFKServer<
    Opts extends AntiAFKOpts = AntiAFKOpts, 
    Events extends StrictAntiAFKEvents = StrictAntiAFKEvents
  > extends ProxyServer<Opts, Events> {
  
  private _queue?: PacketQueuePredictor<any, any>

  public get queue () {
    return this._queue
  }

  public constructor (
    onlineMode: boolean,
    server: Server,
    bOpts: BotOptions,
    cOpts: Partial<ConnOptions> = {},
    psOpts: Partial<Opts>
  ) {
    super(onlineMode, server, bOpts, cOpts, psOpts)
    this.cmdHandler.loadProxyCommands({
      stop: this.stop
    })
    this.cmdHandler.loadDisconnectedCommands({
      start: this.start
    })
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
  public static wrapServer (
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
    )
  }

  public setupAntiAfk = (): void => {
    if (this.remoteBot == null) return
    this.remoteBot.on('health', () => { this.emit('health' as any, this.remoteBot) })
    this.remoteBot.on('breath', () => { this.emit('breath' as any, this.remoteBot) })
    this.remoteBot.on('spawn', () => { this.emit('botSpawn' as any, this.remoteBot) })
    this.remoteBot.once('spawn', () => this.beginBotLogic())
  }

  public override start (): Conn {
    if (this.isProxyConnected()) return this._proxy as Conn
    const conn = super.start()
    this.setupAntiAfk();
    this._queue = new CombinedPredictor(conn)
    this._queue.begin()
    this._queue.on('*', (...args: any[]) => { this.emit((this._queue as any).event, ...args) })
    return conn
  }

  public override stop () {
    if (!this.isProxyConnected()) return
    if (this._queue != null) this._queue.end()
    this.emit('leftQueue' as any)
    super.stop()
  }

  protected override optionValidation () {
    if (this.remoteBot == null) return this.psOpts
    this.psOpts = merge(MODULE_DEFAULT_SETTINGS(this.remoteBot), this.psOpts) as any;
    this.psOpts.antiAFK = this.psOpts.antiAFK && this.remoteBot.hasPlugin(antiAFK)
    this.psOpts.autoEat = this.psOpts.autoEat && this.remoteBot.hasPlugin(autoEat)
    return this.psOpts
  }

  protected override initialBotSetup (bot: Bot): void {
    if (this.psOpts.antiAFK) {
      bot.loadPlugin(pathfinder)
      bot.loadPlugin(antiAFK)
      // unloadDefaultModules(bot)

      if (DEFAULT_MODULES.WalkAroundModule != null) {
        bot.antiafk.addModules(DEFAULT_MODULES.WalkAroundModule)
        bot.antiafk.setOptionsForModule(DEFAULT_MODULES.WalkAroundModule, {
          ...WalkAroundModuleOptions.TwoBTwoT(bot),
          ...this.psOpts.WalkAroundModule
        })
      }

      if (DEFAULT_MODULES.BlockBreakModule != null) {
        bot.antiafk.setOptionsForModule(DEFAULT_MODULES.BlockBreakModule, {
          enabled: true,
          ...this.psOpts.BlockBreakModule
        })
      }

      bot.antiafk.setOptionsForModule(DEFAULT_MODULES.RandomMovementModule, {
        enabled: false,
        ...this.psOpts.RandomMovementModule
      }),

      bot.antiafk.setOptionsForModule(DEFAULT_MODULES.LookAroundModule, {
        enabled: true,
        ...this.psOpts.LookAroundModule
      })

      bot.antiafk.setOptionsForPassive(DEFAULT_PASSIVES.KillAuraPassive, {
        enabled: true,
        ...this.psOpts.KillAuraPassive
      })
    }

    if (this.psOpts.autoEat) {
      bot.loadPlugin(autoEat)

      bot.autoEat.setOptions({
        eatUntilFull: true,
        eatingTimeout: 3000,
        minHealth: 14,
        minHunger: 15,
        returnToLastItem: true,
        useOffHand: true,
        bannedFood: [
          'rotten_flesh',
          'pufferfish',
          'chorus_fruit',
          'poisonous_potato',
          'spider_eye'
        ]
      })
    }
  }

  protected override beginBotLogic (): void {
    if (this.remoteBot == null) return
    const inQueue = this._queue != null ? this._queue.inQueue : false
    if (this.psOpts.antiAFK && !inQueue) {
  
      this.remoteBot.antiafk.start()
    }

    if (this.psOpts.autoEat && !inQueue) {
      this.remoteBot.autoEat.enableAuto()
    }
  }

  public override endBotLogic (): void {
    if (this.remoteBot == null) return
    if (this.psOpts.antiAFK) {
      this.remoteBot.antiafk.forceStop()
    }

    if (this.psOpts.autoEat) {
      this.remoteBot.autoEat.disableAuto()
    }
  }
}
