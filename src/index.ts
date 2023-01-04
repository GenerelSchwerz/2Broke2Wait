// process.kill(Number(process.argv[2]), 31);

// useful for us.
// const optionDir: string = process.argv[3] + "/options.json";
const optionDir: string =
  "/home/generel/Documents/vscode/javascript/2b2w-ts-rewrite" + "/options.json";

/////////////////////////////////////////////
//                Imports                  //
/////////////////////////////////////////////

import * as fs from "fs";

import { validateConfig } from "./util/config";
import { AntiAFKServer } from "./impls/antiAfkServer";
import { botOptsFromConfig, Options } from "./util/options";

/////////////////////////////////////////////
//              Initialization             //
/////////////////////////////////////////////

// ... If no errors were found, return the validated config

const config = JSON.parse(fs.readFileSync(optionDir).toString());

const checkedConfig: Options = validateConfig(config);

const botOptions = botOptsFromConfig(checkedConfig);

const server = AntiAFKServer.createServer(
  botOptions,
  [],
  checkedConfig.minecraft.localServer,
  { antiAFK: true, ...checkedConfig.minecraft.localServerOptions }
);




// const pServer = ProxyServer.createProxyServer()

/////////////////////////////////////////////
//                                         //
/////////////////////////////////////////////

/////////////////////////////////////////////
//                                         //
/////////////////////////////////////////////
