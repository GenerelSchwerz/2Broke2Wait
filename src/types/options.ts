import type { AllOpts, BaseWebhookOpts } from '../localServer'
import type { BotOptions } from 'mineflayer'
import type { ServerOptions, Client } from 'minecraft-protocol'
import { IProxyServerOpts, LogConfig } from '@nxg-org/mineflayer-mitm-proxy'
import { WhPluginOpts } from '../localServer/reporters'

export interface DiscordBotOptions {
  enabled: boolean
  token: string
  prefix: string
}

export type DiscordWebhookOptions = {
  enabled: boolean
} & WhPluginOpts;

export type QueueSetup = BaseWebhookOpts & {
  reportAt: number
}

export type GameChatSetup = BaseWebhookOpts & {
  timestamp?: boolean
}

// Minecraft and discord options such as discord bot prefix and minecraft login info
export interface Options {
  startImmediately: boolean,
  debug: boolean,
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
  localServerConfig: AllOpts & IProxyServerOpts
  logger: LogConfig
}
