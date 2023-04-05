import * as fs from 'fs'
import { validateOptions } from './util/config'
import { botOptsFromConfig, Options, serverOptsFromConfig } from './util/options'
import { ConsoleReporter, SpectatorServerPlugin, TwoBAntiAFKPlugin, WebhookReporter, MotdReporter } from './localServer/plugins'
import { ServerBuilder } from './localServer/baseServer'
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



async function setup () {

  const serverOptions = await serverOptsFromConfig(checkedConfig)

<<<<<<< HEAD
  const rawServer = createServer(serverOptions)
  rawServer.on('connection', (c) => console.log("hi", c.socket.address()))
=======
  // for typing reasons, just make an array. I'll explain in due time.
  const plugins = [] 
  plugins.push(new SpectatorServerPlugin());
  plugins.push(new TwoBAntiAFKPlugin());
 
>>>>>>> plugin_system

  if (checkedConfig.discord.webhooks) {
    plugins.push(new WebhookReporter(checkedConfig.discord.webhooks))
  }

  if (true) {
    plugins.push(new ConsoleReporter());
  }

<<<<<<< HEAD
  // server-specific events
  afkServer.on('setup', () => {
    if (checkedConfig.discord.webhooks?.enabled) {
      applyWebhookListeners(afkServer, checkedConfig.discord.webhooks)
    }
  })

  afkServer.on('started', () => {
    console.log('Server started!\n' + helpMsg)
    inGameServerMotd()
  })

  afkServer.on('stopped', () => {
    console.log('Server stopped!\nYou can start it with "start"')
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
    console.log('remoteKick:', reason)
    disconnectedServerMotd()
    afkServer.removeListener('queueUpdate', queueServerMotd)
  })

  afkServer.on('remoteError', async (error) => {
    console.log('remoteError:', error)
    disconnectedServerMotd()
    afkServer.removeListener('queueUpdate', queueServerMotd)
  })
  
  afkServer.on('botevent:health', (bot) => {
    botUpdatesMotd(bot)
  })


  afkServer.start()

  /// //////////////////////////////////////////
  //              functions                  //
  /// //////////////////////////////////////////

  function getServerName (): string {
    return (
      checkedConfig.minecraft.remoteServer.host +
      (checkedConfig.minecraft.remoteServer.port !== 25565 ? ':' + checkedConfig.minecraft.remoteServer.port : '')
    )
=======
  if (true) {
    plugins.push(new MotdReporter(checkedConfig.localServerConfig.display))
>>>>>>> plugin_system
  }

  const server = new ServerBuilder(serverOptions, bOpts)
    .addPlugins(...plugins)
    .setSettings(checkedConfig.localServerConfig)
    .build();
    
  server.start()
}

setup()
