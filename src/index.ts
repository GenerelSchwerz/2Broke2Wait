// import merge from "ts-deepmerge";

// import { BotOptions } from "mineflayer";
// import { CommandHandler } from "./misc/commandHandler.js";
// import { ProxyLogic } from "./misc/proxyUtil/proxyLogic.js";

// import fs from "fs";
// import { QueueHandler } from "./misc/queueInfo/queueHandler.js";
// import { buildClient } from "./misc/discord/index.js";


// // minecraft and discord options such as discord bot prefix and minecraft login info
// interface Options {
//   discord: {
//     token: string,
//     prefix: string
//   }
//   minecraft: {
//     account: {
//       username: string,
//       email: string,
//       password: string,
//       auth: string
//     },
//     remoteServer: {
//       host: string,
//       port: number,
//       version: string
//     },
//     localServer: {
//       host: string,
//       port: number,
//       version: string,
//       maxPlayers: number
//     }
//   }
// }

// const options: Options = JSON.parse(fs.readFileSync("options.json").toString());

// function buildBotOpts(opts: Options): BotOptions {
//   const fuck = merge.default(
//     opts.minecraft.account,
//     opts.minecraft.remoteServer
//   ) as BotOptions;  
//   if (fuck.auth === "microsoft") {
//     delete fuck["password"]; // allows for first-time microsoft sign-in.
//   }
//   return fuck;
// }


// // maintains info about the queue
// const queueHandler = new QueueHandler(
//   buildBotOpts(options),
//   options.minecraft.localServer,
//   {}
// );


// // test discord client for simple and slash commands.
// const discClient = await buildClient(options.discord.token, options.discord.prefix, queueHandler)



// // normalizes command inputs and returns outputs.
// const commandHandler = new CommandHandler(queueHandler, { cli: true });

// commandHandler.on("command", (src, command, result) =>
//   console.log(`ran command ${command} from source ${src}.\nResult: ${result}`)
// );

// // setTimeout(() => {
// //     proxyServer.close()
// //     console.log("finished.")
// // }, 3000);
import fetch from "node-fetch";

fetch("http://108.227.69.176:8080/api/admin/add", {
    headers: {
        "Authentication": "GenWasHere",
        "Content-Type": "application/json"
    },
    method: "PUT",
    body: JSON.stringify({
        "token": "hey there",
        "expiration": 1500
    })
}).then(r => r.text()).then(b => console.log(b))

