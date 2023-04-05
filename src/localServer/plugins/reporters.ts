import { ServerClient } from 'minecraft-protocol'
import { AllEvents, AllOpts, BaseWebhookOpts } from '.'
import { ProxyServerPlugin, ProxyServer } from '../baseServer'
import { Conn } from '@rob9315/mcproxy'

import { DateTime, Duration } from 'ts-luxon'
import { APIEmbed, WebhookClient } from 'discord.js'
import { DiscordWebhookOptions, Options, QueueSetup } from '../../util/options'
import { CombinedPredictor } from '../predictors/combinedPredictor'
import type { Bot } from 'mineflayer'

export class ConsoleReporter extends ProxyServerPlugin<AllOpts, AllEvents> {
  constructor (public debug = false) {
    super()
  }

  public onLoad (server: ProxyServer<AllOpts, AllEvents>): void {
    super.onLoad(server)

    server.on('enteredQueue', this.onEnteredQueue)
    server.on('leftQueue', this.onLeftQueue)
    server.on('queueUpdate', this.onQueueUpdate)
  }

  private getRemoteServerName (): string {
    return this.server.bOpts.host + (this.server.bOpts.port !== 25565 ? ':' + this.server.bOpts.port : '')
  }

  onPostStart = () => {
    console.log('Server started!')
  }

  onPostStop = () => {
    console.log('Server stopped!')
  }

  onBotStartup = (bot: Bot) => {
    console.log('Bot is now moving independently!')
  }

  onBotShutdown = (bot: Bot) => {
    console.log('Bot has stopped moving independently!')
  }

  onRemoteError = (error: Error) => {
    console.error('[ERROR]: Remote disconnected!', error)
  }

  onRemoteKick = (reason: string) => {
    console.warn('[KICKED] Remote disconnected!', reason)
  }

  onPlayerConnected = (client: ServerClient, remoteConnected: boolean) => {
    const { address, family, port } = {
      address: 'UNKNOWN',
      family: 'UNKNOWN',
      port: 'UNKNOWN',
      ...client.socket.address()
    }

    console.log(`Player [${client.username}] connected from ${address}:${port}`)
  }

  onEnteredQueue = () => {
    console.log('Entered queue!')
  }

  onLeftQueue = () => {
    console.log('Left queue!')
  }

  onQueueUpdate = (oldPos: number, newPos: number, eta: number, givenEta?: number) => {
    let etaStr
    if (Number.isNaN(eta)) {
      etaStr = 'ETA: Unknown.'
    } else {
      etaStr = `ETA: ${Duration.fromMillis(eta * 1000 - Date.now()).toFormat("d'd', h'hr', m'min'")}`
    }

    if (!Number.isNaN(givenEta) && givenEta != null) {
      etaStr += ` | Given ETA: ${Duration.fromMillis(givenEta * 1000 - Date.now()).toFormat("d'd', h'hr', m'min'")}`
    }

    console.log('Queue update!')
    console.log(`\t${this.getRemoteServerName()} | Pos: ${newPos} | ${etaStr}`)
  }
}

export class MotdReporter extends ProxyServerPlugin<AllOpts, AllEvents> {
  constructor (public readonly opts: Options['localServerConfig']['display']) {
    super()
  }

  public onLoad (server: ProxyServer<AllOpts, AllEvents>): void {
    super.onLoad(server)
    server.on('botevent_health', this.botUpdatesMotd)
    server.on('remoteKick', this.kickedServerMotd)
    server.on('remoteError', this.errorServerMotd)
    server.on('enteredQueue', this.queueEnterMotd)
    server.on('leftQueue', this.inGameServerMotd)
  }

  kickedServerMotd = (reason: string) => {
    this.setServerMotd(`Kicked from ${this.getRemoteServerName()}!`)
  }

  errorServerMotd = (reason: Error) => {
    this.setServerMotd(`Errored! Disconnected from ${this.getRemoteServerName()}!`)
  }

  queueEnterMotd = () => {
    this.setServerMotd(`Entered queue on ${this.getRemoteServerName()}`)
  }

  inGameServerMotd = () => {
    this.setServerMotd(`Playing on ${this.getRemoteServerName()}!`)
  }

  botUpdatesMotd = (bot: Bot) => {
    this.setServerMotd(`Health: ${bot.health.toFixed(2)}, Hunger: ${bot.food.toFixed(2)}`)
  }

