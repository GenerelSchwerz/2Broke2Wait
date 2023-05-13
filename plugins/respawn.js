const { once } = require("node:events");
const { ProxyServerPlugin } = require("@nxg-org/mineflayer-mitm-proxy");
const { goals, pathfinder } = require("mineflayer-pathfinder");

const sleep = (ms) => new Promise((res, rej) => setTimeout(res, ms));
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
class RespawnPlugin extends ProxyServerPlugin {
  opts = {
    respawnTime: 3000,
  };

  universalCmds = {
    respawnTime: {
      usage: "[number in ms]",
      description: "set respawn timer (when player is linked)",
      callable: this.setRespawnTime.bind(this),
    },
  };

  setRespawnTime(client, num) {
    const n = Number(num);
    if (Number.isNaN(n)) return this.server.message(client, `Number "${num} is not a number!`);

    this.opts.respawnTime = num;
    this.server.message(client, `Set respawn timer to "${num} ms!`);
  }

  onLoad(server) {
    super.onLoad(server);
    this.serverOn("botevent_death", this.onBotDeath);
  }

  async onBotDeath(bot) {
    if (!this.server.controllingPlayer) return;
    const controller = this.server.controllingPlayer;
    await sleep(this.opts.respawnTime);
    this.unlink(controller);
    bot._client.write("client_command",{payload:0})     // method for respawning.
    await once(this.server, "botevent_spawn");          // wait for client to spawn.
    await sleep(200);                                   // allow for entity spawning to be processed for our client.
    this.link(controller);
  }
}

module.exports = new RespawnPlugin();
