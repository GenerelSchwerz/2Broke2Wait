import { APIEmbed, WebhookClient, WebhookEditOptions } from "discord.js";
import merge from "ts-deepmerge";
import { DateTime, Duration } from "ts-luxon";
import { ClientEventRegister, ServerEventRegister } from "../abstract/eventRegisters";
import { ProxyServer } from "../localServer/baseServer";
import { SpectatorServerEvents } from "../localServer/plugins/spectator";
import { TwoBAntiAFKEvents } from "../localServer/plugins/twoBAntiAFK";

import { Arguments, ClientEmitters, ClientEvent } from "../util/utilTypes";
import { PacketQueuePredictor } from "./packetQueuePredictor";

export interface BaseWebhookOpts {
  url: string;
  icon?: string;
  username?: string;
}

export interface WebhookEmbedConfig {
  skipTitle?: boolean;
  skipFooter?: boolean;
}

const DefaultOptions: WebhookEmbedConfig = {
  skipTitle: true,
  skipFooter: true,
};

abstract class WebhookReporter<Opts extends BaseWebhookOpts = BaseWebhookOpts> {
  protected webhookClient: WebhookClient;
  protected config: WebhookEmbedConfig;
  constructor(protected wbOpts: Opts, config: Partial<WebhookEmbedConfig> = DefaultOptions) {
    this.webhookClient = new WebhookClient({ url: wbOpts.url });
    this.config = merge(DefaultOptions, config) as any;

    this.webhookClient
      .edit({
        avatar: wbOpts.icon,
        name: wbOpts.username,
      })
      .catch(console.error);
  }

  protected abstract buildEmbed(): APIEmbed;

  /**
   * As of right now, simply call webhook client.
   * @param data
   */
  protected send(data: Arguments<WebhookClient["send"]>[0]) {
    this.webhookClient.send(data);
  }
}

export abstract class ClientWebhookReporter<
  Src extends ClientEmitters,
  L extends ClientEvent<Src>,
  Opts extends BaseWebhookOpts = BaseWebhookOpts
> extends ClientEventRegister<Src, L> {
  protected readonly webhookClient: WebhookClient;

  constructor(
    protected readonly srv: ProxyServer<any, any>,
    emitter: Src,
    eventWanted: L,
    protected readonly wbOpts: Opts,
    protected readonly opts: Partial<WebhookEmbedConfig> = DefaultOptions
  ) {
    super(emitter, eventWanted);
    this.webhookClient = new WebhookClient({ url: wbOpts.url });
    this.opts = merge(DefaultOptions, opts);

    this.webhookClient
      .edit({
        avatar: wbOpts.icon,
        name: wbOpts.username,
      })
      .catch(console.error);
  }

  protected buildClientEmbed(): APIEmbed {
    const embed: APIEmbed = {
      title: this.opts.skipTitle ? this.wantedEvent : undefined,
    };

    if (this.srv.controllingPlayer != null) {
      if (this.opts.skipFooter) {
        embed.footer = {
          text: "Connected player: " + this.srv.controllingPlayer.username,
        };
      }
    }
    return embed;
  }
}

const NiceEventNames: { [key in Exclude<(keyof SpectatorServerEvents | keyof TwoBAntiAFKEvents), `botevent_${string}`>]: string } = {
  closingConnections: "Kicked everyone!",
  enteredQueue: "Entered the queue!",
  invalidData: "Invalid queue data",
  leftQueue: "Left the queue!",
  queueUpdate: "Queue update!",
  remoteError: "Remote disconnect (Error)",
  remoteKick: "Remote disconnect (Kicked)",
  starting: "Server is starting up!",
  started: "Server started!",
  stopping: "Server is stopping!",
  stopped: "Server stopped!",
  optionValidation: "Option configuration checking!",
  initialBotSetup: "Bot initialization!",
  botShutdown: "Bot activity stopped!",
  botStartup: "Bot activity started!",
  playerConnected: "Player connected!",
  playerDisconnected: "Player disconnected!",
  proxySetup: "Setting up proxy!",
  restart: "Server is restarting!",
  clientChat: "Private client chat!",
  clientChatRaw: "Raw client chat!",
  "*": "Any event...",
} as const;

type GetEvents<Srv extends ProxyServer<any, any>> = Srv extends ProxyServer<any, infer Events> ? Events : never;

export abstract class AntiAFKWebhookReporter<
  Srv extends ProxyServer<any, any>,
  T extends keyof GetEvents<Srv>,
  Opts extends BaseWebhookOpts = BaseWebhookOpts
> extends ServerEventRegister<Srv extends ProxyServer<any, infer Events> ? Events : never, T, Srv> {
  protected readonly webhookClient: WebhookClient;
  public readonly queue: PacketQueuePredictor<any, any>
  
  constructor(
    srv: Srv,
    event: T,
    queue: PacketQueuePredictor<any, any>,
    public wbOpts: Opts,
    protected readonly config: Partial<WebhookEmbedConfig> = DefaultOptions
  ) {
    super(srv, event);
    this.queue = queue;
    this.webhookClient = new WebhookClient({ url: wbOpts.url });
    this.config = merge(DefaultOptions, config);

    this.webhookClient
      .edit({
        avatar: wbOpts.icon,
        name: wbOpts.username,
      })
      .catch(console.error);
  }

  protected buildServerEmbed() {
    const eta =
      this.queue != null
        ? !Number.isNaN(this.queue.eta)
          ? Duration.fromMillis(this.queue.eta * 1000 - Date.now())
          : null
        : null;

    const embed: APIEmbed = {};

    if (this.config.skipTitle) {
      embed.title = (NiceEventNames as any)[this.wantedEvent] ?? this.wantedEvent;
    }

    if (this.config.skipFooter) {
      let text;
      if (this.srv.isProxyConnected()) {
        text = `Connected to: ${this.srv.bOpts.host}`;
        if (this.srv.bOpts.port !== 25565) text += `:${this.srv.bOpts.port}`;
        text += "\n";
      } else text = "Not connected.\n";

      if (this.srv.controllingPlayer != null) text += `Connected player: ${this.srv.controllingPlayer.username}\n`;
      if (this.queue?.inQueue && eta != null)
        text += `Join time: ${DateTime.local().plus(eta).toFormat("hh:mm a MM/dd/yyyy")}\n`;

      embed.footer = { text };
    }
    return embed;
  }
}
