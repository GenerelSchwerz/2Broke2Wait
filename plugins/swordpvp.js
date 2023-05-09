const { ProxyServerPlugin, CmdPerm } = require("@nxg-org/mineflayer-mitm-proxy");
const { goals, pathfinder } = require("mineflayer-pathfinder");
const { default: customPVP } = require("@nxg-org/mineflayer-custom-pvp");

const { SpectatorServerPlugin } = require("../lib/localServer/builtinPlugins/spectator");
const { TwoBAntiAFKPlugin } = require("../lib/localServer/builtinPlugins/twoBAntiAFK");
const { sleep } = require("../lib/util");

const { once } = require("events");

/**
 * Gen here again.
 *
 * Example plugin to go from point A to point B.
 *
 * I will include this plugin in the main project as a POC.
 *
 * Note: this does not leverage the spectator setting present in most of the proxy.
 *  That is because that is a separate plugin. That is intentional.
 *  This is purposefully simple so it can be easy to follow.
 *
 */
class SwordPVPPlugin extends ProxyServerPlugin {
  connectedCmds = {
    "swordpvp:attack": {
      usage: "attack <entity username/name>",
      description: "Attack entity with identifier",
      callable: this.attack.bind(this),
    },

    "swordpvp:stop": {
      description: "stop attacking",
      callable: this.stop.bind(this),
    },
  };

  wantedTarget = null;

  onInitialBotSetup = (bot) => {
    bot.loadPlugin(pathfinder);
    bot.loadPlugin(customPVP);
  };

  setupAttack(client) {
    const bot = this.server.remoteBot;

    this.server.endBotLogic();

    bot.autoEat.enableAuto();
    const oldOffhand = bot.autoEat.opts.offhand;
    bot.autoEat.setOpts({offhand: true}) 

    const listener = () => {

      // if (this.wantedTarget == null) {
      //   bot.off("physicsTick", listener);
      //   this.stop(client);
      //   bot.autoEat.setOpts({offhand: oldOffhand})
      //   this.server.beginBotLogic();
      //   return
      // }
      
      const e = bot.nearestEntity((e) => e.username?.includes(this.wantedTarget) || e.name?.includes(this.wantedTarget));
      if (e == null) {
        this.server.message(client, `Could not find entity with identifier: ${this.wantedTarget}`);
        bot.off("physicsTick", listener);
        this.stop(client);
        bot.autoEat.setOpts({offhand: oldOffhand})
        this.server.beginBotLogic();
        return;
      }

      switch (e.type) {
        case "player":
          bot.swordpvp.options.followConfig.distance = 3;
          bot.swordpvp.options.tapConfig.mode = "stap";
          bot.swordpvp.options.genericConfig.tooCloseRange = 1.5;
          break;
        case "mob":
        default:
          bot.swordpvp.options.followConfig.distance = 3;
          bot.swordpvp.options.tapConfig.mode = "stap";
          bot.swordpvp.options.genericConfig.tooCloseRange = e.name === "skeleton" ? 0 : 2.5;
          break;
      }

      if (!bot.swordpvp.target || !bot.swordpvp.target.isValid) 
        bot.swordpvp.attack(e);
      else {
        const dist = bot.entity.position.distanceTo(e.position);
        if (dist < bot.swordpvp.target.position.distanceTo(bot.entity.position))  {
            const maxticks = bot.swordpvp.meleeAttackRate.getTicks(bot.heldItem) - 1
            if (bot.swordpvp.ticksToNextAttack >= maxticks || bot.swordpvp.ticksToNextAttack == 0)
                bot.swordpvp.attack(e);
        }
      }
    };

    bot.on("physicsTick", listener);
  }

  async attack(client, ident) {
    this.wantedTarget = ident;
    this.server.message(client, `Attacking entity: ${ident}`);
    this.unlink(client, true);
    if (!this.server.remoteBot.swordpvp.target) this.setupAttack(client);
  }

  async stop(client) {
    this.wantedTarget = null;
    this.server.remoteBot.swordpvp.stop();
    this.link(client)
    this.server.message(client, `Stopping sword pvp!`);
  }

  link(client) {
    const spectator = this.server.getPlugin(SpectatorServerPlugin);
    if (spectator) spectator.link(client);
    else {
      this.server.conn.link(client);
      client.write("position", {
        ...bot.entity.position,
        yaw: bot.entity.yaw,
        pitch: bot.entity.pitch,
        onGround: bot.entity.onGround,
      });
    }
  }

  unlink(client, syncview = this.opts.pathfindSyncView) {
    const spectator = this.server.getPlugin(SpectatorServerPlugin);
    if (spectator) {
      spectator.unlink(client);
      if (syncview) spectator.makeViewFakePlayer(client);
    } else this.server.conn.unlink();
  }
}

module.exports = new SwordPVPPlugin();
