import type { BotOptions } from 'mineflayer'
import type {ServerOptions} from 'minecraft-protocol'
import merge from 'ts-deepmerge'
import {readFileSync} from 'fs'
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
        icon?: string,
        username?: string,
        reportAt: number
      },
      gameChat:{
        url: string,
        icon?: string,
        username?: string,
      },
      serverInfo: {
        url: string,
        icon?: string,
        username?: string,
      },
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
      },
      icon: string
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


export function serverOptsFromConfig(opts: Options): ServerOptions {
  const shit: ServerOptions = opts.minecraft.localServer;
  const iconPath = opts.minecraft.localServerOptions.icon
  let realIcon;
  if (!!opts.minecraft.localServerOptions.icon) {
    if (iconPath.includes("http://") || iconPath.includes("https://")) {
      // todo
    }
    else {
      realIcon = readFileSync(iconPath).toString("base64");
    }
  }
  shit.favicon = realIcon;
  return shit;
}