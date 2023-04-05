import { CommandInteraction, OAuth2Scopes, ApplicationCommandOptionType } from 'discord.js'
import { Client, Discord, Slash, SlashGroup, SlashOption } from 'discordx'
import { DateTime, Duration } from 'ts-luxon'

import { hourAndMinToDateTime, pingTime, tentativeStartTime, waitUntilStartingTime } from '../util/remoteInfo'
import { CombinedPredictor } from '../localServer/predictors'

@Discord()
@SlashGroup({ description: 'Queue related commands', name: 'queue' })
@SlashGroup('queue')
export class QueueCommands {
  @Slash({ description: 'Get queue position.' })
  async pos (
    @SlashOption({
      description: 'specific username',
      name: 'username',
      required: false,
      type: ApplicationCommandOptionType.String
    })
    username: string = '/0all',
    interaction: CommandInteraction,
    client: Client
  ) {
    const mcServer = client.mcServer

    if (username !== '/0all') {
      // do not reply w/ this bot instance if a username is specified AND it does not match.
      if (mcServer.bOpts.username !== username) return
    }

    if (!mcServer.isProxyConnected()) {
      return await interaction.reply('We are not connected to the server!')
    }

    const queue = mcServer.getPluginData<CombinedPredictor>('queue')
    if (queue == null) return await interaction.reply('No queue loaded!')

    const spot = queue.lastPos

    if (Number.isNaN(spot)) return await interaction.reply(`Queue position for ${mcServer.bOpts.username} unknown!.`)

    interaction.reply(`Queue pos for ${mcServer.bOpts.username}: ${spot}`)
  }

  @Slash({ description: 'Check queue position and other additional info.' })
  async info (
    @SlashOption({
      description: 'specific username for info',
      name: 'username',
      required: false,
      type: ApplicationCommandOptionType.String
    })
    username: string = '/0all',

    interaction: CommandInteraction,
    client: Client
  ) {
    const mcServer = client.mcServer

    if (username !== '/0all') {
      // do not reply w/ this bot instance if a username is specified AND it does not match.
      if (mcServer.bOpts.username !== username) return
    }

    if (!mcServer.isProxyConnected()) {
      interaction.reply('We are not connected to the server!')
      return
    }

    const queue = mcServer.getPluginData<CombinedPredictor>('queue')
    if (queue == null) return await interaction.reply('No queue loaded!')

    let eta
    let joiningAt
    if (!Number.isNaN(queue.eta)) {
      eta = Duration.fromMillis(queue.eta * 1000 - Date.now()).toFormat("h 'hours and' m 'minutes'")
      joiningAt = DateTime.local().plus({ seconds: queue.eta }).toFormat('hh:mm a, MM/dd/yyyy')
    } else {
      eta = 'Unknown (ETA is NaN)'
    }

    let str = `Queue pos: ${queue.lastPos}\nQueue ETA: ${eta}`
    if (joiningAt) {
      str += `\nJoining at: ${joiningAt}`
    }
    await interaction.reply(str)
  }
}

@Discord()
@SlashGroup({ description: 'Local server related commands', name: 'local' })
@SlashGroup('local')
export class LocalServerCommands {
  @Slash({ description: 'Start local server.' })
  async start (
    @SlashOption({
      description: 'specific username to start.',
      name: 'username',
      required: false,
      type: ApplicationCommandOptionType.String
    })
    username: string = '/0all',
    interaction: CommandInteraction,
    client: Client
  ) {
    const mcServer = client.mcServer

    if (username !== '/0all') {
      // skip if specified username AND specified does not match local instance
      if (mcServer.bOpts.username !== username) return
    }

    if (mcServer.isProxyConnected()) {
      interaction.reply('We are already connected to the server!')
      return
    }

    mcServer.start()

    await interaction.reply('Server started!')
  }

  @Slash({ description: 'Stop local server.' })
  async stop (
    @SlashOption({
      description: 'specific username to start.',
      name: 'username',
      required: false,
      type: ApplicationCommandOptionType.String
    })
    username: string = '/0all',

    interaction: CommandInteraction,
    client: Client
  ) {
    const mcServer = client.mcServer

    if (username !== '/0all') {
      // skip if specified username AND specified does not match local instance
      if (mcServer.bOpts.username !== username) return
    }

    if (!mcServer.isProxyConnected()) {
      await interaction.reply('We are already disconnected from the server!')
      return
    }

    mcServer.stop()

    await interaction.reply('Server stopped!')
  }

  @Slash({
    description: 'Attempt to start server so that the bot is ready to play at a certain time.'
  })
  async playat (
  @SlashOption({
    description: 'hour value',
    name: 'hour',
    required: true,
    type: ApplicationCommandOptionType.Number
  })
    hour: number,
    @SlashOption({
      description: 'minute value',
      name: 'minute',
      required: true,
      type: ApplicationCommandOptionType.Number
    })
    minute: number,

    @SlashOption({
      description: "specific username to start at time. Matches CONFIG'S username.",
      name: 'username',
      required: false,
      type: ApplicationCommandOptionType.String
    })
    username: string = '/0all',
    interaction: CommandInteraction,
    client: Client
  ) {
    const mcServer = client.mcServer

    if (username !== '/0all') {
      // skip if specified username AND specified does not match local instance
      if (mcServer.bOpts.username !== username) return
    }

    if (mcServer.isProxyConnected()) {
      await interaction.reply('We are already connected to the server!')
      return
    }

    const secondsTilStart = await tentativeStartTime(hour, minute)
    const hoursTilStart = Math.floor(secondsTilStart / 3600)
    const minutesTilStart = Math.ceil((secondsTilStart - hoursTilStart * 3600) / 60)

    const dateStart = DateTime.local().plus({ seconds: secondsTilStart })
    const data = hourAndMinToDateTime(hour, minute)
    if (secondsTilStart > 0) {
      interaction.reply(
        `To play at ${data.toFormat('MM/dd hh:mm a').toLowerCase()}, ` +
          `the server will start in ${hoursTilStart} hours and ${minutesTilStart} minutes!\n` +
          `Start time: ${dateStart.toFormat('hh:mm a, MM/dd/yyyy')}`
      )
    } else {
      interaction.reply(
        `To play at ${data.toFormat('MM/dd hh:mm a').toLowerCase()}, ` +
          'the server should right now!\n' +
          `Start time: ${DateTime.local().toFormat('hh:mm a, MM/dd/yyyy')}`
      )
    }

    await waitUntilStartingTime(hoursTilStart, minutesTilStart)
    mcServer.start()
  }
}

@Discord()
export class GeneralCommands {
  @Slash({ description: 'Ping a minecraft server.' })
  async ping (
  @SlashOption({
    description: 'host value',
    name: 'host',
    required: true,
    type: ApplicationCommandOptionType.String
  })
    host: string,
    @SlashOption({
      description: 'port value',
      name: 'port',
      required: false,
      type: ApplicationCommandOptionType.Number
    })
    port: number = 25565,
    interaction: CommandInteraction
  ) {
    await interaction.reply(`Pinging ${host}${port === 25565 ? '' : ':' + port}!`)

    const num = await pingTime(host, port)
    if (Number.isNaN(num)) {
      await interaction.editReply('There was a problem pinging the server. (Value is NaN)')
      return
    }
    await interaction.editReply(`Response time was: ${num} ms.`)
  }

  @Slash({ description: 'invite' })
  invite (interaction: CommandInteraction, client: Client) {
    interaction.reply(
      client.generateInvite({
        permissions: 'Administrator',
        scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands]
      })
    )
  }
}
