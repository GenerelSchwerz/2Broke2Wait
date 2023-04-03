import { Client, Server, createServer, ServerOptions, ServerClient } from 'minecraft-protocol'
import { BotOptions, Bot, BotEvents } from 'mineflayer'
import { ConnOptions, Conn, Client as ProxyClient } from '@rob9315/mcproxy'
import { Arguments, TypedEventEmitter } from '../util/utilTypes'
import { CommandHandler, CommandMap } from '../util/commandHandler'
import { ChatMessage as AgnogChMsg } from 'prismarine-chat'
import { sleep } from '../util/index'

/**
 * Interface for the ProxyServer options.
 */
export interface IProxyServerOpts {
  security: {
    /**
     * Optional.
     * If not set all players are allowed to join.
     * Either a list off players allowed to connect to the proxy or a function that returns a boolean value.
     */
    whitelist?: string[] | ((username: string) => boolean)
    kickMessage: string
  }

  display: {
    proxyChatPrefix: string
  }

  /**
   * Disconnect all connected players once the proxy bot stops.
   * Defaults to true.
   * If not on players will still be connected but won't receive updates from the server.
   *
   */
  disconnectAllOnEnd?: boolean
  disableCommands?: boolean

  /**
   * Restart whenever remote bot disconnects. Defaults to false.
   */
  restartOnDisconnect?: boolean
}

type PrefixedBotEvents<Prefix extends string = 'botevent'> = {
  [K in keyof BotEvents as K extends string ? `${Prefix}:${K}` : never]: (
    bot: Bot,
    ...args: Arguments<BotEvents[K]>
  ) => void;
}

export type IProxyServerEvents<Opts extends IProxyServerOpts> = {
  remoteKick: (reason: string) => void
  remoteError: (error: Error) => void
  closingConnections: (reason: string) => void

  playerConnected: (client: ServerClient, remoteConnected: boolean) => void
  playerDisconnected: (client: ServerClient) => void

  proxySetup: (conn: Conn) => void
  botStartup: (bot: Bot, psOpts: Opts) => void
  botShutdown: (bot: Bot, psOpts: Opts) => void
  starting: (conn: Conn) => void
  started: (conn: Conn) => void
  stopping: () => void
  stopped: () => void
  restart: () => void
} & PrefixedBotEvents

export abstract class ProxyServerPlugin<Opts extends IProxyServerOpts, Events extends IProxyServerEvents<Opts>> {
  declare public _server: ProxyServer<Opts, Events>
  declare public name: string
  declare public connectedCmds?: CommandMap
  declare public disconnectedCmds?: CommandMap

  public get server (): ProxyServer<Opts, Events> {
    if (this._server == null) throw Error('Server was wanted before proper initialization!')
    return this._server
  }

  // potential listener methods
  declare onPreStart?: (conn: Conn) => void
  declare onPreStop?: () => void
  declare onBotStartup?: (bot: Bot, psOpts: Opts) => void
  declare onBotShutdown?: (bot: Bot, psOpts: Opts) => void
  declare onProxySetup?: (conn: Conn, psOpts: Opts) => void
  declare onOptionValidation?: (psOpts: Opts, bot: Bot) => Opts
  declare onInitialBotSetup?: (bot: Bot, psOpts: Opts) => void
  declare onClosingConnections?: (reason: string) => void

  declare onPlayerConnected?: (player: ServerClient, remoteConnected: boolean) => void

  declare whileConnectedLoginHandler?: (player: ServerClient) => Promise<boolean>
  declare notConnectedLoginHandler?: (player: ServerClient) => Promise<boolean>

