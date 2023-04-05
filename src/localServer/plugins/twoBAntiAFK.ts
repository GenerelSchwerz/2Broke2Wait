import antiAFK, {
  AllModuleSettings,
  AllPassiveSettings,
  DEFAULT_MODULES,
  DEFAULT_PASSIVES,
} from "@nxg-org/mineflayer-antiafk";
import autoEat from "@nxg-org/mineflayer-auto-eat";
import { MODULE_DEFAULT_SETTINGS, WalkAroundModuleOptions } from "@nxg-org/mineflayer-antiafk/lib/modules/index";
import { Conn } from "@rob9315/mcproxy";
import { Bot } from "mineflayer";
import { pathfinder } from "mineflayer-pathfinder";
import { PacketQueuePredictor, PacketQueuePredictorEvents } from "../../abstract/packetQueuePredictor";
import { CombinedPredictor } from "../predictors/combinedPredictor";
import { IProxyServerOpts, IProxyServerEvents, ProxyServerPlugin } from "../baseServer";
import merge from "ts-deepmerge";

export interface TwoBAntiAFKOpts extends IProxyServerOpts {
  antiAFK: {
    enabled: boolean;
    modules: Partial<AllModuleSettings>;
    passives: Partial<AllPassiveSettings>;
  };
  autoEat: boolean;
}

export interface TwoBAntiAFKEvents extends IProxyServerEvents, PacketQueuePredictorEvents {}

export class TwoBAntiAFKPlugin extends ProxyServerPlugin<TwoBAntiAFKOpts, TwoBAntiAFKEvents> {
  name = "AntiAFK";

  private _queue?: PacketQueuePredictor<any, any>;
  public get queue() {
    return this._queue;
  }

  onPreStart =(conn: Conn) => {
    this._queue = new CombinedPredictor(conn);
    this._queue.begin();
    this._queue.on("*", (...args: any[]) => {
      this.serverEmit((this._queue as any).event, ...args);
    });
  }

  onPreStop =() => {
    if (this._queue != null) this._queue.end();
  }

  onOptionValidation =(bot: Bot): void => {
    // set configurations to default.
    this.setServerOpts(merge(MODULE_DEFAULT_SETTINGS(bot), this.psOpts));
  }

  onInitialBotSetup = (bot: Bot) => {
    if (this.psOpts.antiAFK.enabled) {
      bot.loadPlugin(pathfinder);
      bot.loadPlugin(antiAFK);

      if (DEFAULT_MODULES.WalkAroundModule != null) {
        bot.antiafk.addModules(DEFAULT_MODULES.WalkAroundModule);

        if (this.server.bOpts.host?.includes("2b2t")) {
          bot.antiafk.setOptionsForModule(DEFAULT_MODULES.WalkAroundModule, WalkAroundModuleOptions.TwoBTwoT(bot));
        }

        if (this.psOpts.antiAFK.modules.WalkAroundModule != null) {
          bot.antiafk.setOptionsForModule(
            DEFAULT_MODULES.WalkAroundModule,
            this.psOpts.antiAFK.modules.WalkAroundModule
          );
        }
      }

      if (DEFAULT_MODULES.BlockBreakModule != null && this.psOpts.antiAFK.modules.BlockBreakModule != null) {
        bot.antiafk.setOptionsForModule(DEFAULT_MODULES.BlockBreakModule, this.psOpts.antiAFK.modules.BlockBreakModule);
      }

      if (this.psOpts.antiAFK.modules.RandomMovementModule != null) {
        bot.antiafk.setOptionsForModule(
          DEFAULT_MODULES.RandomMovementModule,
          this.psOpts.antiAFK.modules.RandomMovementModule
        );
      }

      if (this.psOpts.antiAFK.modules.LookAroundModule != null) {
        bot.antiafk.setOptionsForModule(DEFAULT_MODULES.LookAroundModule, this.psOpts.antiAFK.modules.LookAroundModule);
      }

      if (this.psOpts.antiAFK.modules.ChatBotModule != null) {
        bot.antiafk.setOptionsForModule(DEFAULT_MODULES.ChatBotModule, this.psOpts.antiAFK.modules.ChatBotModule);
      }

      if (this.psOpts.antiAFK.passives.KillAuraPassive != null) {
        bot.antiafk.setOptionsForPassive(
          DEFAULT_PASSIVES.KillAuraPassive,
          this.psOpts.antiAFK.passives.KillAuraPassive
        );
      }
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
        bannedFood: ["rotten_flesh", "pufferfish", "chorus_fruit", "poisonous_potato", "spider_eye"],
      });
    }
  }

  onBotStartup = (bot: Bot) => {
    if (this._queue == null) throw "Somehow bot is starting without queue being initialized!";
    if (this.psOpts.antiAFK && !this._queue.inQueue) bot.antiafk.start();
    if (this.psOpts.autoEat && !this._queue.inQueue) bot.autoEat.enableAuto();
  }

  onBotShutdown = (bot: Bot) => {
    if (this.psOpts.antiAFK) bot.antiafk.forceStop();
    if (this.psOpts.autoEat) bot.autoEat.disableAuto();
  }
}


