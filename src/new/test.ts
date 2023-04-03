import { ProxyServer } from './newProxyServer'
import { TwoBAntiAFKPlugin } from './twoBAntiAFK'
import * as fs from 'fs'
import type { Bot } from 'mineflayer'
import { Duration } from 'ts-luxon'
import { validateOptions } from '../util/config'
import { botOptsFromConfig, Options, serverOptsFromConfig } from '../util/options'
import { SpectatorServerEvents, SpectatorServerOpts, SpectatorServerPlugin } from './newSpectator'
const yaml = require('js-yaml')

// ... If no errors were found, return the validated config
const config = yaml.load(fs.readFileSync('./options.yml', 'utf-8'))

const checkedConfig: Options = validateOptions(config)
const bOpts = botOptsFromConfig(checkedConfig)

const helpMsg =
  '-------------------------------\n' +
  'start    -> starts the server\n' +
  'stop     -> stops the server\n' +
  'restart  -> restarts the server\n' +
  'status   -> displays info of service\n' +
  'help     -> shows this message\n'

const test = new TwoBAntiAFKPlugin()
const test1 = new SpectatorServerPlugin()

async function setup () {
  const serverOptions = await serverOptsFromConfig(checkedConfig)
  const server = new ProxyServer<SpectatorServerOpts, SpectatorServerEvents>(
    serverOptions,
    checkedConfig.minecraft.localServerProxyConfig,
    bOpts
  )
  const rawServer = server.rawServer;

  server.loadPlugin(test as any)
  server.loadPlugin(test1)
  server.start()

  // server-specific events
//   server.on('starting', () => {
//     if (checkedConfig.discord.webhooks?.enabled) {
//       applyWebhookListeners(server, checkedConfig.discord.webhooks)
//     }
//   })

  server.on('started', () => {
    console.log('Server started!\n' + helpMsg)
    inGameServerMotd()
  })

  server.on('stopped', () => {
    console.log('Server stopped!\nYou can start it with "start"')
  })

  server.on('enteredQueue', () => {
    queueEnterMotd()
    server.on('queueUpdate', queueServerMotd)
  })

  server.on('leftQueue', () => {
    inGameServerMotd()
    server.removeListener('queueUpdate', queueServerMotd)
  })

  server.on('remoteKick', async (reason) => {
    console.log('remoteKick:', reason)
    disconnectedServerMotd()
    server.removeListener('queueUpdate', queueServerMotd)
  })

  server.on('remoteError', async (error) => {
    console.log('remoteError:', error)
    disconnectedServerMotd()
    server.removeListener('queueUpdate', queueServerMotd)
  })

  // bot events
  server.on('botevent:breath', (bot) => {
    botUpdatesMotd(bot)
  })

  server.on('botevent:health', (bot) => {
    botUpdatesMotd(bot)
  })


   /// //////////////////////////////////////////
  //              functions                  //
  /// //////////////////////////////////////////

  function getServerName (): string {
    return (
      checkedConfig.minecraft.remoteServer.host +
      (checkedConfig.minecraft.remoteServer.port !== 25565 ? ':' + checkedConfig.minecraft.remoteServer.port : '')
    )
  }

  function setServerMotd (message: string) {
    if (checkedConfig.minecraft.localServerOptions?.motdOptions?.prefix) {
      rawServer.motd = checkedConfig.minecraft.localServerOptions.motdOptions.prefix + message
    } else {
      rawServer.motd = message
    }
  }

  function queueServerMotd (oldPos: number, newPos: number, eta: number) {
    if (Number.isNaN(eta)) {
      setServerMotd(`${getServerName()} | Pos: ${newPos} | ETA: Unknown.`)
      return
    }

    const res = `${getServerName()} | Pos: ${newPos} | ETA: ${Duration.fromMillis(eta * 1000 - Date.now()).toFormat("d'd', h'hr', m'min'")}`

    console.log('Queue update!\n' + res)
    setServerMotd(res)
  }

  function disconnectedServerMotd () {
    setServerMotd(`Disconnected from ${getServerName()}`)
  }

  function queueEnterMotd () {
    setServerMotd(`Entered queue on ${getServerName()}`)
  }

  function inGameServerMotd () {
    setServerMotd(`Playing on ${getServerName()}!`)
  }

  function botUpdatesMotd (bot: Bot) {
    setServerMotd(`Health: ${bot.health.toFixed(2)}, Hunger: ${bot.food.toFixed(2)}`)
  }
}

setup()
