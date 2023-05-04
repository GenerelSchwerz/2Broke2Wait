import * as fs from "fs";
import path from 'path'
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
import { RestartPlugin, SecurityPlugin } from "./localServer/builtinPlugins/security";

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
   
    .addPlugin(new SecurityPlugin())
    .addPlugin(new RestartPlugin())
    .addPlugin(new SpectatorServerPlugin())
    .addPlugin(new TwoBAntiAFKPlugin())
    .addPlugin(new MotdReporter())
    
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
    server.loadPlugin(new MotdReporter())
    server.loadPlugin(new ConsoleReporter())
  }

  if (checkedConfig.discord.webhooks?.enabled) {
    server.loadPlugin(new WebhookReporter(checkedConfig.discord.webhooks));
  }

  if (checkedConfig.discord.bot?.enabled) {
    buildClient(checkedConfig.discord.bot, server);
  }


  const f = path.join(__dirname, '../plugins')
  fs.readdirSync(f).forEach(async file => {
    const file1 = path.join(f, file);
    const filetype = file1.split('.')[file1.split('.').length-1]
   
    switch (filetype) {
      case "js":
        const data0 = await require(file1);
        server.loadPlugin(data0)
        break
      case "ts": 
        const data1 = await import(file1);
        server.loadPlugin(data1)
        break

    }    
  });

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
