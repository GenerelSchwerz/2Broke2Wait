import { APIEmbed, WebhookClient } from 'discord.js'
import { ServerClient } from 'minecraft-protocol'
import type { Bot } from 'mineflayer'
import { DateTime, Duration } from 'ts-luxon'
import { AllEvents, AllOpts, BaseWebhookOpts } from '.'
import { DiscordWebhookOptions, GameChatSetup, Options, QueueSetup } from '../../types/options'
import { ProxyServer, ProxyServerPlugin } from '../baseServer'
import { CombinedPredictor } from '../predictors/combinedPredictor'
import { TwoBAntiAFKEvents } from './twoBAntiAFK'


export class ConsoleReporter extends ProxyServerPlugin<{}, TwoBAntiAFKEvents> {
  constructor (public debug = false) {
    super()
  }

  public onLoad (server: ProxyServer<{}, TwoBAntiAFKEvents>): void {
    super.onLoad(server)
    this.serverOn('enteredQueue', this.onEnteredQueue)
    this.serverOn('leftQueue', this.onLeftQueue)
    this.serverOn('queueUpdate', this.onQueueUpdate)
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

  onBotAutonomous = (bot: Bot) => {
    console.log('Bot is now moving independently!')
  }

  onBotControlled = (bot: Bot) => {
    console.log('Bot has stopped moving independently!')
  }

  onRemoteDisconnect = (type: string, info: string | Error) => {
    console.error(`[${type.toUpperCase()}]: Remote disconnected!`, info)
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

export class MotdReporter extends ProxyServerPlugin<{}, TwoBAntiAFKEvents> {
  constructor (public readonly opts: Options['localServerConfig']['display']) {
    super()
  }

  public onLoad (server: ProxyServer<{}, TwoBAntiAFKEvents>): void {
    super.onLoad(server)
    this.serverOn('botevent_health', this.botUpdatesMotd)
    this.serverOn('remoteDisconnect', this.disconnectServerMotd)
    this.serverOn('enteredQueue', this.queueEnterMotd)
    this.serverOn('leftQueue', this.inGameServerMotd)
    this.serverOn('queueUpdate', this.queueUpdateMotd)
  }

  onPostStart = () => {
    this.setServerMotd(`Joining ${this.getRemoteServerName()}`)
  }

  disconnectServerMotd = (type: string, info: string | Error) => {
    this.setServerMotd(`Disconnected from ${this.getRemoteServerName()}!\n[${type}]: ${String(info).substring(0, 48)}`)
  }

  queueEnterMotd = () => {
    this.setServerMotd(`Entered queue on ${this.getRemoteServerName()}`)
  }

  queueUpdateMotd = (oldPos: number, newPos: number, eta: number, givenEta?: number) => {
    let etaStr
    if (Number.isNaN(eta)) {
      etaStr = 'ETA: Unknown.'
    } else {
      etaStr = `ETA: ${Duration.fromMillis(eta * 1000 - Date.now()).toFormat("d'd', h'hr', m'min'")}`
    }

    if (!Number.isNaN(givenEta) && givenEta != null) {
      etaStr += ` | Given ETA: ${Duration.fromMillis(givenEta * 1000 - Date.now()).toFormat("d'd', h'hr', m'min'")}`
    }

    this.setServerMotd(`${this.getRemoteServerName()} | Pos: ${newPos}\n${etaStr}`)
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
} & BaseWebhookOpts &
({ edit?: false } | { edit: true, firstMessageId?: string })

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
  botControlled: 'Bot activity stopped!',
  botAutonomous: 'Bot activity started!',
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

export class WebhookReporter extends ProxyServerPlugin<{}, TwoBAntiAFKEvents> {
  public queueInfo?: WebhookWrapper & QueueSetup
  public serverInfo?: WebhookWrapper
  public gameChat?: WebhookWrapper & GameChatSetup

  constructor (webhookUrls: DiscordWebhookOptions) {
    super()

    if (webhookUrls.queue.url) {
      this.queueInfo = {
        client: new WebhookClient({ url: webhookUrls.queue.url }),
        config: { skipFooter: true },
        ...webhookUrls.queue
      }
      updateWebhook(this.queueInfo)
    }

    if (webhookUrls.serverInfo.url) {
      this.serverInfo = {
        client: new WebhookClient({ url: webhookUrls.serverInfo.url }),
        config: { skipFooter: true },
        ...webhookUrls.serverInfo
      }
      updateWebhook(this.serverInfo)
    }

    if (webhookUrls.gameChat.url) {
      this.gameChat = {
        client: new WebhookClient({ url: webhookUrls.gameChat.url }),
        config: { skipTitle: true, skipFooter: true },
        ...webhookUrls.gameChat
      }

      updateWebhook(this.gameChat)
    }
  }

  public onLoad (server: ProxyServer<{}, TwoBAntiAFKEvents>): void {
    super.onLoad(server)
    this.serverOn('queueUpdate', this.onQueueUpdate)
    this.serverOn('enteredQueue', this.onEnteredQueue)
    this.serverOn('leftQueue', this.onLeftQueue)
    this.serverOn('botevent_chat', this.onBotChat)
  }

  // 1am edit, im too lazy to add typings.
  private readonly sendOrEdit = async (config: WebhookWrapper, message: any) => {
    if (config.edit) {
      if (config.firstMessageId == null) {
        const msg = await config.client.send(message)
        config.firstMessageId = msg.id
        return msg
      } else {
        return await config.client.editMessage(config.firstMessageId, message)
      }
    } else {
      return await config.client.send(message)
    }
  }

  onPostStart = async (): Promise<void> => {
    if (this.serverInfo == null) return
    const embed = this.buildServerEmbed('started', this.serverInfo.config)
    embed.description = `Started at: ${DateTime.local().toFormat('hh:mm a, MM/dd')}\n`
    await this.serverInfo.client.send({
      embeds: [embed]
    })
  }

  onPostStop = async (): Promise<void> => {
    if (this.serverInfo == null) return
    const embed = this.buildServerEmbed('stopped', this.serverInfo.config)
    embed.description = `Closed at: ${DateTime.local().toFormat('hh:mm a, MM/dd')}\n`
    await this.serverInfo.client.send({
      embeds: [embed]
    })
  }

  onRemoteDisconnect = async (type: string, info: string | Error) => {
    if (this.serverInfo == null) return
    const embed = this.buildServerEmbed('Bot disconnected!', this.serverInfo.config)

    embed.description =
      `Time: ${DateTime.local().toFormat('hh:mm a, MM/dd')}\n` + `Reason: ${String(info).substring(0, 1000)}`

    await this.serverInfo.client.send({
      embeds: [embed]
    })
  }

  onBotChat = async (_bot: Bot, username: string, message: string) => {
    if (this.gameChat == null) return
    const embed = this.buildClientEmbed('chat', this.gameChat.config)
    embed.author = {
      name: username,
      icon_url: `https://minotar.net/helm/${username}/69.png`
    }

    embed.description = escapeMarkdown(message)[0]

    if (this.gameChat.timestamp) {
      if (embed.footer?.text) {
        embed.footer.text += `\nSent: ${DateTime.local().toFormat('hh:mm a, MM/dd')}`
      } else {
        embed.footer = { text: `Sent: ${DateTime.local().toFormat('hh:mm a, MM/dd')}` }
      }
    }

    await this.gameChat.client.send({
      embeds: [embed]
    })
  }

  onLeftQueue = async () => {
    if (this.queueInfo == null) return
    const embed = this.buildServerEmbed('leftQueue', this.queueInfo.config)
    embed.description = `Left queue at ${DateTime.local().toFormat('hh:mm a, MM/dd')}`
    await this.queueInfo.client.send({
      embeds: [embed]
    })
  }

  onEnteredQueue = async () => {
    if (this.queueInfo == null) return
    const embed = this.buildServerEmbed('enteredQueue', this.queueInfo.config)
    embed.description = `Entered queue at ${DateTime.local().toFormat('hh:mm a, MM/dd')}`
    await this.queueInfo.client.send({
      embeds: [embed]
    })
  }

  onQueueUpdate = async (oldPos: number, newPos: number, eta: number, givenEta?: number) => {
    if (this.queueInfo == null) return
    const embed = this.buildServerEmbed('queueUpdate', this.queueInfo.config)

    const strETA = !Number.isNaN(eta)
      ? Duration.fromMillis(eta * 1000 - Date.now()).toFormat("h 'hours and ' m 'minutes'")
      : 'Unknown (NaN)'

    const twoBETA =
      !givenEta || Number.isNaN(givenEta)
        ? 'Unknown (NaN)'
        : Duration.fromMillis(givenEta * 1000 - Date.now()).toFormat("h 'hours and ' m 'minutes'")

    embed.description =
      `Current time: ${DateTime.local().toFormat('hh:mm a, MM/dd')}\n` +
      `Old position: ${oldPos}\n` +
      `New position: ${newPos}\n` +
      `Estimated ETA: ${strETA}\n` +
      `2b2t's ETA: ${twoBETA}`

    await this.sendOrEdit(this.queueInfo, {
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
    if (queue?.inQueue && eta != null) {
      text += `Join time: ${DateTime.local().plus(eta).toFormat('hh:mm a, MM/dd')}\n`
    }

    embed.footer = { text }

    return embed
  }
}
