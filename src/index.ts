import config from "config"
import { buildClient } from "./misc/discord/index.js"
import {Conn as RobConn} from "@rob9315/mcproxy"
import merge from "ts-deepmerge";

import {BotOptions} from "mineflayer"
import { ProxyServer } from "./misc/proxyUtil/proxyServer.js";
import { CommandHandler } from "./misc/commandHandler.js";
import { ProxyLogic } from "./misc/proxyUtil/proxyLogic.js";
// const token = config.get("discord.token")


const options = {
    "discord": {
        "token": process.env.BOT_TOKEN,
        "prefix": "!"
    },
    "minecraft": {
        "account": {
            "username": "Generel_Schwerz",
            "email": "mattwoods30006@gmail.com",// here
            "password": "xCDf4gHjyQ7@-", // done
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


// const discClient = await buildClient(options.discord.token, options.discord.prefix)


const proxyLogic = new ProxyLogic(buildBotOpts(options), options.minecraft.localServer);

const handler = new CommandHandler(proxyLogic, {cli: true})

handler.on('command', (src, command) => console.log(`ran command ${command} from source ${src}`))


// setTimeout(() => {
//     proxyServer.close()
//     console.log("finished.")
// }, 3000);

