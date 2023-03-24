import { APIEmbed, WebhookClient } from 'discord.js'
import merge from 'ts-deepmerge'
import { DateTime, Duration } from 'ts-luxon'
import {
  ClientEventRegister,
  QueueEventRegister,
  ServerEventRegister
} from '../abstract/eventRegisters'
import { AntiAFKServer, StrictAntiAFKEvents } from '../impls/antiAfkServer'

import { ClientEmitters, ClientEvent } from '../util/utilTypes'
import { PacketQueuePredictorEvents } from './packetQueuePredictor'
import { IProxyServerEvents, ProxyServer } from './proxyServer'


export interface ClientWebhookReporterOptions {
  eventTitle: boolean;
}

const DefaultOptions: ClientWebhookReporterOptions = {
  eventTitle: true
}

export abstract class ClientWebhookReporter<
  Src extends ClientEmitters,
  L extends ClientEvent<Src>
> extends ClientEventRegister<Src, L> {
  protected readonly webhookClient: WebhookClient


  constructor (
    protected readonly srv: ProxyServer,
    emitter: Src,
    eventWanted: L,
    protected readonly url: string,
    protected readonly opts: Partial<ClientWebhookReporterOptions> = DefaultOptions
  ) {
    super(emitter, eventWanted)
    this.webhookClient = new WebhookClient({ url })
    this.opts = merge(DefaultOptions, opts);
  }

  protected buildClientEmbed (): APIEmbed {
    const embed: APIEmbed = {
      title: this.opts.eventTitle ? this.wantedEvent : undefined
    }

    if (this.srv.controllingPlayer != null) {
      embed.footer = {
        text: 'Connected player: ' + this.srv.controllingPlayer.username
      }
    }
    return embed
  }
}

const NiceServerNames: { [key in keyof StrictAntiAFKEvents]: string } = {
  botSpawn: 'Bot has spawned!',
  closedConnections: 'Server closed!',
  enteredQueue: 'Entered the queue!',
  invalidData: 'Invalid queue data',
  leftQueue: 'Left the queue!',
  queueUpdate: 'Queue update!',
  remoteError: 'Remote disconnect (Error)',
  remoteKick: 'Remote disconnect (Kicked)',
  started: 'Server started!',
  stopped: 'Server stopped!',
  health: 'Bot health update!',
  breath: 'Bot breath update!'
} as const

export abstract class AntiAFKWebhookReporter<
  T extends keyof StrictAntiAFKEvents
> extends ServerEventRegister<StrictAntiAFKEvents, T, AntiAFKServer> {
  protected readonly webhookClient: WebhookClient

  constructor (srv: AntiAFKServer, event: T, public url: string, protected readonly opts: Partial<ClientWebhookReporterOptions> = DefaultOptions) {
    super(srv, event)
    this.webhookClient = new WebhookClient({ url })
    this.opts = merge(DefaultOptions, opts);
  }

  protected buildServerEmbed () {
    const eta = !Number.isNaN(this.srv.queue?.eta) ? Duration.fromMillis(this.srv.queue!.eta * 1000 - Date.now()) : null

    const embed: APIEmbed = {
      title: this.opts.eventTitle ? NiceServerNames[this.wantedEvent] : undefined,
      footer: {
        text: (this.srv.isProxyConnected() ? `Connected to: ${this.srv.bOpts.host}${this.srv.bOpts.port !== 25565 ? ':' + this.srv.bOpts.port : ''}\n` : 'Not connected.\n') +
              ((this.srv.controllingPlayer != null) ? `Connected player: ${this.srv.controllingPlayer.username}\n` : '') +
              (this.srv.queue?.inQueue && !(eta == null) ? `Join time: ${DateTime.local().plus(eta).toFormat('hh:mm a MM/dd/yyyy')}\n` : '')
      }
    }
    return embed
  }
}
