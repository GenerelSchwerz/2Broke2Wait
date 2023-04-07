export interface BaseWebhookOpts {
  url: string
  icon?: string
  username?: string
}

export { SpectatorServerPlugin } from './spectator'
export { TwoBAntiAFKPlugin } from './twoBAntiAFK'
export { ConsoleReporter, WebhookReporter, MotdReporter } from './reporters'
