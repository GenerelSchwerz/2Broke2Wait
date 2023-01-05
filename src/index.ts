// process.kill(Number(process.argv[2]), 31);

// useful for us.
// const optionDir: string = process.argv[3] + "/options.json";
import * as path from "path";
const optionDir: string = path.join(process.argv[2], "./options.json");

/////////////////////////////////////////////
//                Imports                  //
/////////////////////////////////////////////

import * as fs from "fs";

import { validateConfig } from "./util/config";
import { AntiAFKServer } from "./impls/antiAfkServer";
import { botOptsFromConfig, Options } from "./util/options";
import { OldPredictor } from "./impls/2b2wPredictor";
import { BasedPredictor } from "./impls/basedPredictor";
import { DateTime, Duration } from "ts-luxon";
import { CombinedPredictor } from "./impls/combinedPredictor";

/////////////////////////////////////////////
//              Initialization             //
/////////////////////////////////////////////

// ... If no errors were found, return the validated config

const config = JSON.parse(fs.readFileSync(optionDir).toString());

const checkedConfig: Options = validateConfig(config);

const botOptions = botOptsFromConfig(checkedConfig);

const pServer = AntiAFKServer.createServer(
  botOptions,
  [],
  checkedConfig.minecraft.localServer,
  { antiAFK: true, ...checkedConfig.minecraft.localServerOptions }
);

const combined = new CombinedPredictor(pServer.proxy);

combined.begin();

combined.on("queueUpdate", updateServerMotd);

/////////////////////////////////////////////
//              functions                  //
/////////////////////////////////////////////

function updateServerMotd(oldPos: number, newPos: number, eta: number) {
  if (Number.isNaN(eta)) return;

  pServer.server.motd = `Pos: ${newPos}, ETA: ${Duration.fromMillis(
    eta * 1000 - Date.now()
  ).toFormat("dd:hh:mm:ss")}`;
}

/////////////////////////////////////////////
//                                         //
/////////////////////////////////////////////
