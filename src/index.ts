// process.kill(Number(process.argv[2]), 31);

// useful for us.
// const optionDir: string = process.argv[3] + "/options.json";
const optionDir: string = "/home/generel/Documents/vscode/javascript/2b2w-ts-rewrite" + "/options.json";



/////////////////////////////////////////////
//                Imports                  //
/////////////////////////////////////////////


import { ProxyServer } from "./proxyServer";
import * as fs from "fs";

import { Options } from "discord.js";
import { validateConfig } from "./util/config";




/////////////////////////////////////////////
//              Initialization             //
/////////////////////////////////////////////


// ... If no errors were found, return the validated config

const config = JSON.parse(fs.readFileSync(optionDir).toString())

const checkedConfig: Options = validateConfig(config);



// const pServer = ProxyServer.createProxyServer()



/////////////////////////////////////////////
//                                         //
/////////////////////////////////////////////




/////////////////////////////////////////////
//                                         //
/////////////////////////////////////////////