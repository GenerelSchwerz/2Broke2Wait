import { Client } from 'discordx'
import { IntentsBitField } from 'discord.js'

import './commands'
import { Options } from '../util/options.js'
import { ProxyServer } from '../localServer/baseServer'
import { AllEvents, AllOpts } from '../localServer/plugins'

declare module 'discordx' {
  interface Client {
    mcServer: ProxyServer<AllOpts, AllEvents>
  }
}

export async function buildClient (
  { botToken, prefix }: Exclude<Options['discord']['bot'], undefined>,
  server: ProxyServer<AllOpts, AllEvents>
): Promise<Client> {
  const client = new Client({
    simpleCommand: {
      prefix
    },
    intents: [
      IntentsBitField.Flags.Guilds,
      IntentsBitField.Flags.GuildMessages,
      IntentsBitField.Flags.GuildMembers
    ],
    silent: true
  })

  client.mcServer = server

  client.once('ready', async () => {
    await client.initApplicationCommands()
  })

  client.on('interactionCreate', (interaction) => {
    client.executeInteraction(interaction)
  })

  await client.login(botToken)
  return client
}
