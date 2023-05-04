import { TwoBAntiAFKOpts, TwoBAntiAFKEvents } from './twoBAntiAFK'
import { SpectatorServerOpts, SpectatorServerEvents } from './spectator'
import { IProxyServerEvents, IProxyServerOpts } from '../baseServer'

export type AllOpts = TwoBAntiAFKOpts & SpectatorServerOpts 
export type AllEvents = TwoBAntiAFKEvents & SpectatorServerEvents 

export interface BaseWebhookOpts {
  url: string
  icon?: string
  username?: string
}

export { SpectatorServerPlugin } from './spectator'
export { TwoBAntiAFKPlugin } from './twoBAntiAFK'
export { ConsoleReporter, WebhookReporter, MotdReporter } from './reporters'
