import config from "config"
import { buildClient } from "./discord/index.js"
import {Conn as RobConn} from "@rob9315/mcproxy"
import merge from "ts-deepmerge";

import {BotOptions} from "mineflayer"
// const token = config.get("discord.token")


const options = {
    "discord": {
        "token": process.env.BOT_TOKEN,
        "prefix": "!"
    },
    "minecraft": {
        "account": {
            "username": "Generel_Schwerz",
            "email": "fuck",// shit,
            "password": "fuck",
            "auth": "offline"
        },
        "server": {
            "host": "localhost",
            "port": 25565,
            "version": "1.18.2",
        },

      
    } 
}

function buildBotOpts(opts: typeof options): BotOptions {
    return merge.default(opts.minecraft.account, opts.minecraft.server) as BotOptions
}


// const discClient = await buildClient(options.discord.token, options.discord.prefix)


console.log(buildBotOpts(options))

const proxyClient = new RobConn(buildBotOpts(options))

const bot = proxyClient.stateData.bot._client

bot.on("packet", (data, meta) => {
    console.log(meta.name)
})

