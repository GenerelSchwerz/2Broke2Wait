// console.log(process.argv)
// process.kill(Number(process.argv[2]), 31);

process.kill(Number(process.argv[2]), 31);

console.log(process.pid, process.ppid, process.argv);


import merge from "ts-deepmerge";

import { BotOptions } from "mineflayer";

import * as fs from "fs";
import { QueueHandler } from "./misc/queueInfo/queueHandler.js";
import { buildClient } from "./misc/discord/index.js";

import * as rl from "readline";
import { cliCommandHandler } from "./commandHandlers.js";


// Minecraft and discord options such as discord bot prefix and minecraft login info
interface Options {
  discord: {
    token: string,
    prefix: string
  }
  minecraft: {
    account: {
      username: string,
      email: string,
      password: string,
      auth: string
    },
    remoteServer: {
      host: string,
      port: number,
      version: string
    },
    localServer: {
      host: string,
      port: number,
      version: string,
      maxPlayers: number
    }
  }
}


const options: Options = JSON.parse(fs.readFileSync(process.argv[3] + "/options.json").toString());

function buildBotOpts(opts: Options): BotOptions {
  const fuck = merge(
    opts.minecraft.account,
    opts.minecraft.remoteServer
  ) as BotOptions;  
  if (fuck.auth === "microsoft") {
    delete fuck["password"]; // Allows for first-time microsoft sign-in.
  }
  return fuck;
}


// Maintains info about the queue
const queueHandler = new QueueHandler(
  buildBotOpts(options),
  options.minecraft.localServer,
  {}
);


// Test discord client for simple and slash commands.

buildClient(options.discord.token, options.discord.prefix, queueHandler)


const cli = rl.createInterface({
  input: process.stdin,
  output: process.stdout,
})

cli.on("line", async (line) => console.log(await cliCommandHandler(line, queueHandler)));


