import { Client, Conn } from "@rob9315/mcproxy";
import { ServerClient } from "minecraft-protocol";
import { ProxyServerPlugin } from "./baseServer";
import { CommandMap } from "../util/commandHandler";
import { goals } from "mineflayer-pathfinder";
import type { Bot } from "mineflayer";

/**
 * Gen here.
 *
 * This is an example plugin to make the server print hi whenever it starts.
 *
 * Yes, this is literally it.
 */
class ExamplePlugin extends ProxyServerPlugin {
  onPostStart = () => {
    console.log("hi");
  };
}

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
export class GotoPlacePlugin extends ProxyServerPlugin {

  
  connectedCmds: CommandMap = {
    goto: {
      usage: "goto <x> <y> <z>",
      description: "go from point A to point B",
      callable: this.gotoFunc.bind(this),
    },

    gotoXZ: {
      usage: "gotoXZ <x> <z>",
      description: "go from point A to point B, XZ",
      callable: this.gotoXZFunc.bind(this)
    }
  };

  async gotoFunc(client: Client | ServerClient, x: string, y: string, z: string) {

    // these both exist due to how these commands are called.
    const bot = this.server.remoteBot!;
    const proxy = this.server.conn!;
    
    if (client !== this.server.controllingPlayer) {
      this.server.message(client, "You cannot cause the bot to go anywhere, you are not controlling it!");
      return;
    }

    const numX = (x === "~") ? bot.entity.position.x : Number(x)
    const numY = (y === "~") ? bot.entity.position.y : Number(y)
    const numZ = (z === "~") ? bot.entity.position.z : Number(z)

    // unlink client so bot can move
    proxy.unlink();
    this.server.message(client, `Moving to: (${numX}, ${numY}, ${numZ})`)

    // attempt to go to goal, just handle error if it fails.
    try {
      await bot.pathfinder.goto(new goals.GoalGetToBlock(numX, numY, numZ));
      this.server.message(client, `Made it!`)
    } catch (e) {
      this.server.message(client, `Did not make it...`)
      console.error(e);
    } 
    
    // basic clean up, then we're all good :thumbsup:
    finally {
      this.syncClientToBot(client, bot);
      proxy.link(client);
    }
 
  }

  async gotoXZFunc(client: Client | ServerClient, x: string, z: string, range?: string) {

    // these both exist due to how these commands are called.
    const bot = this.server.remoteBot!;
    const proxy = this.server.conn!;

    if (client !== this.server.controllingPlayer) {
      this.server.message(client, "You cannot cause the bot to go anywhere, you are not controlling it!");
      return;
    }

    const numX = (x === "~") ? bot.entity.position.x : Number(x)
    const numZ = (z === "~") ? bot.entity.position.z : Number(z)
    const numRange = range ? Number(range) : 3

    // unlink client so bot can move
    proxy.unlink();
    this.server.message(client, `Moving to: (${numX}, ${numZ}) w/ range ${numRange}`)

    try {
      await bot.pathfinder.goto(new goals.GoalNearXZ(numX, numZ, numRange));
      this.server.message(client, `Made it!`)
    } catch (e) {
      this.server.message(client, `Did not make it...`)
      console.error(e);
    }

     // basic clean up, then we're all good :thumbsup:
    finally {
      this.syncClientToBot(client, bot);
      proxy.link(client);
    } 
  }

  // sync client back to bot's position
  syncClientToBot(client: Client | ServerClient, bot: Bot) {
    client.write("position", {
      ...bot.entity.position,
      yaw: bot.entity.yaw,
      pitch: bot.entity.pitch,
      onGround: bot.entity.onGround,
    });
  }
}
