import * as fs from "fs";
import { validateOptions } from "./util/config";
import { botOptsFromConfig, serverOptsFromConfig } from "./util/options";
import {
  ConsoleReporter,
  SpectatorServerPlugin,
  TwoBAntiAFKPlugin,
  WebhookReporter,
  MotdReporter,
} from "./localServer/builtinPlugins";
import { ServerBuilder } from "./localServer/baseServer";
import { GotoPlacePlugin } from "./localServer/examplePlugin";
import { buildClient } from "./discord";

import type { Options } from "./types/options";

const yaml = require("js-yaml");

// ... If no errors were found, return the validated config
const config = yaml.load(fs.readFileSync("./options.yml", "utf-8"));

const checkedConfig: Options = validateOptions(config);
const bOpts = botOptsFromConfig(checkedConfig);

const helpMsg =
  "-------------------------------\n" +
  "start    -> starts the server\n" +
  "stop     -> stops the server\n" +
  "restart  -> restarts the server\n" +
  "status   -> displays info of service\n" +
  "help     -> shows this message\n";

async function setup() {
  const serverOptions = await serverOptsFromConfig(checkedConfig);

  // for typing reasons, just make an array. I'll explain in due time.
  const plugins = [];
  plugins.push(new SpectatorServerPlugin());
  plugins.push(new TwoBAntiAFKPlugin());

  const server = new ServerBuilder(serverOptions, bOpts)
    .addPlugins(...plugins)
    .setSettings(checkedConfig.localServerConfig)
    .setOtherSettings({debug: true, loggerOpts: checkedConfig.logger})
    .build();

  // everything after here is strongly typed.
  // If a plugin does not meet the types provided ^^^, then it will fail.

  // server.loadPlugin(new GotoPlacePlugin());

  if (true) {
    server.loadPlugin(new ConsoleReporter());
  }

  if (true) {
    server.loadPlugin(new MotdReporter(checkedConfig.localServerConfig.display));
  }

  if (checkedConfig.discord.webhooks?.enabled) {
    server.loadPlugin(new WebhookReporter(checkedConfig.discord.webhooks));
  }

  if (checkedConfig.discord.bot?.enabled) {
    buildClient(checkedConfig.discord.bot, server);
  }


  server.start();

  // ==========================
  //  custom logging example!
  // ==========================

  // this.serverOn('botevent_move', (bot, pos) => {
  //   console.log('hey')
  //   server.logger.log('botMovement', 'custom', pos)
  // })

 
}

setup();
