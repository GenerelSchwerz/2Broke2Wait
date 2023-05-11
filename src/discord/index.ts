import { Client } from 'discordx'
import { IntentsBitField } from 'discord.js'

import './commands'
import type { Options } from '../types/options'
import { ProxyServer } from '@nxg-org/mineflayer-mitm-proxy'
import { AllEvents, AllOpts } from '../localServer'

declare module 'discordx' {
  interface Client {
    mcServer: ProxyServer<AllOpts, AllEvents>
  }
}

export async function buildClient (
  { token, prefix }: Exclude<Options['discord']['bot'], undefined>,
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

  console.log(token, prefix)

  await client.login(token)
  return client
}
