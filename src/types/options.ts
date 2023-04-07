import type { BaseWebhookOpts } from '../localServer/builtinPlugins'
import type { BotOptions } from 'mineflayer'
import type { ServerOptions, Client } from 'minecraft-protocol'

import { TwoBAntiAFKOpts, TwoBAntiAFKEvents } from '../localServer/builtinPlugins/twoBAntiAFK'
import { SpectatorServerOpts, SpectatorServerEvents } from '../localServer/builtinPlugins/spectator'
import { LogConfig } from '../util/logger'



export type AllOpts = TwoBAntiAFKOpts & SpectatorServerOpts // just to be safe, yknow?
export type AllEvents = TwoBAntiAFKEvents & SpectatorServerEvents// just to be safe, yknow?


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
    localServerConfig: AllOpts,
    logger: LogConfig
  }
  