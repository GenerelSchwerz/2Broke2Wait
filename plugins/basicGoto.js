const { ProxyServerPlugin } = require("@nxg-org/mineflayer-mitm-proxy");
const { goals, pathfinder } = require("mineflayer-pathfinder");

const { SpectatorServerPlugin } = require("../lib/localServer/builtinPlugins/spectator");
const { sleep } = require("../lib/util");

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
class GotoPlacePlugin extends ProxyServerPlugin {

  // rough patch
  opts = {
    pathfindSyncView: true,
    resumeAutonomousActivity: true
  }

  connectedCmds = {
    goto: {
      usage: "goto <x> <y> <z>",
      description: "go from point A to point B",
      callable: this.gotoFunc.bind(this),
    },

    gotoXZ: {
      usage: "gotoXZ <x> <z>",
      description: "go from point A to point B, XZ",
      callable: this.gotoXZFunc.bind(this),
    },

    pathstop: {
      usage: "pathstop",
      description: "Stop mineflayer-pathfinder",
      callable: this.stop.bind(this),
    },

    "pathfind:viewSync": {
      description: "Sync camera to moving bot",
      callable: this.setViewSync.bind(this)
    },

    "pathfind:resumeBotAuto": {
      description: "Resume bot autonomy after pathfind",
      callable: this.setResumeBot.bind(this)
    }
  };

  onInitialBotSetup = (bot) => {
    bot.loadPlugin(pathfinder);
  };

  setViewSync(client, val) {
    switch (val.toLowerCase()) {
      case "true":
        this.opts.pathfindSyncView = true
        this.server.message(client, `Pathfinding viewpoint has been set to true`)
        break
      case "false":
        this.opts.pathfindSyncView = false
        this.server.message(client, `Pathfinding viewpoint has been set to false`)
        break
      default:
        this.server.message(client, `Invalid entry \"${val}\". Needs to be true or false.`);
        break
    }
  }

  setResumeBot(client, val) {
    switch (val.toLowerCase()) {
      case "true":
        this.opts.resumeAutonomousActivity = true
        this.server.message(client, `Resume bot activity after pathfinding has been set to true`)
        break
      case "false":
        this.opts.resumeAutonomousActivity = false
        this.server.message(client, `Resume bot activity after pathfinding has been set to false`)
        break
      default:
        this.server.message(client, `Invalid entry \"${val}\". Needs to be true or false.`);
        break
    }
  }

  async stop(client) {
    // these both exist due to how these commands are called.
    const bot = this.server.remoteBot;
    bot.pathfinder.setGoal(null);
    this.server.message(client, "Stopped pathfinding!");
  }

  async gotoFunc(client, x, y, z) {
    // these both exist due to how these commands are called.
    const bot = this.server.remoteBot;

    const numX = x === "~" ? bot.entity.position.x : Number(x);
    const numY = y === "~" ? bot.entity.position.y : Number(y);
    const numZ = z === "~" ? bot.entity.position.z : Number(z);

    const goal = new goals.GoalBlock(numX, numY, numZ);

    this.server.message(client, `Moving to: ${numX} ${numY} ${numZ}`);

    await this.travelTo(client, goal);
  }

  async gotoXZFunc(client, x, z, range) {
    // these both exist due to how these commands are called.
    const bot = this.server.remoteBot;

    const numX = x === "~" ? bot.entity.position.x : Number(x);
    const numZ = z === "~" ? bot.entity.position.z : Number(z);
    const numRange = range ? Number(range) : 3;

    this.server.message(client, `Moving to: (${numX}, ${numZ}) w/ range ${numRange}`);

    // unlink client so bot can move
    const goal = new goals.GoalNearXZ(numX, numZ, numRange);
    await this.travelTo(client, goal);
  }

  async travelTo(client, goal) {
    // these both exist due to how these commands are called.
    const bot = this.server.remoteBot;
    const isLinked = this.server.inControl(client);

    if (isLinked) this.unlink(client);

    try {
      await bot.pathfinder.goto(goal);
      this.server.message(client, "Made it!");
      this.serverLog("Pathfinder:goto_success");
    } catch (e) {
      this.server.message(client, "Did not make it...");
      this.serverLog("Pathfinder:goto_failure", e);
    } finally {
      if (isLinked) this.link(client);
      else if (this.opts.resumeAutonomousActivity) this.server.beginBotLogic();
    }
  }
}

module.exports = new GotoPlacePlugin();
