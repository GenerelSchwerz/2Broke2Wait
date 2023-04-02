import antiAFK, {
  AllModuleSettings,
  AllPassiveSettings,
  DEFAULT_MODULES,
  DEFAULT_PASSIVES
} from '@nxg-org/mineflayer-antiafk'
import autoEat from '@nxg-org/mineflayer-auto-eat'
import { MODULE_DEFAULT_SETTINGS, WalkAroundModuleOptions } from '@nxg-org/mineflayer-antiafk/lib/modules/index'
import { Conn } from '@rob9315/mcproxy'
import { Bot } from 'mineflayer'
import { pathfinder } from 'mineflayer-pathfinder'
import { PacketQueuePredictor, PacketQueuePredictorEvents } from '../abstract/packetQueuePredictor'
import { CombinedPredictor } from '../impls/combinedPredictor'
import { IProxyServerOpts, IProxyServerEvents, ProxyServerPlugin } from './newProxyServer'
import merge from 'ts-deepmerge'

export interface AntiAFKOpts extends IProxyServerOpts {
  antiAFK: {
    enabled: boolean
    modules: Partial<AllModuleSettings>
    passives: Partial<AllPassiveSettings>
  }
  autoEat: boolean
}

export interface AntiAFKEvents<Opts extends AntiAFKOpts = AntiAFKOpts> extends IProxyServerEvents<Opts>, PacketQueuePredictorEvents {
  '*': AntiAFKEvents<Opts>[Exclude<keyof AntiAFKEvents<Opts>, '*'>]
}
export type StrictAntiAFKEvents<Opts extends AntiAFKOpts = AntiAFKOpts> = Omit<AntiAFKEvents<Opts>, '*'>

export class AntiAFKServerPlugin extends ProxyServerPlugin<AntiAFKOpts, StrictAntiAFKEvents> {
  private _queue?: PacketQueuePredictor<any, any>
  public get queue () {
    return this._queue
  }

  public name = 'AntiAFK'

  onPreStart = (conn: Conn) => {
    this._queue = new CombinedPredictor(conn)
    this._queue.begin()
    this._queue.on('*', (...args: any[]) => {
      this.serverEmit((this._queue as any).event, ...args)
    })
  }

  onPreStop = () => {
    if (this._queue != null) this._queue.end()
  }

  /**
   * This should probably be modified.
   * @param psOpts
   * @param bot
   * @returns
   */
  onOptionValidation = (psOpts: AntiAFKOpts, bot: Bot): AntiAFKOpts => {
    return merge(MODULE_DEFAULT_SETTINGS(bot), psOpts)
  }

  onInitialBotSetup = (bot: Bot, psOpts: AntiAFKOpts) => {
    if (psOpts.antiAFK) {
      bot.loadPlugin(pathfinder)
      bot.loadPlugin(antiAFK)

      if (DEFAULT_MODULES.WalkAroundModule != null) {
        bot.antiafk.addModules(DEFAULT_MODULES.WalkAroundModule)

        if (this.server.bOpts.host?.includes('2b2t')) {
          bot.antiafk.setOptionsForModule(DEFAULT_MODULES.WalkAroundModule, WalkAroundModuleOptions.TwoBTwoT(bot))
        }

        if (psOpts.antiAFK.modules.WalkAroundModule != null) {
          bot.antiafk.setOptionsForModule(DEFAULT_MODULES.WalkAroundModule, psOpts.antiAFK.modules.WalkAroundModule)
        }
      }

      if (DEFAULT_MODULES.BlockBreakModule != null && psOpts.antiAFK.modules.BlockBreakModule != null) {
        bot.antiafk.setOptionsForModule(DEFAULT_MODULES.BlockBreakModule, psOpts.antiAFK.modules.BlockBreakModule)
      }

      if (psOpts.antiAFK.modules.RandomMovementModule != null) {
        bot.antiafk.setOptionsForModule(
          DEFAULT_MODULES.RandomMovementModule,
          psOpts.antiAFK.modules.RandomMovementModule
        )
      }

      if (psOpts.antiAFK.modules.LookAroundModule != null) {
        bot.antiafk.setOptionsForModule(DEFAULT_MODULES.LookAroundModule, psOpts.antiAFK.modules.LookAroundModule)
      }

      if (psOpts.antiAFK.modules.ChatBotModule != null) {
        bot.antiafk.setOptionsForModule(DEFAULT_MODULES.ChatBotModule, psOpts.antiAFK.modules.ChatBotModule)
      }

      if (psOpts.antiAFK.passives.KillAuraPassive != null) {
        bot.antiafk.setOptionsForPassive(DEFAULT_PASSIVES.KillAuraPassive, psOpts.antiAFK.passives.KillAuraPassive)
      }
    }

    if (psOpts.autoEat) {
      bot.loadPlugin(autoEat)

      bot.autoEat.setOptions({
        eatUntilFull: true,
        eatingTimeout: 3000,
        minHealth: 14,
        minHunger: 15,
        returnToLastItem: true,
        useOffHand: true,
        bannedFood: ['rotten_flesh', 'pufferfish', 'chorus_fruit', 'poisonous_potato', 'spider_eye']
      })
    }
  }

  onBotStartup = (bot: Bot, psOpts: AntiAFKOpts) => {
    if (this._queue == null) throw ('Somehow bot is starting without queue being initialized!')
    if (psOpts.antiAFK && !this._queue.inQueue) bot.antiafk.start()
    if (psOpts.autoEat && !this._queue.inQueue) bot.autoEat.enableAuto()
  }

  onBotShutdown = (bot: Bot, psOpts: AntiAFKOpts) => {
    if (psOpts.antiAFK) bot.antiafk.forceStop()
    if (psOpts.autoEat) bot.autoEat.disableAuto()
  }
}
