
/// //////////////////////////////////////////
//                Imports                  //
/// //////////////////////////////////////////

import type { Bot } from 'mineflayer'

import * as fs from 'fs'

import { validateOptions } from './util/config'
import { botOptsFromConfig, Options, serverOptsFromConfig } from './util/options'
import { Duration } from 'ts-luxon'
import { createServer } from 'minecraft-protocol'
import { buildClient } from './discord/index'
import { applyWebhookListeners } from './util/webhooks'
import { SpectatorServer } from './impls/spectatorServer'

import * as rl from 'readline'

// useful for us.
const optionDir: string = './options.json'

/// //////////////////////////////////////////
//              Initialization             //
/// //////////////////////////////////////////

// ... If no errors were found, return the validated config

const config = JSON.parse(fs.readFileSync(optionDir).toString())

const checkedConfig: Options = validateOptions(config)

const botOptions = botOptsFromConfig(checkedConfig)

const serverOptions = serverOptsFromConfig(checkedConfig);

const rawServer = createServer(serverOptions)
console.log(rawServer.favicon)
const afkServer = SpectatorServer.wrapServer(
  true,
  rawServer,
  botOptions,
  {},
  checkedConfig.minecraft.localServerProxyConfig
)

afkServer.on('breath', (bot) => {
  botUpdatesMotd(bot)
})

afkServer.on('health', (bot) => {
  botUpdatesMotd(bot)
})

afkServer.on('enteredQueue', () => {
  queueEnterMotd()
  afkServer.on('queueUpdate', queueServerMotd)
})

afkServer.on('leftQueue', () => {
  inGameServerMotd()
  afkServer.removeListener('queueUpdate', queueServerMotd)
})

afkServer.on('remoteKick', async (reason) => {
  afkServer.removeListener('queueUpdate', queueServerMotd)
  if (afkServer.psOpts.restartOnDisconnect) {
    afkServer.restart(1000)
  }
})

afkServer.on('remoteError', async (error) => {
  console.log('remoteError:', error)
  afkServer.removeListener('queueUpdate', queueServerMotd)
  if (afkServer.psOpts.restartOnDisconnect) {
    afkServer.restart(1000)
  }
})

afkServer.on('closedConnections', (reason) => {
  disconnectedServerMotd()
  afkServer.removeAllClientListeners()
  afkServer.removeAllServerListeners()
})

afkServer.on('started', () => {
  console.log('Server started!\n' + helpMsg)
  inGameServerMotd()
  if (checkedConfig.discord.webhooks.enabled) {
    applyWebhookListeners(afkServer, checkedConfig.discord.webhooks)
  }
})

afkServer.on('stopped', () => {
  console.log('Server stopped!\nYou can start it with \"start\"')
})

if (checkedConfig.discord.bot.enabled && !!checkedConfig.discord.bot.botToken) {
  buildClient(checkedConfig.discord.bot, afkServer)
  console.log('We are using a discord bot.')
} else {
  console.log('No discord token included. Going without it (No command functionality currently).')
}

if (checkedConfig.discord.webhooks.enabled) {
  console.log('Using discord webhooks to relay information!')
} else {
  console.log('Discord webhooks are disabled. Will not be using them.')
}
const inp = rl.createInterface({
  input: process.stdin,
  output: process.stdout
})

const helpMsg =
  '-------------------------------\n' +
  'start    -> starts the server\n' +
  'stop     -> stops the server\n' +
  'restart  -> restarts the server\n' +
  'status   -> displays info of service\n' +
  'help     -> shows this message\n'

// afkServer.cmdHandler.prefix = "$";
afkServer.start()

/// //////////////////////////////////////////
//              functions                  //
/// //////////////////////////////////////////

function getServerName (): string {
  return (
    checkedConfig.minecraft.remoteServer.host +
    (checkedConfig.minecraft.remoteServer.port !== 25565 ? ':' + checkedConfig.minecraft.remoteServer.port : '')
  )
}

function setServerMotd(message: string) {
  rawServer.motd = checkedConfig.minecraft.localServerOptions.motdOptions.prefix + message
}


function queueServerMotd (oldPos: number, newPos: number, eta: number) {
  if (Number.isNaN(eta)) {
    setServerMotd(`Pos: ${newPos} | ETA: Unknown.`)
    return
  }

  const res = `Pos: ${newPos} | ETA: ${Duration.fromMillis(eta * 1000 - Date.now()).toFormat("d'd', h'hr', m'min'")}`

  console.log('Queue update!\n' + res)
  rawServer.motd = res
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

/// //////////////////////////////////////////
//                Util                     //
/// //////////////////////////////////////////
inp.on('line', (inp) => {
  const [cmd, ...args] = inp.trim().split(' ')
  switch (cmd) {
    case 'help':
      console.log('Help message!\n' + helpMsg)
      break
    case 'start':
      afkServer.start()
      break
    case 'stop':
      afkServer.stop()
      break
    case 'restart':
      afkServer.restart(1000)
      break
    case 'status':
      if (afkServer.isProxyConnected()) {
        console.log(`Proxy connected to ${afkServer.bOpts.host}${afkServer.bOpts.port !== 25565 ? ':' + afkServer.bOpts.port : ''}`)
        if (afkServer.queue != null) {
          if (afkServer.queue.inQueue) console.log(`Proxy queue pos: ${afkServer.queue.lastPos}, ETA: ${afkServer.queue.eta}`)
        }
      } else {
        console.log('Proxy is not connected.')
      }
      if (afkServer.isPlayerConnected()) {
        console.log('Player connected.')
      } else {
        console.log('Player is not connected.')
      }
  }
})
