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
import { ServerBuilder } from "@nxg-org/mineflayer-mitm-proxy";
import { buildClient } from "./discord";
import type { Options } from "./types/options";

const yaml = require("js-yaml");

// ... If no errors were found, return the validated config
let config;

try {
  config = yaml.load(fs.readFileSync("./options.yml", "utf-8"));
} catch (e) {
  const data = fs.readFileSync("./static/defaults/default_config.yml", "utf-8");
  fs.writeFileSync("./options.yml", data);
  config = yaml.load(data);
}

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


  const server = new ServerBuilder(serverOptions, bOpts)

    // add plugins that provide events here!
    .addPlugin(new SpectatorServerPlugin())
    .addPlugin(new TwoBAntiAFKPlugin())

    // apply settings only after all plugins have been loaded!
    .setSettings(checkedConfig.localServerConfig)
    .setOtherSettings({
      debug: checkedConfig.debug,
      loggerOpts: checkedConfig.logger,
    })
    .build();


  // all other plugins must be listener-only to be strongly typed.
  // This is to prevent improperly built servers.
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
