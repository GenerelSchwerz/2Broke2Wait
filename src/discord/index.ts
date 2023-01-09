import { Client } from "discordx";
import { IntentsBitField } from "discord.js";

import "./commands";
import { Options } from "../util/options.js";
import { AntiAFKServer } from "../impls/antiAfkServer";

declare module "discordx" {
  interface Client {
    mcServer: AntiAFKServer;
  }
}

export async function buildClient(
  { botToken, prefix }: Options["discord"]["bot"],
  server: AntiAFKServer
): Promise<Client> {
  const client = new Client({
    simpleCommand: {
      prefix: prefix,
    },
    intents: [
      IntentsBitField.Flags.Guilds,
      IntentsBitField.Flags.GuildMessages,
      IntentsBitField.Flags.GuildMembers,
    ],
    silent: true,
  });

  client.mcServer = server;

  client.once("ready", async () => {
    await client.initApplicationCommands();
  });

  client.on("interactionCreate", (interaction) => {
    client.executeInteraction(interaction);
  });

  await client.login(botToken);
  return client;
}
