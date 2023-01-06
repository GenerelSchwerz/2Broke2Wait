import { Client } from "discordx";
import { IntentsBitField } from "discord.js";
import { ServerLogic } from "../serverLogic.js";

import "./commands";

declare module "discordx" {
  interface Client {
    mcServer: ServerLogic
  }
}


export async function buildClient({token, prefix}: {token: string, prefix: string},
  server: ServerLogic
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

  client.once("ready", async () => {
    await client.initApplicationCommands();
  });

  client.on("interactionCreate", (interaction) => {
    client.executeInteraction(interaction);
  });

  client.mcServer = server;

  await client.login(token);
  return client;
}
