import type { AllOpts, BaseWebhookOpts } from '../localServer/builtinPlugins'
import type { BotOptions } from 'mineflayer'
import type { ServerOptions, Client } from 'minecraft-protocol'

export interface DiscordBotOptions {
    enabled: boolean
    botToken: string
    prefix: string
  }
  
  export interface DiscordWebhookOptions {
    enabled: boolean
    gameChat: BaseWebhookOpts
    serverInfo: BaseWebhookOpts
    queue: QueueSetup
  }
  
  export type QueueSetup = BaseWebhookOpts & {
    reportAt: number
  }
  
  // Minecraft and discord options such as discord bot prefix and minecraft login info
  export interface Options {
    discord: {
      bot?: DiscordBotOptions
      webhooks?: DiscordWebhookOptions
    }
    minecraft: {
      account: BotOptions
      proxy?: {
        enabled: boolean
        protocol: 'socks5h' | 'socks5' | 'socks4' | 'https' | 'http'
        info: {
          host: string
          port: number
          username?: string
          password?: string
        }
      }
  
      remoteServer: {
        host: string
        port: number
        version: string
      }
    }
  
    localServer: ServerOptions
    localServerConfig: AllOpts
  }
  