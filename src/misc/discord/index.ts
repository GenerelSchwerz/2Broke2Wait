import {
  Client,
  InitCommandOptions,
  DApplicationCommand,
  MetadataStorage,
} from "discordx";
import { dirname, importx } from "@discordx/importer";
import { IntentsBitField, InteractionType } from "discord.js";
import { ProxyLogic } from "../proxyUtil/proxyLogic.js";



export async function buildClient<T extends ProxyLogic>(
  token: string,
  prefix: string,
  pLogic: T
): Promise<Client> {
  // await importx(`${dirname(import.meta.url)}/simple.ts`);
  await importx(`${dirname(import.meta.url)}/commands/**/*.{js,ts}`);

  const client = new Client({
    simpleCommand: {
      prefix,
    },

    // botGuilds: [(client) => client.guilds.cache.map((guild) => guild.id)],
    intents: [
      IntentsBitField.Flags.Guilds,
      IntentsBitField.Flags.GuildMessages,
      IntentsBitField.Flags.GuildMembers,
      // IntentsBitField.Flags.MessageContent
    ],
    silent: false,
  }); 

  /**
   * Code for loading slashes. Fuck that, it's not working right now.
   * Metadata.instance._applicationCommandSlashesFlat is empty.
   * Not fixing it right now.
   */
  client.once("ready", async () => {
    await client.initApplicationCommands();
    console.log(">> Bot started");
  });

  client.on("interactionCreate", (interaction) => {
    client.executeInteraction(interaction);
  });

  // client.on("messageCreate", (message) => {
  //     client.executeCommand(message)
  // })



  client["pLogic"] = pLogic
  await client.login(token);
  return client;
}
