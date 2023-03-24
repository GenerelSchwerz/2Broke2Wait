import { APIEmbed, WebhookClient } from "discord.js";
import merge from "ts-deepmerge";
import { DateTime, Duration } from "ts-luxon";
import { ClientEventRegister, ServerEventRegister } from "../abstract/eventRegisters";
import { AntiAFKServer, StrictAntiAFKEvents } from "../impls/antiAfkServer";

import { ClientEmitters, ClientEvent } from "../util/utilTypes";
import { ProxyServer } from "./proxyServer";

export interface WebhookReporterEmbedOpts {
  eventTitle: boolean;
  footer: boolean;
}

const DefaultOptions: WebhookReporterEmbedOpts = {
  eventTitle: true,
  footer: true,
};

export abstract class ClientWebhookReporter<
  Src extends ClientEmitters,
  L extends ClientEvent<Src>
> extends ClientEventRegister<Src, L> {
  protected readonly webhookClient: WebhookClient;

  constructor(
    protected readonly srv: ProxyServer,
    emitter: Src,
    eventWanted: L,
    protected readonly url: string,
    protected readonly opts: Partial<WebhookReporterEmbedOpts> = DefaultOptions
  ) {
    super(emitter, eventWanted);
    this.webhookClient = new WebhookClient({ url });
    this.opts = merge(DefaultOptions, opts);
  }

  protected buildClientEmbed(): APIEmbed {
    const embed: APIEmbed = {
      title: this.opts.eventTitle ? this.wantedEvent : undefined,
    };

    if (this.srv.controllingPlayer != null) {
      if (this.opts.footer) {
        embed.footer = {
          text: "Connected player: " + this.srv.controllingPlayer.username,
        };
      }
    }
    return embed;
  }
}

const NiceServerNames: { [key in keyof StrictAntiAFKEvents]: string } = {
  botSpawn: "Bot has spawned!",
  closedConnections: "Kicked everyone!",
  enteredQueue: "Entered the queue!",
  invalidData: "Invalid queue data",
  leftQueue: "Left the queue!",
  queueUpdate: "Queue update!",
  remoteError: "Remote disconnect (Error)",
  remoteKick: "Remote disconnect (Kicked)",
  setup: "Server is setting up!",
  started: "Server started!",
  stopped: "Server stopped!",
  health: "Bot health update!",
  breath: "Bot breath update!",
} as const;

export abstract class AntiAFKWebhookReporter<T extends keyof StrictAntiAFKEvents> extends ServerEventRegister<
  StrictAntiAFKEvents,
  T,
  AntiAFKServer
> {
  protected readonly webhookClient: WebhookClient;

  constructor(
    srv: AntiAFKServer,
    event: T,
    public url: string,
    protected readonly opts: Partial<WebhookReporterEmbedOpts> = DefaultOptions
  ) {
    super(srv, event);
    this.webhookClient = new WebhookClient({ url });
    this.opts = merge(DefaultOptions, opts);
  }

  protected buildServerEmbed() {
    let eta = this.srv.queue
      ? !Number.isNaN(this.srv.queue.eta)
        ? Duration.fromMillis(this.srv.queue!.eta * 1000 - Date.now())
        : null
      : null;

    const embed: APIEmbed = {};

    if (this.opts.eventTitle) {
      embed.title =  NiceServerNames[this.wantedEvent];
    }

    if (this.opts.footer) {

      let text;
      if (this.srv.isProxyConnected()) text = `Connected to: ${this.srv.bOpts.host}${this.srv.bOpts.port !== 25565 ? ":" + this.srv.bOpts.port : ""}\n`
      else text = 'Not connected.\n'

      if (this.srv.controllingPlayer != null) text += `Connected player: ${this.srv.controllingPlayer.username}\n`
      if (this.srv.queue?.inQueue && eta != null) text += `Join time: ${DateTime.local().plus(eta).toFormat("hh:mm a MM/dd/yyyy")}\n`

      embed.footer = { text };
 
    }
    return embed;
  }
}
