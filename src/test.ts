import * as fs from "fs";

import { validateOptions } from "./util/config";
import { botOptsFromConfig, Options } from "./util/options";
import { Duration } from "ts-luxon";
import { ServerLogic } from "./serverLogic";
import {createServer} from "minecraft-protocol"
import { buildClient } from "./discord/index";
import { applyWebhookListeners } from "./util/chatting";

const optionDir: string = process.argv[3] + "/options.json";

const config = JSON.parse(fs.readFileSync(optionDir).toString());

const checkedConfig: Options = validateOptions(config);

const botOptions = botOptsFromConfig(checkedConfig);

const rawServer = createServer(checkedConfig.minecraft.localServer);

rawServer.on("error", console.log);
rawServer.on("listening", console.log);
rawServer.on("login", console.log);
rawServer.on("connection", console.log);
console.log(checkedConfig.minecraft.localServer);