  public onLoad (server: ProxyServer<Opts, Events>) {
    this._server = server
    if (this.onPreStop != null) this._server.on('stopping', this.onPreStop)
    if (this.onPreStart != null) this._server.on('starting' as any, this.onPreStart)
    if (this.onProxySetup != null) this._server.on('proxySetup' as any, this.onProxySetup)
    if (this.onBotStartup != null) this._server.on('botStartup' as any, this.onBotStartup)
    if (this.onBotShutdown != null) this._server.on('botShutdown' as any, this.onBotShutdown)
    if (this.onClosingConnections != null) this._server.on('closingConnections' as any, this.onClosingConnections)

    if (this.onPlayerConnected != null) this._server.on('playerConnected' as any, this.onPlayerConnected)
    if (this.onOptionValidation != null) this._server.on('optionValidation' as any, this.onOptionValidation)
    if (this.onInitialBotSetup != null) this._server.on('initialBotSetup' as any, this.onInitialBotSetup)
  }

  public onUnload (server: ProxyServer<Opts, Events>) {
    this._server = server
    if (this.onPreStop != null) this._server.off('stopping', this.onPreStop)
    if (this.onPreStart != null) this._server.off('starting' as any, this.onPreStart)
    if (this.onProxySetup != null) this._server.off('proxySetup' as any, this.onProxySetup)
    if (this.onBotStartup != null) this._server.off('botStartup' as any, this.onBotStartup)
    if (this.onBotShutdown != null) this._server.off('botShutdown' as any, this.onBotShutdown)
    if (this.onClosingConnections != null) this._server.off('closingConnections' as any, this.onClosingConnections)

    if (this.onPlayerConnected != null) this._server.off('playerConnected' as any, this.onPlayerConnected)
    if (this.onOptionValidation != null) this._server.off('optionValidation' as any, this.onOptionValidation)
    if (this.onInitialBotSetup != null) this._server.off('initialBotSetup' as any, this.onInitialBotSetup)
  }

  /**
   * Emit proxy to go straight to the server.
   * @param event
   * @param args
   */
  public serverEmit<E extends keyof Events>(event: E, ...args: Arguments<Events[E]>) {
    this.server.emit(event, ...args)
  }
}

export class ProxyServer<
  Opts extends IProxyServerOpts,
  Events extends IProxyServerEvents<Opts>
