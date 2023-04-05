import { TwoBAntiAFKOpts, TwoBAntiAFKEvents } from './twoBAntiAFK'
import { SpectatorServerOpts, SpectatorServerEvents } from './spectator'
import { IProxyServerOpts } from '../baseServer'

export type AllOpts = TwoBAntiAFKOpts & SpectatorServerOpts & IProxyServerOpts // just to be safe, yknow?
export type AllEvents = TwoBAntiAFKEvents & SpectatorServerEvents & IProxyServerOpts // just to be safe, yknow?

export interface BaseWebhookOpts {
  url: string
  icon?: string
  username?: string
}

export { SpectatorServerPlugin } from './spectator'
export { TwoBAntiAFKPlugin } from './twoBAntiAFK'
export { ConsoleReporter, WebhookReporter, MotdReporter } from './reporters'
