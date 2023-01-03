

import merge from "ts-deepmerge";

import { BotOptions } from "mineflayer";

import * as fs from "fs";
import { QueueHandler } from "./misc/queueInfo/queueHandler.js";
import { buildClient } from "./misc/discord/index.js";
import { CommandHandler } from "./misc/commandHandler.js";


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

const options: Options = JSON.parse(fs.readFileSync("options.json").toString());

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


// normalizes command inputs and returns outputs.
const commandHandler = new CommandHandler(queueHandler, { cli: true });

commandHandler.on("command", (src, command, result) =>
  console.log(`ran command ${command} from source ${src}.\nResult: ${result}`)
);