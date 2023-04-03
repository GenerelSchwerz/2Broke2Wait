/**
 * This entire file is outdated, will be rewritten.
 */



import { Options } from './options'
import type { Bot } from 'mineflayer'
import {
  ClientWebhookReporter,
  AntiAFKWebhookReporter,
  WebhookEmbedConfig,
  BaseWebhookOpts
} from '../abstract/webhookReporters'
import { DateTime, Duration } from 'ts-luxon'
import { ProxyServer } from '../localServer/baseServer'
import { SpectatorServerEvents } from '../localServer/plugins/spectator'
import { PacketQueuePredictor } from '../abstract/packetQueuePredictor'

function escapeMarkdown (...texts: string[]): string[] {
  for (const text in texts) {
    const unescaped = texts[text].replace(/\\(\*|_|:|`|~|\\)/g, '$1') // Unescape backslashed characters
    texts[text] = unescaped.replace(/(\*|_|:|`|~|\\)/g, '\\$1') // Escape *, _, :, `, ~, \
  }

  return texts
}



// =================================
//   Client-specifc listeners
// =================================

class GameChatListener extends ClientWebhookReporter<Bot, 'chat'> {
  constructor (srv: ProxyServer<any, any>, wbOpts: BaseWebhookOpts) {
    super(srv, srv.remoteBot!, 'chat', wbOpts, { skipTitle: false, skipFooter: false })
  }

  protected listener = async (username: string, message: string) => {
    const embed = this.buildClientEmbed()
    embed.author = {
      name: username,
      icon_url: `https://minotar.net/helm/${username}/69.png`
    }

    embed.description = escapeMarkdown(message)[0]

    await this.webhookClient.send({
      embeds: [embed]
    })
  }
}

// =================================
//   Server-specifc listeners
// =================================

type WbKey = Exclude<keyof Exclude<Options['discord']['webhooks'], undefined>, 'enabled'>
type RelaxedWbKey = WbKey | 'relaxed'
type WbChoice<Choice extends RelaxedWbKey> = Choice extends WbKey
  ? Exclude<Options['discord']['webhooks'], undefined>[Choice]
  : BaseWebhookOpts

// typing definition.
abstract class SpectatorServerReporter<
  T extends keyof SpectatorServerEvents,
  Opts extends RelaxedWbKey = 'relaxed'
> extends AntiAFKWebhookReporter<ProxyServer<any, SpectatorServerEvents>, T, WbChoice<Opts>> {}

// Send started message when server starts.
class ServerStartMessenger extends SpectatorServerReporter<'started'> {
  constructor (srv: ProxyServer<any, any>, queue: PacketQueuePredictor<any, any>, wbOpts: BaseWebhookOpts) {
    super(srv, 'started', queue, wbOpts, { skipTitle: true, skipFooter: false })
  }

  protected listener = async () => {
    const embed = this.buildServerEmbed()

    embed.description = `Started at: ${DateTime.local().toFormat('hh:mm a MM/dd/yyyy')}\n`

    await this.webhookClient.send({
      embeds: [embed]
    })
  }
}

// Send started message when server starts.
class ServerStopMessenger extends SpectatorServerReporter<'stopped'> {
  constructor (srv: ProxyServer<any, any>, queue: PacketQueuePredictor<any, any>, wbOpts: BaseWebhookOpts) {
    super(srv, 'stopped', queue, wbOpts, { skipTitle: true, skipFooter: false })
  }

  protected listener = async () => {
    const embed = this.buildServerEmbed()

    embed.description = `Closed at: ${DateTime.local().toFormat('hh:mm a MM/dd/yyyy')}\n`

    await this.webhookClient.send({
      embeds: [embed]
    })
  }
}

// Send started message when server starts.
class QueueUpdateMessenger extends SpectatorServerReporter<'queueUpdate', 'queue'> {
  constructor (srv: ProxyServer<any, any>, queue: PacketQueuePredictor<any, any>, wbOpts: WbChoice<'queue'>) {
    super(srv, 'queueUpdate', queue, wbOpts)
  }

  protected listener = async (oldPos: number, newPos: number, eta: number) => {
    if (newPos > this.wbOpts.reportAt) return

    const embed = this.buildServerEmbed()

    const strETA = !Number.isNaN(eta)
      ? Duration.fromMillis(eta * 1000 - Date.now()).toFormat("h 'hours and ' m 'minutes'")
      : 'Unknown (NaN)'

    embed.description =
      `Current time: ${DateTime.local().toFormat('hh:mm a MM/dd/yyyy')}\n` +
      `Old position: ${oldPos}\n` +
      `New position: ${newPos}\n` +
      `Estimated ETA: ${strETA}`

    await this.webhookClient.send({
      embeds: [embed]
    })
  }
}

// Send started message when server starts.
class ServerEnteredQueueMessenger extends SpectatorServerReporter<'enteredQueue'> {
  constructor (srv: ProxyServer<any, any>,queue: PacketQueuePredictor<any, any>, wbOpts: BaseWebhookOpts) {
    super(srv, 'enteredQueue', queue, wbOpts)
  }

  protected listener = async () => {
    const embed = this.buildServerEmbed()

    embed.description = `Entered queue at ${DateTime.local().toFormat('hh:mm a MM/dd/yyyy')}`

    await this.webhookClient.send({
      embeds: [embed]
    })
  }
}

export function applyWebhookListeners (srv: ProxyServer<any, any>, queue: PacketQueuePredictor<any, any>, config: Options['discord']['webhooks']) {
  if (!config?.enabled) return

  if (!!config.queue && !!config.queue.url) {
    const queueUpdates = new QueueUpdateMessenger(srv, queue, config.queue)
    const enteredQueue = new ServerEnteredQueueMessenger(srv, queue, config.queue)
    // srv.registerServerListeners(queueUpdates, enteredQueue)
  } else {
    console.log('Queue webhook url is not defined, skipping!')
  }

  if (!!config.gameChat && config.gameChat.url) {
    const gameChatHelper = new GameChatListener(srv, config.gameChat)
    // srv.registerClientListeners(gameChatHelper)
  } else {
    console.log('Game chat webhook URL is not defined, skipping!')
  }

  if (config.serverInfo && config.serverInfo.url) {
    const serverStart = new ServerStartMessenger(srv, queue, config.serverInfo)
    const serverStop = new ServerStopMessenger(srv, queue, config.serverInfo)
    // srv.registerServerListeners(serverStart, serverStop)
  } else {
    console.log('Server info webhook URl is not defined, skipping!')
  }
}