> extends TypedEventEmitter<Events> {
  protected readonly plugins: Map<string, ProxyServerPlugin<Opts, Events>> = new Map()

  public readonly cmdHandler: CommandHandler<any> // CommandHandler<ProxyServer<Opts, Events>>

  public ChatMessage!: typeof AgnogChMsg

  protected readonly _rawServer: Server

  public get rawServer(): Server {
    return this._rawServer
  }


  protected _conn: Conn | null

  public get proxy (): Conn | null {
    return this._conn
  }

  public bOpts: BotOptions

  public cOpts: ConnOptions

  public lsOpts: ServerOptions

  public psOpts: Opts

  public manuallyStopped: boolean = false

  public get conn (): Conn | null {
    return this._conn
  }

  public get remoteBot (): Bot | null {
    return this._conn?.stateData.bot ?? null
  }

  public get remoteClient (): Client | null {
    return this._conn?.stateData.bot._client ?? null
  }

  protected _remoteIsConnected: boolean = false

  public get controllingPlayer (): ProxyClient | null {
    return this._conn?.pclient ?? null
  }

  public isPlayerControlling (): boolean {
    return this._conn?.pclient != null
  }

  public isProxyConnected () {
    return this._remoteIsConnected
  }

  constructor (
    lsOpts: ServerOptions,
    psOpts: Opts,
    bOpts: BotOptions,
    cOpts: ConnOptions = { optimizePacketWrite: true }
  ) {
    super()
    this.bOpts = bOpts
    this.cOpts = cOpts
    this.lsOpts = lsOpts
    this.psOpts = psOpts
    this.psOpts = psOpts
    this._rawServer = createServer(lsOpts)
    this._conn = null
    this.ChatMessage = require('prismarine-chat')(bOpts.version)

    this.cmdHandler = new CommandHandler(this)
    this.cmdHandler.loadProxyCommand('pstop', this.stop)
    this.cmdHandler.loadDisconnectedCommand('pstart', this.start)

    this._rawServer.on('login', this.loginHandler)
  }

  public loadPlugin (inserting: ProxyServerPlugin<Opts, Events>) {
    inserting.onLoad?.(this)
    this.plugins.set(inserting.name, inserting)
    if (inserting.connectedCmds != null) this.cmdHandler.loadProxyCommands(inserting.connectedCmds)
    if (inserting.disconnectedCmds != null) this.cmdHandler.loadDisconnectedCommands(inserting.disconnectedCmds)
  }

  public unloadPlugin (inserting: ProxyServerPlugin<Opts, Events> | string) {
    if (inserting instanceof String) {
      this.plugins.delete(inserting as string)
    } else {
      this.plugins.delete((inserting as ProxyServerPlugin<any, any>).name)
    }
  }

  public start (): Conn {
    if (this.isProxyConnected()) return this._conn!
    this.closeConnections('Proxy restarted! Rejoin to re-sync.')
    this._conn = new Conn(this.bOpts, this.cOpts)
    this.manuallyStopped = false
    this.emit('starting' as any, this._conn)
    this.setup()
    this.emit('started' as any)
    return this._conn
  }

  public stop (): void {
    if (!this.isProxyConnected()) return
    this.manuallyStopped = true
    this.emit('stopping' as any)
    this.closeConnections('Proxy stoppped.', true)
    this.emit('stopped' as any)
  }

  public async restart (ms = 0) {
    this.stop()
    await sleep(ms)
    this.start()
  }

  private setup (): void {
    if (this.remoteBot == null || this.remoteClient == null) { throw Error('Setup called when remote bot does not exist!') }

    this.emit('proxySetup' as any, this._conn!, this.psOpts)

    const oldEmit = this.remoteBot.emit.bind(this.remoteBot)

    this.remoteBot.emit = <E extends keyof BotEvents>(event: E, ...args: Arguments<BotEvents[E]>) => {
      this.emit(`botevent:${event}` as any, this.remoteBot!, ...args)
      return oldEmit(event, ...args)
    }

    this.emit('optionValidation' as any, this.psOpts, this.remoteBot)

    for (const plugin of this.plugins.values()) {
      if (plugin.onOptionValidation != null) this.psOpts = plugin.onOptionValidation(this.psOpts, this.remoteBot)
    }

    this.emit('initialBotSetup' as any, this.remoteBot, this.psOpts)

    this.remoteBot.once('spawn', this.beginBotLogic)
    this.remoteBot.on('kicked', (info) => {
      if (this.psOpts.disconnectAllOnEnd) this.remoteClientDisconnect(info)
    })
    this.remoteClient.on('login', () => {
      this._remoteIsConnected = true
    })
  }

  public beginBotLogic = (): void => {
    if (this.remoteBot == null) throw Error('Bot logic called when bot does not exist!')
    this.emit('botStartup' as any, this.remoteBot, this.psOpts)
  }

  public endBotLogic = (): void => {
    if (this.remoteBot == null) throw Error('Bot logic called when bot does not exist!')
    this.emit('botShutdown' as any, this.remoteBot, this.psOpts)
  }

  private readonly loginHandler = (actualUser: ServerClient) => {
    this.emit('playerConnected' as any, actualUser, this.isProxyConnected())
    actualUser.once('end', () => this.emit('playerDisconnected' as any, actualUser))

    this.cmdHandler.updateClientCmds(actualUser as unknown as ProxyClient)
    if (this.isProxyConnected()) this.whileConnectedLoginHandler(actualUser)
    else this.notConnectedLoginHandler(actualUser)
  }

  private readonly remoteClientDisconnect = async (info: string | Error) => {
    if (this.controllingPlayer != null) this.controllingPlayer.end('Connection reset by server.')
    this.endBotLogic()
    if (info instanceof Error) {
      this.emit('remoteError' as any, info)
      this.closeConnections('Connection reset by server.', true, `Javascript Error: ${info}`)
    } else {
      this.emit('remoteKick' as any, info)
      this.closeConnections('Connection reset by server.', true, info)
    }
  }

  private readonly closeConnections = (closeReason: string, closeRemote = false, additional?: string) => {
    const reason = additional ? closeReason + additional : closeReason

    this.emit('closingConnections' as any, reason)

    Object.keys(this._rawServer.clients).forEach((clientId) => {
      this._rawServer.clients[Number(clientId)].end(reason)
    })

    if (closeRemote) {
      this._conn?.disconnect()
      this._remoteIsConnected = false
      this._conn = null

      if (this.psOpts.restartOnDisconnect && !this.manuallyStopped) {
        this.restart(1000)
      }
    }
  }

  /**
   * Default login handler. This can/will be overriden by plugins.
   * @param actualUser
   * @returns
   */
  private readonly whileConnectedLoginHandler = async (actualUser: ServerClient) => {
    for (const plugin of this.plugins.values()) {
      const res = await plugin.whileConnectedLoginHandler?.(actualUser)
      if (res != null) return
    }

    if (!this.isUserWhitelisted(actualUser)) {
      const { address, family, port } = {
        address: 'unknown',
        family: 'unknown',
        port: 'unknown',
        ...actualUser.socket.address()
      }
      actualUser.end(this.psOpts.security?.kickMessage ?? 'You are not in the whitelist')
      return
    }

    const allowedToControl = this.lsOpts['online-mode']
      ? this.remoteClient?.uuid === actualUser.uuid
      : this.remoteClient?.username === actualUser.username

    if (!allowedToControl) {
      actualUser.end('This user is not allowed to control the bot!')
      return // early end.
    }

    // set event for when they end.
    actualUser.on('end', (reason) => {
      this.beginBotLogic()
    })

    this.endBotLogic()
    this._conn!.sendPackets(actualUser as any) // works in original?
    this._conn!.link(actualUser as any) // again works
  }

  protected notConnectedLoginHandler = (actualUser: ServerClient) => {
    for (const plugin of this.plugins.values()) {
      if (plugin.notConnectedLoginHandler?.(actualUser) != null) return
    }

    actualUser.write('login', {
      entityId: actualUser.id,
      levelType: 'default',
      gameMode: 0,
      dimension: 0,
      difficulty: 2,
      maxPlayers: 1,
      reducedDebugInfo: false
    })
    actualUser.write('position', {
      x: 0,
      y: 1.62,
      z: 0,
      yaw: 0,
      pitch: 0,
      flags: 0x00
    })
  }

  public isUserWhitelisted = (user: ServerClient): boolean => {
    if (this.psOpts.security.whitelist == null) return true
    if (this.psOpts.security.whitelist instanceof Array) {
      return this.psOpts.security.whitelist.find((n) => n.toLowerCase() === user.username.toLowerCase()) !== undefined
    } else if (typeof this.psOpts.security.whitelist === 'function') {
      try {
        return !!this.psOpts.security.whitelist(user.username)
      } catch (e) {
        console.warn('allowlist callback had error', e)
        return false
      }
    }
    return false
  }

  // ======================= //
  //     message utils       //
  // ======================= //

  message (
    client: Client | ServerClient,
    message: string,
    prefix: boolean = true,
    allowFormatting: boolean = true,
    position: number = 1
  ) {
    if (!allowFormatting) message = message.replaceAll(/§./, '')
    if (prefix) message = this.psOpts.display.proxyChatPrefix + message
    this.sendMessage(client, message, position)
  }

  sendMessage (client: ServerClient | Client, message: string, position: number = 1) {
    const messageObj = new this.ChatMessage(message)
    client.write('chat', { message: messageObj.json.toString(), position })
  }

  broadcastMessage (message: string, prefix: boolean = true, allowFormatting?: boolean, position?: number) {
    Object.values(this._rawServer.clients).forEach((c) => {
      this.message(c, message, prefix, allowFormatting, position)
    })
  }
}
