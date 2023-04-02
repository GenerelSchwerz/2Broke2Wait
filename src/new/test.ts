import { ProxyServer } from './newProxyServer'

import { AntiAFKServerPlugin } from './newAntiAfk'

import { SpectatorServerEvents, SpectatorServerPlugin } from './newSpectator'
import * as fs from 'fs'
import { botOptsFromConfig, Options } from '../util/options'
import { validateOptions } from '../util/config'
import { SpectatorServerOpts } from '../impls/spectatorServer/utils'
const yaml = require('js-yaml')

// ... If no errors were found, return the validated config
const config = yaml.load(fs.readFileSync('./options.yml', 'utf-8'))

const checkedConfig: Options = validateOptions(config)
const bOpts = botOptsFromConfig(checkedConfig)

const server = new ProxyServer<SpectatorServerOpts, SpectatorServerEvents>(checkedConfig.minecraft.localServerProxyConfig, bOpts, { optimizePacketWrite: true }, checkedConfig.minecraft.localServer)

const test = new SpectatorServerPlugin();
server.loadPlugin(test)

server.start()