  getRemoteServerName (): string {
    return this.server.bOpts.host + (this.server.bOpts.port !== 25565 ? ':' + this.server.bOpts.port : '')
  }

  setServerMotd (message: string) {
    if (this.opts.motdPrefix) {
      this.server.rawServer.motd = this.opts.motdPrefix + message
    } else {
      this.server.rawServer.motd = message
    }
  }
}

type CleanEvents = AllEvents[Exclude<keyof AllEvents, `botevent_${string}`>]

type WebhookWrapper = {
  client: WebhookClient
  config?: WebhookEmbedConfig
} & BaseWebhookOpts

interface WebhookEmbedConfig {
  skipTitle?: boolean
  skipFooter?: boolean
}

const NiceEventNames: { [key in keyof CleanEvents]: string } = {
  closingConnections: 'Kicked everyone!',
  enteredQueue: 'Entered the queue!',
  invalidData: 'Invalid queue data',
  leftQueue: 'Left the queue!',
  queueUpdate: 'Queue update!',
  remoteError: 'Remote disconnect (Error)',
  remoteKick: 'Remote disconnect (Kicked)',
  starting: 'Server is starting up!',
  started: 'Server started!',
  stopping: 'Server is stopping!',
  stopped: 'Server stopped!',
  optionValidation: 'Option configuration checking!',
  initialBotSetup: 'Bot initialization!',
  botShutdown: 'Bot activity stopped!',
  botStartup: 'Bot activity started!',
  playerConnected: 'Player connected!',
  playerDisconnected: 'Player disconnected!',
  proxySetup: 'Setting up proxy!',
  restart: 'Server is restarting!',
  clientChat: 'Local proxy chat!',
  clientChatRaw: 'Local proxy chat (raw)!',
  '*': 'Any event...'
} as const

async function updateWebhook (
  webhookInfo: { client: WebhookClient } & BaseWebhookOpts,
  reason = 'Automatic update from 2b2w'
) {
  return await webhookInfo.client.edit({
    avatar: webhookInfo.icon,
    name: webhookInfo.username,
    reason
  })
}

function escapeMarkdown (...texts: string[]): string[] {
  for (const text in texts) {
    const unescaped = texts[text].replace(/\\(\*|_|:|`|~|\\)/g, '$1') // Unescape backslashed characters
    texts[text] = unescaped.replace(/(\*|_|:|`|~|\\)/g, '\\$1') // Escape *, _, :, `, ~, \
  }

  return texts
}

export class WebhookReporter extends ProxyServerPlugin<AllOpts, AllEvents> {
  public queueInfo: WebhookWrapper & QueueSetup
  public serverInfo: WebhookWrapper
  public gameChat: WebhookWrapper

  constructor (webhookUrls: DiscordWebhookOptions) {
    super()

    this.queueInfo = {
      client: new WebhookClient({ url: webhookUrls.queue.url }),
      config: { skipFooter: true },
      ...webhookUrls.queue
    }

    this.serverInfo = {
      client: new WebhookClient({ url: webhookUrls.serverInfo.url }),
      config: { skipFooter: true },
      ...webhookUrls.queue
    }

    this.gameChat = {
      client: new WebhookClient({ url: webhookUrls.gameChat.url }),
      config: { skipTitle: true },
      ...webhookUrls.queue
    }

    updateWebhook(this.queueInfo)
    updateWebhook(this.serverInfo)
    updateWebhook(this.gameChat)
  }

  public onLoad (server: ProxyServer<AllOpts, AllEvents>): void {
    super.onLoad(server)
    server.on('queueUpdate', this.onQueueUpdate)
    server.on('enteredQueue', this.onEnteredQueue)
    server.on('leftQueue', this.onLeftQueue)
    server.on('botevent_chat', this.onBotChat)
  }

  public onUnload (server: ProxyServer<AllOpts, AllEvents>): void {
    super.onUnload(server)
    server.off('queueUpdate', this.onQueueUpdate)
    server.off('enteredQueue', this.onEnteredQueue)
    server.off('leftQueue', this.onLeftQueue)
    server.off('botevent_chat', this.onBotChat)
  }

  onPreStart = async (): Promise<void> => {
    const embed = this.buildServerEmbed('starting', this.serverInfo.config)
    embed.description = `Started at: ${DateTime.local().toFormat('hh:mm a MM/dd/yyyy')}\n`
    await this.serverInfo.client.send({
      embeds: [embed]
    })
  }

