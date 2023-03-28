import { APIEmbed, WebhookClient, WebhookEditOptions } from 'discord.js'
import merge from 'ts-deepmerge'
import { DateTime, Duration } from 'ts-luxon'
import { ClientEventRegister, ServerEventRegister } from '../abstract/eventRegisters'
import { AntiAFKServer, StrictAntiAFKEvents } from '../impls/antiAfkServer'

import { Arguments, ClientEmitters, ClientEvent } from '../util/utilTypes'
import { ProxyServer } from './proxyServer'

export interface BaseWebhookOpts {
  url: string
  icon?: string
  username?: string
}

export interface WebhookEmbedConfig {
  eventTitle: boolean
  footer: boolean
}

const DefaultOptions: WebhookEmbedConfig = {
  eventTitle: true,
  footer: true
}

abstract class WebhookReporter<Opts extends BaseWebhookOpts = BaseWebhookOpts> {
  protected webhookClient: WebhookClient
  protected config: WebhookEmbedConfig
  constructor (protected wbOpts: Opts, config: Partial<WebhookEmbedConfig> = DefaultOptions) {
    this.webhookClient = new WebhookClient({ url: wbOpts.url })
    this.config = merge(DefaultOptions, config) as any

    this.webhookClient.edit({
      avatar: wbOpts.icon,
      name: wbOpts.username
    }).catch(console.error)
  }

  protected abstract buildEmbed (): APIEmbed

  /**
   * As of right now, simply call webhook client.
   * @param data
   */
  protected send (data: Arguments<WebhookClient['send']>[0]) {
    this.webhookClient.send(data)
  }
}

export abstract class ClientWebhookReporter<
  Src extends ClientEmitters,
  L extends ClientEvent<Src>,
  Opts extends BaseWebhookOpts = BaseWebhookOpts
> extends ClientEventRegister<Src, L> {
  protected readonly webhookClient: WebhookClient

  constructor (
    protected readonly srv: ProxyServer,
    emitter: Src,
    eventWanted: L,
    protected readonly wbOpts: Opts,
    protected readonly opts: Partial<WebhookEmbedConfig> = DefaultOptions
  ) {
    super(emitter, eventWanted)
    this.webhookClient = new WebhookClient({ url: wbOpts.url })
    this.opts = merge(DefaultOptions, opts)

    this.webhookClient.edit({
      avatar: wbOpts.icon,
      name: wbOpts.username
    }).catch(console.error)
  }

  protected buildClientEmbed (): APIEmbed {
    const embed: APIEmbed = {
      title: this.opts.eventTitle ? this.wantedEvent : undefined
    }

    if (this.srv.controllingPlayer != null) {
      if (this.opts.footer) {
        embed.footer = {
          text: 'Connected player: ' + this.srv.controllingPlayer.username
        }
      }
    }
    return embed
  }
}

const NiceEventNames: { [key in Exclude<keyof StrictAntiAFKEvents, `botevent:${string}`>]: string } = {
  closedConnections: 'Kicked everyone!',
  enteredQueue: 'Entered the queue!',
  invalidData: 'Invalid queue data',
  leftQueue: 'Left the queue!',
  queueUpdate: 'Queue update!',
  remoteError: 'Remote disconnect (Error)',
  remoteKick: 'Remote disconnect (Kicked)',
  setup: 'Server is setting up!',
  started: 'Server started!',
  stopped: 'Server stopped!'
} as const

type GetEvents<Srv extends ProxyServer> = Srv extends ProxyServer<any, infer Events> ? Events : never

export abstract class AntiAFKWebhookReporter<Srv extends AntiAFKServer, T extends keyof GetEvents<Srv>, Opts extends BaseWebhookOpts = BaseWebhookOpts> extends ServerEventRegister<
Srv extends ProxyServer<any, infer Events> ? Events : never,
T,
Srv
> {
  protected readonly webhookClient: WebhookClient

  constructor (
    srv: Srv,
    event: T,
    public wbOpts: Opts,
    protected readonly config: Partial<WebhookEmbedConfig> = DefaultOptions
  ) {
    super(srv, event)
    this.webhookClient = new WebhookClient({ url: wbOpts.url })
    this.config = merge(DefaultOptions, config)

    this.webhookClient.edit({
      avatar: wbOpts.icon,
      name: wbOpts.username
    }).catch(console.error)
  }

  protected buildServerEmbed () {
    const eta = (this.srv.queue != null)
      ? !Number.isNaN(this.srv.queue.eta)
          ? Duration.fromMillis(this.srv.queue.eta * 1000 - Date.now())
          : null
      : null

    const embed: APIEmbed = {}

    if (this.config.eventTitle) {
      embed.title = (NiceEventNames as any)[this.wantedEvent] ?? this.wantedEvent
    }

    if (this.config.footer) {
      let text
      if (this.srv.isProxyConnected()) {
        text = `Connected to: ${this.srv.bOpts.host}`
        if (this.srv.bOpts.port !== 25565) text += `:${this.srv.bOpts.port}`
        text += '\n'
      }
      else text = 'Not connected.\n'

      if (this.srv.controllingPlayer != null) text += `Connected player: ${this.srv.controllingPlayer.username}\n`
      if (this.srv.queue?.inQueue && eta != null) text += `Join time: ${DateTime.local().plus(eta).toFormat('hh:mm a MM/dd/yyyy')}\n`

      embed.footer = { text }
    }
    return embed
  }
}
