import type { BotOptions } from 'mineflayer'
import merge from 'ts-deepmerge'
import { ServerSpectatorOptions } from '../impls/spectatorServer/utils'

// Minecraft and discord options such as discord bot prefix and minecraft login info
export interface Options {
  discord: {
    bot: {
      enabled: boolean
      botToken: string
      prefix: string
    }
    webhooks: {
      enabled: boolean
      queue: {
        url: string,
        reportAt: number
      },
      gameChat: string
      serverInfo: string
    }
  }
  minecraft: {
    account: {
      username: string
      email?: string
      password?: string
      auth: 'microsoft' | 'mojang' | 'offline'
    }
    remoteServer: {
      host: string
      port: number
      version: string
    }
    localServer: {
      host: string
      port: number
      version: string
      'online-mode': boolean
      maxPlayers: number,
    },
    localServerOptions: {
      motdOptions: {
        prefix: string
      }
    }
    localServerProxyConfig: ServerSpectatorOptions
  }
}

export function botOptsFromConfig (opts: Options): BotOptions {
  const fuck = merge(
    opts.minecraft.account,
    opts.minecraft.remoteServer
  )
  if (fuck.auth === 'microsoft') {
    delete fuck.password // Allows for first-time microsoft sign-in.
  }
  return fuck
}