  onPreStop = async (): Promise<void> => {
    const embed = this.buildServerEmbed('stopping', this.serverInfo.config)
    embed.description = `Closed at: ${DateTime.local().toFormat('hh:mm a MM/dd/yyyy')}\n`
    await this.serverInfo.client.send({
      embeds: [embed]
    })
  }

  onBotChat = async (_bot: Bot, username: string, message: string) => {
    const embed = this.buildClientEmbed('chat', this.gameChat.config)
    embed.author = {
      name: username,
      icon_url: `https://minotar.net/helm/${username}/69.png`
    }

    embed.description = escapeMarkdown(message)[0]

    await this.gameChat.client.send({
      embeds: [embed]
    })
  }

  onLeftQueue = async () => {
    const embed = this.buildServerEmbed('leftQueue', this.queueInfo.config)
    embed.description = `Left queue at ${DateTime.local().toFormat('hh:mm a MM/dd/yyyy')}`
    await this.queueInfo.client.send({
      embeds: [embed]
    })
  }

  onEnteredQueue = async () => {
    const embed = this.buildServerEmbed('enteredQueue', this.queueInfo.config)
    embed.description = `Entered queue at ${DateTime.local().toFormat('hh:mm a MM/dd/yyyy')}`
    await this.queueInfo.client.send({
      embeds: [embed]
    })
  }

  onQueueUpdate = async (oldPos: number, newPos: number, eta: number, givenEta?: number) => {
    const embed = this.buildServerEmbed('queueUpdate', this.queueInfo.config)

    const strETA = !Number.isNaN(eta)
      ? Duration.fromMillis(eta * 1000 - Date.now()).toFormat("h 'hours and ' m 'minutes'")
      : 'Unknown (NaN)'

    const twoBETA =
      !givenEta || Number.isNaN(givenEta)
        ? 'Unknown (NaN)'
        : Duration.fromMillis(givenEta * 1000 - Date.now()).toFormat("h 'hours and ' m 'minutes'")

    embed.description =
      `Current time: ${DateTime.local().toFormat('hh:mm a MM/dd/yyyy')}\n` +
      `Old position: ${oldPos}\n` +
      `New position: ${newPos}\n` +
      `Estimated ETA: ${strETA}\n` +
      `2b2t's ETA: ${twoBETA}`

    await this.queueInfo.client.send({
      embeds: [embed]
    })
  }

  private buildClientEmbed (wantedEvent: string, config?: WebhookEmbedConfig): APIEmbed
  private buildClientEmbed (wantedEvent: keyof CleanEvents | string, config: WebhookEmbedConfig = {}): APIEmbed {
    wantedEvent = (NiceEventNames as any)[wantedEvent] ?? wantedEvent

    const embed: APIEmbed = {
      title: config.skipTitle ? undefined : wantedEvent
    }

    if (config.skipFooter) return embed

    if (this.server.controllingPlayer != null) {
      embed.footer = {
        text: `Connected player: ${this.server.controllingPlayer.username}`
      }
    }
    return embed
  }

  private buildServerEmbed (wantedEvent: string, config?: WebhookEmbedConfig): APIEmbed
  private buildServerEmbed (wantedEvent: keyof AllEvents | string, config: WebhookEmbedConfig = {}) {
    wantedEvent = (NiceEventNames as any)[wantedEvent] ?? wantedEvent
    const embed: APIEmbed = {
      title: config.skipTitle ? undefined : wantedEvent
    }

    const queue = this.getShared<CombinedPredictor>('queue')

    let eta = null
    if (queue != null) {
      eta = Number.isNaN(queue.eta) ? null : Duration.fromMillis(queue.eta * 1000 - Date.now())
    }

    if (config.skipFooter) return embed

    let text
    if (this.server.isProxyConnected()) {
      text = `Connected to: ${this.server.bOpts.host}`
      if (this.server.bOpts.port !== 25565) text += `:${this.server.bOpts.port}`
      text += '\n'
    } else {
      text = 'Not connected.\n'
    }

    if (this.server.controllingPlayer != null) text += `Connected player: ${this.server.controllingPlayer.username}\n`
    if (queue?.inQueue && eta != null) { text += `Join time: ${DateTime.local().plus(eta).toFormat('hh:mm a MM/dd/yyyy')}\n` }

    embed.footer = { text }

    return embed
  }
}
