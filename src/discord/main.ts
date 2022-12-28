import {Client, InitCommandOptions, DApplicationCommand} from "discordx";
import { dirname, importx } from "@discordx/importer";
import { IntentsBitField } from "discord.js";



export async function buildClient(token: string): Promise<Client> {

    const client = new Client({
            // botGuilds: [(client) => client.guilds.cache.map((guild) => guild.id)],
            intents: [
              IntentsBitField.Flags.Guilds,
              IntentsBitField.Flags.GuildMessages,
              IntentsBitField.Flags.GuildMembers,
            ],
            silent: false,
    });

  

    client.once("ready", async () => {
        // An example of how guild commands can be cleared
        //
        // await this._client.clearApplicationCommands(
        //   ...this._client.guilds.cache.map((guild) => guild.id)
        // );
        await importx(`${dirname(import.meta.url)}/commands/**/*.{js,ts}`);
        await client.initApplicationCommands();
  
        console.log(">> Bot started");
      });
      
      client.on("interactionCreate", (interaction) => {
        console.log(interaction)
        client.executeInteraction(interaction);
      });


      client.on("messageCreate", (message) => {
        console.log(message.content)
      })

  
 
    await client.login(token);
    return client;
}