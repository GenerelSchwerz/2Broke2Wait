import { APIEmbed, WebhookClient } from "discord.js";
import { DateTime, Duration } from "ts-luxon";
import {
  ClientEventRegister,
  QueueEventRegister,
  ServerEventRegister,
} from "../abstract/eventRegisters";
import { AntiAFKServer, StrictAntiAFKEvents } from "../impls/antiAfkServer";

import { ClientEmitters, ClientEvent } from "../util/utilTypes";
import { PacketQueuePredictorEvents } from "./packetQueuePredictor";
import { ProxyServer } from "./proxyBuilder";
import { IProxyServerEvents, OldProxyServer } from "./proxyServer";


// const NiceClientNames: {[key in ClientEvent<ClientEmitters>]: string} = {

// }

export abstract class ClientWebhookReporter<
  Src extends ClientEmitters,
  L extends ClientEvent<Src>
> extends ClientEventRegister<Src, L> {
  protected readonly webhookClient: WebhookClient;

  constructor(
    protected readonly srv: ProxyServer,
    emitter: Src,
    eventWanted: L,
    protected readonly url: string
  ) {
    super(emitter, eventWanted);
    this.webhookClient = new WebhookClient({ url });
  }

  protected buildClientEmbed(): APIEmbed {
    const embed: APIEmbed = {
      title: `Client: ${this.wantedEvent}`,
    };

    if (!!this.srv.connectedPlayer) {
      embed.footer = {
        text: "Connected player: " + this.srv.connectedPlayer.username,
      };
    }
    return embed;
  }
}

const NiceServerNames: {[key in keyof StrictAntiAFKEvents]: string } = {
  decidedClose: "Server closed!",
  enteredQueue: "Entered the queue!",
  invalidData: "Invalid queue data",
  leftQueue: "Left the queue!",
  queueUpdate: "Queue update!",
  remoteError: "Remote disconnect (Error)",
  remoteKick: "Remote disconnect (Kicked)",
  started: "Server started!",
} as const;


export abstract class AntiAFKWebhookReporter<
  T extends keyof StrictAntiAFKEvents
> extends ServerEventRegister<StrictAntiAFKEvents, T, AntiAFKServer> {
  protected readonly webhookClient: WebhookClient;

  constructor(srv: AntiAFKServer, event: T, public url: string) {
    super(srv, event);
    this.webhookClient = new WebhookClient({ url });
  }

  protected buildServerEmbed() {

    const eta = !Number.isNaN(this.srv.queue.eta) ? Duration.fromMillis(this.srv.queue.eta * 1000 - Date.now()) : null;

    const embed: APIEmbed = {
      title: NiceServerNames[this.wantedEvent],
      footer: {
        text: (this.srv.isProxyConnected() ? `Connected to: ${this.srv.bOpts.host}${ this.srv.bOpts.port !== 25565 ? ":" + this.srv.bOpts.port : "" }\n` : `Not connected.\n`) +
              (this.srv.connectedPlayer ? `Connected player: ${this.srv.connectedPlayer.username}\n` : "") + 
              (this.srv.queue.inQueue && !!eta ? `Join time: ${DateTime.local().plus(eta).toFormat("hh:mm a MM/dd/yyyy")}\n` : "")
      },
    };
    return embed;
  }
}