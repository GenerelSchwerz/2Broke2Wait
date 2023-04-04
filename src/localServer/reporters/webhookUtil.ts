import { APIEmbed, WebhookClient } from "discord.js";
import { DateTime, Duration } from "ts-luxon";
import { PacketQueuePredictor } from "../../abstract/packetQueuePredictor";
import { BaseWebhookOpts, WebhookEmbedConfig } from "../../abstract/webhookReporters";
import { ProxyServer } from "../baseServer";
import { TwoBAntiAFKEvents } from "../plugins/twoBAntiAFK";

export const AntiAFKEventNames: { [key in Exclude<keyof TwoBAntiAFKEvents, `botevent_${string}`>]: string } = {
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
  "*": "Any event...",
} as const;

export function buildClientEmbed(srv: ProxyServer<any, any>, wantedEvent: string, config: WebhookEmbedConfig) {
  const embed: APIEmbed = {
    title: config.skipTitle ? undefined : wantedEvent,
  };

  if (srv.controllingPlayer != null) {
    if (config.skipFooter) {
      embed.footer = {
        text: `Connected player: ${srv.controllingPlayer.username}`,
      };
    }
  }
  return embed;
}

export function buildServerEmbed(
  srv: ProxyServer<any, any>,
  queue: PacketQueuePredictor<any, any>,
  wantedEvent: string,
  config: WebhookEmbedConfig
) {
  const eta =
    queue != null ? (!Number.isNaN(queue.eta) ? Duration.fromMillis(queue.eta * 1000 - Date.now()) : null) : null;

  const embed: APIEmbed = {
    title: config.skipTitle ? undefined : wantedEvent,
  };

  if (!config.skipFooter) {
    let text;
    if (srv.isProxyConnected()) {
      text = `Connected to: ${srv.bOpts.host}`;
      if (srv.bOpts.port !== 25565) text += `:${srv.bOpts.port}`;
      text += "\n";
    } else text = "Not connected.\n";

    if (srv.controllingPlayer != null) text += `Connected player: ${srv.controllingPlayer.username}\n`;
    if (queue?.inQueue && eta != null)
      text += `Join time: ${DateTime.local().plus(eta).toFormat("hh:mm a MM/dd/yyyy")}\n`;

    embed.footer = { text };
  }
  return embed;
}

export type WebhookWrapper = {
  client: WebhookClient;
} & BaseWebhookOpts;

export function updateWebhook(
  webhookInfo: { client: WebhookClient } & BaseWebhookOpts,
  reason = "Automatic update from 2b2w"
) {
  return webhookInfo.client.edit({
    avatar: webhookInfo.icon,
    name: webhookInfo.username,
    reason,
  });
}
