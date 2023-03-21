import { Options } from './options'
import type { Bot } from 'mineflayer'
import {
  ClientWebhookReporter,
  AntiAFKWebhookReporter
} from '../abstract/webhookReporters'
import { DateTime, Duration } from 'ts-luxon'
import { ProxyServer } from '../abstract/proxyServer'
import { AntiAFKServer } from '../impls/antiAfkServer'

function escapeMarkdown (...texts: string[]): string[] {
  for (const text in texts) {
    const unescaped = texts[text].replace(/\\(\*|_|:|`|~|\\)/g, '$1') // Unescape backslashed characters
    texts[text] = unescaped.replace(/(\*|_|:|`|~|\\)/g, '\\$1') // Escape *, _, :, `, ~, \
  }

  return texts
}

// since chat is only triggered by players, no need to wait for in queue.
class GameChatListener extends ClientWebhookReporter<Bot, 'chat'> {
  constructor (srv: AntiAFKServer, webhookUrl: string) {
    super(srv, srv.remoteBot!, 'chat', webhookUrl)
  }

  protected listener = async (username: string, message: string) => {
    const embed = this.buildClientEmbed()
    embed.author = {
      name: `Account: ${username}`,
      icon_url: `https://minotar.net/helm/${username}/69.png`
    }

    embed.description = escapeMarkdown(message)[0]

    const data = await this.webhookClient.send({
      embeds: [embed]
    })
  }
}

// Send started message when server starts.
class ServerStartMessenger extends AntiAFKWebhookReporter<'started'> {
  constructor (srv: AntiAFKServer, webhookUrl: string) {
    super(srv, 'started', webhookUrl)
  }

  protected listener = async () => {
    const embed = this.buildServerEmbed()
    const data = await this.webhookClient.send({
      embeds: [embed]
    })
  }
}

// Send started message when server starts.
class ServerStopMessenger extends AntiAFKWebhookReporter<'closedConnections'> {
  constructor (srv: AntiAFKServer, webhookUrl: string) {
    super(srv, 'closedConnections', webhookUrl)
  }

  protected listener = async (reason: string) => {
    const embed = this.buildServerEmbed()

    embed.description =
      `Closed at: ${DateTime.local().toFormat('hh:mm a MM/dd/yyyy')}\n` +
      `Reason: ${reason}`

    const data = await this.webhookClient.send({
      embeds: [embed]
    })
  }
}

// Send started message when server starts.
class ServerQueueUpdateMessenger extends AntiAFKWebhookReporter<'queueUpdate'> {
  constructor (srv: AntiAFKServer, webhookUrl: string) {
    super(srv, 'queueUpdate', webhookUrl)
  }

  protected listener = async (oldPos: number, newPos: number, eta: number) => {
    const embed = this.buildServerEmbed()

    const strETA = !Number.isNaN(eta)
      ? Duration.fromMillis(eta * 1000 - Date.now()).toFormat("h 'hours and ' m 'minutes'")
      : 'Unknown (NaN)'

    embed.description =
      `Current time: ${DateTime.local().toFormat('hh:mm a MM/dd/yyyy')}\n` +
      `Old position: ${oldPos}\n` +
      `New position: ${newPos}\n` +
      `Estimated ETA: ${strETA}`

    const data = await this.webhookClient.send({
      embeds: [embed]
    })
  }
}

// Send started message when server starts.
class ServerEnteredQueueMessenger extends AntiAFKWebhookReporter<'enteredQueue'> {
  constructor (srv: AntiAFKServer, webhookUrl: string) {
    super(srv, 'enteredQueue', webhookUrl)
  }

  protected listener = async () => {
    const embed = this.buildServerEmbed()

    embed.description = `Entered queue at ${DateTime.local().toFormat(
      'hh:mm a MM/dd/yyyy'
    )}`

    const data = await this.webhookClient.send({
      embeds: [embed]
    })
  }
}

export function applyWebhookListeners (
  srv: AntiAFKServer<any, any>,
  config: Options['discord']['webhooks']
) {
  if (!config.enabled) return

  if (!!config.queue || !!config.spam) {
    const queueUpdates = new ServerQueueUpdateMessenger(srv, config.queue || config.spam)
    const enteredQueue = new ServerEnteredQueueMessenger(srv, config.queue || config.spam)
    srv.registerServerListeners(queueUpdates, enteredQueue)
  }
  if (!!config.gameChat || !!config.spam) {
    const gameChatHelper = new GameChatListener(srv, config.gameChat || config.spam)
    srv.registerClientListeners(gameChatHelper)
  }

  if (config.spam) {
    const start = new ServerStartMessenger(srv, config.spam)
    const stop = new ServerStopMessenger(srv, config.spam)
    srv.registerServerListeners(start, stop)
  }
}
