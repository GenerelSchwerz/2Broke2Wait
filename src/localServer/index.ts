import { TwoBAntiAFKOpts, TwoBAntiAFKEvents } from "./twoBAntiAFK";
import { SpectatorServerOpts, SpectatorServerEvents } from "./spectator";
import { RestartOpts, SecurityEvents, SecurityOpts } from "./security";
import { MotdOpts } from "./reporters";

export type AllOpts = TwoBAntiAFKOpts & SpectatorServerOpts & SecurityOpts & RestartOpts & MotdOpts;
export type AllEvents = TwoBAntiAFKEvents & SpectatorServerEvents & SecurityEvents;

export interface BaseWebhookOpts {
  url: string;
  icon?: string;
  username?: string;
}

export { SpectatorServerPlugin } from "./spectator";
export { TwoBAntiAFKPlugin } from "./twoBAntiAFK";
export { ConsoleReporter, WebhookReporter, MotdReporter } from "./reporters";
