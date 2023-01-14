const ppid = Number(process.argv[2]);

if (Number.isNaN(ppid)) {
  throw new Error("You're not supposed to be here.");
}

if (ppid !== 0) {
  process.kill(Number(process.argv[2]), 31);
}
// useful for us.
const optionDir: string = process.argv[3] + "/options.json";

// import * as path from "path";
// const optionDir: string = path.join(process.argv[2], "./options.json");

/////////////////////////////////////////////
//                Imports                  //
/////////////////////////////////////////////

import * as fs from "fs";

import { validateOptions } from "./util/config";
import { botOptsFromConfig, Options } from "./util/options";
import { Duration } from "ts-luxon";
import { createServer } from "minecraft-protocol";
import { buildClient } from "./discord/index";
import { applyWebhookListeners } from "./util/chatting";
import { AntiAFKServer } from "./impls/antiAfkServer";
import type {Bot} from "mineflayer";
import { ProxyInspector } from "./wip/newProxyServer";

/////////////////////////////////////////////
//              Initialization             //
/////////////////////////////////////////////

// ... If no errors were found, return the validated config

const config = JSON.parse(fs.readFileSync(optionDir).toString());

const checkedConfig: Options = validateOptions(config);

const botOptions = botOptsFromConfig(checkedConfig);

const rawServer = createServer(checkedConfig.minecraft.localServer);

console.log(checkedConfig.minecraft.localServer);

const afkServer = ProxyInspector.wrapServer1(
  true,
  rawServer,
  botOptions,
  {},
  checkedConfig.minecraft.localServerOptions
);

afkServer.on("breath", () => {
  botUpdatesMotd(afkServer.remoteBot);
})

afkServer.on("health", () => {
  botUpdatesMotd(afkServer.remoteBot);
})

afkServer.on("enteredQueue", () => {
  queueEnterMotd();
  afkServer.on("queueUpdate", queueServerMotd);
});

afkServer.on("leftQueue", () => {
  inGameServerMotd();
  afkServer.removeListener("queueUpdate", queueServerMotd);
});

afkServer.on("remoteKick", async (reason) => {
  console.log("remoteKick:", reason);
  if (afkServer.psOpts.restartOnDisconnect) {
    afkServer.restart(1000);
  }
});

afkServer.on("remoteError", async (error) => {
  console.log("remoteError:", error);
  if (afkServer.psOpts.restartOnDisconnect) {
    afkServer.restart(1000);
  }
});

afkServer.on("closedConnections", (reason) => {
  console.log("STOPPED SERVER:", reason);
  disconnectedServerMotd();
  afkServer.removeAllClientListeners();
  afkServer.removeAllServerListeners();
});


afkServer.on("started", () => { 
  console.log("Server started!\n" + helpMsg);
  inGameServerMotd();
  if (checkedConfig.discord.webhooks.enabled) {
    applyWebhookListeners(afkServer, checkedConfig.discord.webhooks);
  }
});

if (checkedConfig.discord.bot.enabled && !!checkedConfig.discord.bot.botToken) {
  const discord = buildClient(checkedConfig.discord.bot, afkServer);
  console.log("We are using a discord bot.");
} else {
  console.log(
    "No discord token included. Going without it (No command functionality currently)."
  );
}

if (checkedConfig.discord.webhooks.enabled) {
  console.log("Using discord webhooks to relay information!");
} else {
  console.log("Discord webhooks are disabled. Will not be using them.");
}

import * as rl from "readline";
import { goals } from "mineflayer-pathfinder";
const inp = rl.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const helpMsg =
  "-------------------------------\n" +
  "start    -> starts the server\n" +
  "stop     -> stops the server\n" +
  "restart  -> restarts the server\n" +
  "status   -> displays info of service\n" +
  "help     -> shows this message\n";



 afkServer.start();


/////////////////////////////////////////////
//              functions                  //
/////////////////////////////////////////////

function getServerName(): string {
  return checkedConfig.minecraft.remoteServer.host + (checkedConfig.minecraft.remoteServer.port !== 25565 ? ":" + checkedConfig.minecraft.remoteServer.port : "");
}

function queueServerMotd(oldPos: number, newPos: number, eta: number) {
  if (Number.isNaN(eta)) {
    rawServer.motd = `Pos: ${newPos} | ETA: Unknown.`;
    return;
  };

  const res = `Pos: ${newPos} | ETA: ${Duration.fromMillis(
    eta * 1000 - Date.now()
  ).toFormat("d'd', h'hr', m'min'")}`

  console.log(`Queue update!\n` + res);
  rawServer.motd = res;
}

function disconnectedServerMotd() {
  rawServer.motd = `Disconnected from ${getServerName()}`
}

function queueEnterMotd() {
  rawServer.motd = `Entered queue on ${getServerName()}`
}

function inGameServerMotd() {
  rawServer.motd = `Playing on ${getServerName()}!`
}

function botUpdatesMotd(bot: Bot) {
  rawServer.motd = `Health: ${bot.entity.health ?? 'unknown'}, Hunger: ${bot.entity.food ?? 'unknown'}`
}

/////////////////////////////////////////////
//                Util                     //
/////////////////////////////////////////////
inp.on("line", (inp) => {
  switch (inp.split(" ")[0]) {
    case "help":
      console.log("Help message!\n" + helpMsg);
      break;
    case "start":
      afkServer.start();
      break;
    case "stop":
      afkServer.stop();
      break;
    case "restart":
      afkServer.restart(1000);
      break;
    case "status":
      if (afkServer.isProxyConnected()) {
        console.log(`Proxy connected to ${afkServer.bOpts.host}:${afkServer.bOpts.port !== 25565 ? afkServer.bOpts.port : ""}`);
        if (afkServer.queue.inQueue)
        console.log(`Proxy in queue? ${afkServer.queue.inQueue}`);
      
      } else {
        console.log("Proxy is not connected.");
      }

      if (afkServer.isPlayerConnected()) {
        console.log("Player connected.")
      } else {
        console.log("Player is not connected.");
      }
  }
});
