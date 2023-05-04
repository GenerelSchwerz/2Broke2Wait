const { ProxyServerPlugin } = require('@nxg-org/mineflayer-mitm-proxy')
const { goals, pathfinder } = require('mineflayer-pathfinder')

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
  connectedCmds = {
    goto: {
      usage: 'goto <x> <y> <z>',
      description: 'go from point A to point B',
      callable: this.gotoFunc.bind(this)
    },

    gotoXZ: {
      usage: 'gotoXZ <x> <z>',
      description: 'go from point A to point B, XZ',
      callable: this.gotoXZFunc.bind(this)
    },

    pathstop: {
      usage: 'pathstop',
      description: 'Stop mineflayer-pathfinder',
      callable: this.stop.bind(this)
    }
  }
  
  onInitialBotSetup = (bot) => {
    bot.loadPlugin(pathfinder);
  }

  async stop (client) {
    // these both exist due to how these commands are called.
    const bot = this.server.remoteBot
    const proxy = this.server.conn

    bot.pathfinder.setGoal(null)
    this.server.message(client, 'Stopped pathfinding!')
    this.syncClientToBot(client, bot)
    proxy.link(client)
  }

  async gotoFunc (client, x, y, z) {
    // these both exist due to how these commands are called.
    const bot = this.server.remoteBot

    if (client !== this.server.controllingPlayer) {
      this.server.message(client, 'You cannot cause the bot to go anywhere, you are not controlling it!')
      return
    }

    const numX = (x === '~') ? bot.entity.position.x : Number(x)
    const numY = (y === '~') ? bot.entity.position.y : Number(y)
    const numZ = (z === '~') ? bot.entity.position.z : Number(z)

    const goal = new goals.GoalBlock(numX, numY, numZ)

    this.server.message(client, `Moving to: ${numX} ${numY} ${numZ}`)

    await this.travelTo(client, goal)
  }

  async gotoXZFunc (client, x, z, range) {
    // these both exist due to how these commands are called.
    const bot = this.server.remoteBot

    if (client !== this.server.controllingPlayer) {
      this.server.message(client, 'You cannot cause the bot to go anywhere, you are not controlling it!')
      return
    }

    const numX = (x === '~') ? bot.entity.position.x : Number(x)
    const numZ = (z === '~') ? bot.entity.position.z : Number(z)
    const numRange = range ? Number(range) : 3

    this.server.message(client, `Moving to: (${numX}, ${numZ}) w/ range ${numRange}`)

    // unlink client so bot can move
    const goal = new goals.GoalNearXZ(numX, numZ, numRange)
    await this.travelTo(client, goal)
  }

  async travelTo (client, goal) {
    // these both exist due to how these commands are called.
    const bot = this.server.remoteBot
    const proxy = this.server.conn

    proxy.unlink()

    if (bot.pathfinder.isMoving()) {
      bot.pathfinder.setGoal(null)
    }

    try {
      await bot.pathfinder.goto(goal)
      this.server.message(client, 'Made it!')
      this.serverLog('Pathfinder:goto_success')
    } catch (e) {
      this.server.message(client, 'Did not make it...')
      this.serverLog('Pathfinder:goto_failure', e)
    }

    // basic clean up, then we're all good :thumbsup:
    finally {
      this.syncClientToBot(client, bot)
      proxy.link(client)
    }
  }

  // sync client back to bot's position
  syncClientToBot (client, bot) {
    client.write('position', {
      ...bot.entity.position,
      yaw: bot.entity.yaw,
      pitch: bot.entity.pitch,
      onGround: bot.entity.onGround
    })
  }
}

module.exports = new GotoPlacePlugin();
