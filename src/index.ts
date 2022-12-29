
import merge from "ts-deepmerge";

import {BotOptions} from "mineflayer"
import { CommandHandler } from "./misc/commandHandler.js";
import { ProxyLogic } from "./misc/proxyUtil/proxyLogic.js";

import dotenv from "dotenv"
import { QueueHandler } from "./misc/queueHandler.js";

dotenv.config();


// rough option selection right now for testing.
const options = {
    "discord": {
        "token": process.env.BOT_TOKEN,
        "prefix": "!"
    },
    "minecraft": {
        "account": {
            "username": process.env.USERNAME,
            "email": process.env.EMAIL,// here
            "password": process.env.PASSWORD, // done
            "auth": "offline"
        },
        "remoteServer": {
            "host": "localhost",
            "port": 25566,
            "version": "1.12.2",
        },
        "localServer": {
            "host": "localhost",
            "port": 25565,
            "version": "1.12.2",
            "maxPlayers": 1
        }
      
    } 
}

function buildBotOpts(opts: typeof options): BotOptions {
    const fuck = merge.default(opts.minecraft.account, opts.minecraft.remoteServer) as BotOptions
    if (fuck.auth === "microsoft") {
        delete fuck["password"]; // allows for first-time microsoft sign-in.
    }
    return fuck;
}

// test discord client for simple and slash commands.
// const discClient = await buildClient(options.discord.token, options.discord.prefix)

// maintains info about the queue
const queueHandler = new QueueHandler(buildBotOpts(options), options.minecraft.localServer);

// normalizes command inputs and returns outputs.
const commandHandler = new CommandHandler(queueHandler, {cli: true})

commandHandler.on('command', (src, command, result) => console.log(`ran command ${command} from source ${src}.\nResult: ${result}`))


// setTimeout(() => {
//     proxyServer.close()
//     console.log("finished.")
// }, 3000);

