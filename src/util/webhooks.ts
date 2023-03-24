import { Options } from './options'
import type { Bot } from 'mineflayer'
import {
  ClientWebhookReporter,
  AntiAFKWebhookReporter,
  WebhookReporterEmbedOpts
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

  // just setting opts down here to be cleaner
  opts: WebhookReporterEmbedOpts = { eventTitle: false, footer: false }


  protected listener = async (username: string, message: string) => {
    const embed = this.buildClientEmbed()
    embed.author = {
      name: username,
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

  // just setting opts down here to be cleaner
  opts: WebhookReporterEmbedOpts = { eventTitle: true, footer: false }


  protected listener = async () => {
    const embed = this.buildServerEmbed()

    embed.description =
      `Started at: ${DateTime.local().toFormat('hh:mm a MM/dd/yyyy')}\n`


    const data = await this.webhookClient.send({
      embeds: [embed]
    })
  }
}

// Send started message when server starts.
class ServerStopMessenger extends AntiAFKWebhookReporter<'stopped'> {
  constructor (srv: AntiAFKServer, webhookUrl: string) {
    super(srv, 'stopped', webhookUrl)
  }

  // just setting opts down here to be cleaner
  opts: WebhookReporterEmbedOpts = { eventTitle: true, footer: false }

  protected listener = async () => {
    const embed = this.buildServerEmbed()

    embed.description =
      `Closed at: ${DateTime.local().toFormat('hh:mm a MM/dd/yyyy')}\n`

    const data = await this.webhookClient.send({
      embeds: [embed]
    })
  }
}

// Send started message when server starts.
class ServerQueueUpdateMessenger extends AntiAFKWebhookReporter<'queueUpdate'> {

  public reportAt: number;
  constructor (srv: AntiAFKServer, queueWebhook: Options['discord']['webhooks']['queue']) {
    super(srv, 'queueUpdate', queueWebhook.url)
    this.reportAt = queueWebhook.reportAt
  }

  protected listener = async (oldPos: number, newPos: number, eta: number) => {

    if (newPos > this.reportAt) return;

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

  if (!!config.queue && !!config.queue.url) {
    const queueUpdates = new ServerQueueUpdateMessenger(srv, config.queue)
    const enteredQueue = new ServerEnteredQueueMessenger(srv, config.queue.url)
    srv.registerServerListeners(queueUpdates, enteredQueue);
  } else {
    console.log("Queue webhook url is not defined, skipping!")
  }

  if (!!config.gameChat) {
    const gameChatHelper = new GameChatListener(srv, config.gameChat)
    srv.registerClientListeners(gameChatHelper)
  } else {
    console.log("Game chat webhook URL is not defined, skipping!")
  }

  if (config.serverInfo) {
    const serverStart = new ServerStartMessenger(srv, config.serverInfo)
    const serverStop = new ServerStopMessenger(srv, config.serverInfo)
    srv.registerServerListeners(serverStart, serverStop)
  } else {
    console.log("Server info webhook URl is not defined, skipping!")
  }
}
