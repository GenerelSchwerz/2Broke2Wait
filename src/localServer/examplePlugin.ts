import { Client, Conn } from '@icetank/mcproxy'
import { ServerClient } from 'minecraft-protocol'
import { IProxyServerEvents, IProxyServerOpts, ProxyServer, ProxyServerPlugin } from '@nxg-org/mineflayer-mitm-proxy'
import { CommandMap } from '../util/commandHandler'
import { PartiallyComputedPath, goals } from 'mineflayer-pathfinder'
import type { BossBar, Bot, DisplaySlot, Effect, Instrument, Particle, Player, ScoreBoard, Team } from 'mineflayer'

/**
 * Usage:
 */
//
//  const plugin = new ExamplePlugin()
//
//  const server = new ServerBuilder(serverOptions, bOpts)
//      .setSettings({...})
//      .build()
//
//  server.loadPlugin(plugin);
//
//

import type { Entity } from 'prismarine-entity'
import { WebhookClient } from 'discord.js'
import { sleep } from '../util'
import { once } from 'events'
import { Block } from 'prismarine-block'
import { ChatMessage } from 'prismarine-chat'
import { Window } from 'prismarine-windows'
import { Vec3 } from 'vec3'

/**
 * Gen here.
 *
 * This is an example plugin to make the server print hi whenever it starts.
 *
 * Yes, this is literally it.
 */
class ExamplePlugin extends ProxyServerPlugin {
  onPostStart = () => {
    console.log('hi')
  }
}
export class ProximityPlugin extends ProxyServerPlugin {
  public minDistance = 32
  public whClient: WebhookClient

  constructor (whUrl: string) {
    super()
    this.whClient = new WebhookClient({ url: whUrl })
  }

  public onLoad (server: ProxyServer): void {
    super.onLoad(server)
    this.serverOn('botevent_entityMoved', this.onEntitySpawn)
  }

  onEntitySpawn = (bot: Bot, entity: Entity) => {
    if (entity.type === 'player') {
      if (bot.entity.position.distanceTo(entity.position) < this.minDistance) {
        this.whClient.send(
          `Player ${entity.username} entered our range of ${this.minDistance} blocks!`
        )
      }
    }
  }
}



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
export class GotoPlacePlugin extends ProxyServerPlugin<{}, {}> {
  connectedCmds: CommandMap = {
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

  constructor(public readonly opts: string) {
    super();
  }

  public onLoad(server: ProxyServer<IProxyServerOpts,IProxyServerEvents>): void {
      
  }

  async stop (client: Client) {
    // these both exist due to how these commands are called.
    const bot = this.server.remoteBot!
    const proxy = this.server.conn!
    bot.pathfinder.setGoal(null)
    this.server.message(client, 'Stopped pathfinding!')
    this.syncClientToBot(client, bot)
    proxy.link(client)
  }

  async gotoFunc (client: Client, x: string, y: string, z: string) {
    // these both exist due to how these commands are called.
    const bot = this.server.remoteBot!

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

  async gotoXZFunc (client: Client, x: string, z: string, range?: string) {
    // these both exist due to how these commands are called.
    const bot = this.server.remoteBot!

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

  private async travelTo (client: Client, goal: goals.Goal): Promise<void> {
    // these both exist due to how these commands are called.
    const bot = this.server.remoteBot!
    const proxy = this.server.conn!

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
  syncClientToBot (client: Client | ServerClient, bot: Bot) {
    client.write('position', {
      ...bot.entity.position,
      yaw: bot.entity.yaw,
      pitch: bot.entity.pitch,
      onGround: bot.entity.onGround
    })
  }
}
