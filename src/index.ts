const ppid = Number(process.argv[2])

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

import { validateConfig } from "./util/config";
import { botOptsFromConfig, Options } from "./util/options";
import { Duration } from "ts-luxon";
import { ServerLogic } from "./serverLogic";
import {createServer} from "minecraft-protocol"
import { buildClient } from "./discord/index";

/////////////////////////////////////////////
//              Initialization             //
/////////////////////////////////////////////

// ... If no errors were found, return the validated config

const config = JSON.parse(fs.readFileSync(optionDir).toString());

const checkedConfig: Options = validateConfig(config);

const botOptions = botOptsFromConfig(checkedConfig);

const rawServer = createServer(checkedConfig.minecraft.localServer);
const wrapper = new ServerLogic(true, rawServer, botOptions, checkedConfig.minecraft.localServerOptions);

wrapper.on("enteredQueue", () => {
  rawServer.motd = "Entered the queue!";
  wrapper.on("queueUpdate", updateServerMotd);
});

wrapper.on("leftQueue", () => {
  rawServer.motd = "In game!";
  wrapper.removeListener("queueUpdate", updateServerMotd);
});

wrapper.on("remoteKick", async (reason) => {
  console.log("remoteKick:", reason);
  if (wrapper.psOpts.restartOnDisconnect) {
    wrapper.restart(1000);
  }
});

wrapper.on("remoteError", async (error) => {
  console.log("remoteError:", error);
  if (wrapper.psOpts.restartOnDisconnect) {
    wrapper.restart(1000);
  }
});

wrapper.on("decidedClose", (reason) => {
  console.log("STOPPED SERVER:", reason);
});

const discord = buildClient(checkedConfig.discord, wrapper);

/////////////////////////////////////////////
//              functions                  //
/////////////////////////////////////////////

function updateServerMotd(oldPos: number, newPos: number, eta: number) {
  if (Number.isNaN(eta)) return;

  rawServer.motd = `Pos: ${newPos}, ETA: ${Duration.fromMillis(
    eta * 1000 - Date.now()
  ).toFormat("dd:hh:mm:ss")}`;
}

/////////////////////////////////////////////
//                                         //
/////////////////////////////////////////////
