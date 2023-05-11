import { TwoBAntiAFKOpts, TwoBAntiAFKEvents } from "./twoBAntiAFK";
import { SpectatorServerOpts, SpectatorServerEvents } from "./spectator";
import { RestartOpts, SecurityEvents, SecurityOpts } from "./security";
import { MotdOpts, WhPluginOpts } from "./reporters";
import { IProxyServerEvents, IProxyServerOpts } from "@nxg-org/mineflayer-mitm-proxy";

export type AllOpts = IProxyServerOpts & TwoBAntiAFKOpts & SpectatorServerOpts & SecurityOpts & RestartOpts & MotdOpts;
export type AllEvents = IProxyServerEvents & TwoBAntiAFKEvents & SpectatorServerEvents & SecurityEvents;

export type BaseWebhookOpts = {
  url: string;
  icon?: string;
  username?: string;
} & ({ edit?: false } | { edit: true; firstMessageId?: string });

export { SpectatorServerPlugin } from "./spectator";
export { TwoBAntiAFKPlugin } from "./twoBAntiAFK";
export { ConsoleReporter, WebhookReporter, MotdReporter } from "./reporters";
