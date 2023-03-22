import merge from 'ts-deepmerge'

import type { Bot, BotOptions } from 'mineflayer'
import { ServerClient, Client, Server, PacketMeta } from 'minecraft-protocol'
import { sleep } from '../util/index'
import { ClientEventRegister, ServerEventRegister } from './eventRegisters'
import { Conn, ConnOptions } from '@rob9315/mcproxy'
import { TypedEventEmitter } from '../util/utilTypes'
import { CommandHandler } from '../util/commandHandler'

/**
 * Interface for the ProxyServer options.
 */
export interface IProxyServerOpts {
  whitelist?: string[] | ((username: string) => boolean)
  restartOnDisconnect: boolean
}

export interface IProxyServerEvents {
  remoteKick: (reason: string) => void
  remoteError: (error: Error) => void
  closedConnections: (reason: string) => void
  started: (conn: Conn) => void,
  stopped: () => void
}

/**
 * This proxy server provides a wrapper around the connection to the remote server and
 * the local server that players can connect to.
 */
export abstract class ProxyServer<
  T extends IProxyServerOpts = IProxyServerOpts,
  Events extends IProxyServerEvents = IProxyServerEvents
> extends TypedEventEmitter<Events> {
  public readonly server: Server

  private readonly _registeredClientListeners: Set<string> = new Set()
  private _runningClientListeners: Array<ClientEventRegister<Bot | Client, any>> = []

  private readonly _registeredServerListeners: Set<string> = new Set()
  private _runningServerListeners: Array<ServerEventRegister<any, any>> = []

  /**
   * flag to reuse the internal server instance across proxy servers.
   *
   * This is handled by
   *  {@link } and
   *  {@link }.
   */
  public readonly reuseServer: boolean = true

  /**
   * Proxy instance. see Rob's proxy. {@link Conn}
   */
  protected _proxy: Conn | null

  protected _bOpts: BotOptions

  protected _cOpts: Partial<ConnOptions>

  public get bOpts () {
    return this._bOpts
  }

  public get cOpts () {
    return this._cOpts
  }

  /**
   * Proxy instance. see Rob's proxy. {@link Conn}
   */
  public get proxy () {
    return this._proxy
  }

  /**
   * Internal bot connected to remote server. Created by {@link ProxyServer.proxy | ProxyServer's proxy.}
   */
  public get remoteBot () {
    return this._proxy?.stateData.bot
  }

  /**
   * Internal mc protocol client connected to remote server. Created by {@link ProxyServer.proxy | ProxyServer's proxy.}
   */
  public get remoteClient () {
    return this._proxy?.stateData.bot._client
  }

  /**
   * Whether or not the proxy is currently connected to the server.
   */
  protected _remoteIsConnected: boolean = false

  /**
   * Potential player that controls the remoteBot.
   */
  protected _controllingPlayer: ServerClient | null = null

  /**
   * Getter for {@link ProxyServer._controllingPlayer}
   */
  public get controllingPlayer () {
    return this._controllingPlayer
  }

  /**
   * Flag to check whether or not internal server is online.
   */
  public readonly onlineMode: boolean

  /**
   * Checks if there is a player connected to the local server controlling the remote bot.
   * @returns {boolean} Whether there is a player controlling the remote client or not.
   */
  public isPlayerConnected () {
    return this._controllingPlayer !== null
  }

  public isProxyConnected (): boolean {
    return this._remoteIsConnected
  }

  public psOpts: T

  public readonly cmdHandler: CommandHandler<ProxyServer<T, Events>>

  /**
   * Hidden constructor. Use static methods.
   * @param {boolean} onlineMode Whether the server is online or not.
   * @param {Server} server Internal minecraft-protocol server.
   * @param {BotOptions} bOpts mineflayer bot options.
   * @param {Partial<ConnOptions>} cOpts Connection options to the server.
   * @param {Partial<IProxyServerOpts>} opts Options for ProxyServer.
   */
  protected constructor (
    onlineMode: boolean,
    server: Server,
    bOpts: BotOptions,
    cOpts: Partial<ConnOptions> = {},
    opts: Partial<T> = {}
  ) {
    super({ wildcard: true })
    this.onlineMode = onlineMode
    this.server = server
    this._proxy = null

    // TODO: somehow make this type-safe.
    this.psOpts = merge.withOptions(
      { mergeArrays: false },
      <IProxyServerOpts>{ restartOnDisconnect: false },
      opts
    ) as any

    this._bOpts = bOpts
    this._cOpts = cOpts
    this.cmdHandler = new CommandHandler(this)
    this.server.on('login', this.loginHandler)
    this.cmdHandler.loadDisconnectedCommands({
      start: this.start
    })
    this.cmdHandler.loadProxyCommands({
      stop: this.stop
    })
  }

  /**
   * Function to handle any additional options for the config.
   *
   * I.E. checking if plugins necessary for options are available.
   */
  protected abstract optionValidation (): T

  /**
   * Function to call on initialization of the bot.
   *
   * Note: this is called before {@link ProxyServer.optionValidation | option validation}.
   */
  protected initialBotSetup (bot: Bot): void {}

  /**
   * Helper method when {@link ProxyServer["_controllingPlayer"] | the controlling player} disconnects.
   *
   * Begin certain bot logic here.
   *
   * Note: Workaround, we make this a function instead of anonymous. We just bind.
   */
  protected beginBotLogic (): void {}

  /**
   * Helper method when {@link ProxyServer._controllingPlayer | the controlling player} connects/reconnects.
   *
   * End certain bot logic here.
   *
   * Note: Workaround, we make this a function instead of anonymous. We just bind.
   */
  protected endBotLogic (): void {}

  protected readonly setupProxy = (): void => {
    if (this.remoteBot == null || this.remoteClient == null) return
    this.initialBotSetup(this.remoteBot)
    this.optionValidation()

    this.remoteClient.on('end', this.remoteClientDisconnect)
    this.remoteClient.on('error', this.remoteClientDisconnect)
    this.remoteClient.on('login', () => {
      this._remoteIsConnected = true
    })
    this.remoteBot.once('spawn', this.beginBotLogic)
  }

  /**
   * Handler for when the remote client disconnects from remote server.
   *
   * Usually, we do not know the reason. So for now, we emit an event.
   * @param {string | Error} info reason of disconnect.
   */
  private readonly remoteClientDisconnect = async (info: string | Error) => {
    if (this._controllingPlayer != null) {
      this._controllingPlayer.end('Connection reset by server.')
    }
    this.endBotLogic()
    this._controllingPlayer = null
    this._remoteIsConnected = false
    if (info instanceof Error) {
      this.emit('remoteError' as any, info)
      this.closeConnections('Connection reset by server.')
    } else {
      this.emit('remoteKick' as any, info)
      this.closeConnections('Connection reset by server.\n' + info)
    }
  }

  /**
   * Helper method to determine whether or not the user should be allowed
   * to control the proxy bot.
   *
   * @param {ServerClient} user Local connection to control the bot.
   */
  public isUserAllowedToControl = (user: ServerClient): boolean => {
    if (this.onlineMode) {
      return this.remoteClient?.uuid === user.uuid
    } else {
      return this.remoteClient?.username === user.username
    }
  }

  public isUserWhitelisted = (user: ServerClient): boolean => {
    if (this.psOpts.whitelist == null) return true
    if (this.psOpts.whitelist instanceof Array) {
      return this.psOpts.whitelist.find((n) => n.toLowerCase() === user.username.toLowerCase()) !== undefined
    } else if (typeof this.psOpts.whitelist === 'function') {
      try {
        return !!this.psOpts.whitelist(user.username)
      } catch (e) {
        console.warn('allowlist callback had error', e)
        return false
      }
    }
    return false
  }

  /**
   * Custom version of minecraft-protocol's server close() to give a better message.
   *
   * Note: this also provides cleanup for the remote client and our proxy.
   */
  protected readonly closeConnections = (reason: string = 'Proxy stopped.') => {
    // close remote bot cleanly.
    this._proxy?.disconnect()

    // disconnect all local clients cleanly.
    Object.keys(this.server.clients).forEach((clientId) => {
      const client: Client = this.server.clients[clientId as any]
      client.end(reason)
    })

    this.emit('closedConnections' as any, reason)
    this._remoteIsConnected = false;

    // we no longer want to care about this proxy.
    this._proxy = null
  }

  /**
   * TODO: Add functionality to server (if reused) and remote is not currently connected.
   *
   * @param {ServerClient} actualUser user that just connected to the local server.
   */
  protected whileConnectedLoginHandler = (actualUser: ServerClient) => {
    if (!this.isUserWhitelisted(actualUser)) {
      actualUser.end('Not whitelisted!\n' + 'You need to turn the whitelist off.')
      return // early end.
    }

    if (!this.isUserAllowedToControl(actualUser)) {
      actualUser.end('Not the same account!\n' + 'You need to use the same account as the 2b2w.')
      return // early end.
    }

    this._controllingPlayer = actualUser

    // set event for when they end.
    actualUser.on('end', (reason) => {
      this._controllingPlayer = null
      this.beginBotLogic()
    })

    this.endBotLogic()
    this._proxy!.sendPackets(actualUser as any) // works in original?
    this._proxy!.link(actualUser as any) // again works
  }

  protected notConnectedLoginHandler = (actualUser: ServerClient) => {
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

  public start (): Conn {
    if (this.isProxyConnected()) return this._proxy as Conn
    this._proxy = new Conn(this._bOpts)
    this.setupProxy()
    this.emit('started' as any, this._proxy)
    Object.keys(this.server.clients).forEach((clientId) => {
      const client: Client = this.server.clients[clientId as any]
      client.end('Proxy has started! Rejoin.')
    })
    return this._proxy
  }

  public stop () {
    if (!this.isProxyConnected()) return
    this.closeConnections()
    this.emit('stopped' as any)
  }

  public async restart (ms: number = 0) {
    this.stop()
    await sleep(ms)
    this.start()
  }

  private readonly loginHandler = (actualUser: ServerClient) => {
    this.cmdHandler.updateClientCmds(actualUser)
    if (this.isProxyConnected()) this.whileConnectedLoginHandler(actualUser)
    else this.notConnectedLoginHandler(actualUser)
  }

  public registerClientListeners (...listeners: Array<ClientEventRegister<Bot | Client, any>>) {
    for (const listener of listeners) {
      if (this._registeredClientListeners.has(listener.constructor.name)) continue

      this._registeredClientListeners.add(listener.constructor.name)
      listener.begin()
      this._runningClientListeners.push(listener)
    }
  }

  public removeClientListeners (...listeners: Array<ClientEventRegister<Bot | Client, any>>) {
    for (const listener of listeners) {
      if (!this._registeredClientListeners.has(listener.constructor.name)) continue
      this._registeredClientListeners.delete(listener.constructor.name)
      listener.end()
      this._runningClientListeners = this._runningClientListeners.filter(
        (l) => l.constructor.name !== listener.constructor.name
      )
    }
  }

  public removeAllClientListeners () {
    this._registeredClientListeners.clear()
    for (const listener of this._runningClientListeners) listener.end()
    this._runningClientListeners = []
  }

  public registerServerListeners (...listeners: Array<ServerEventRegister<any, any>>) {
    for (const listener of listeners) {
      if (this._registeredServerListeners.has(listener.constructor.name)) continue
      this._registeredServerListeners.add(listener.constructor.name)
      listener.begin()
      this._runningServerListeners.push(listener)
    }
  }

  public removeServerListeners (...listeners: Array<ServerEventRegister<any, any>>) {
    for (const listener of listeners) {
      if (!this._registeredServerListeners.has(listener.constructor.name)) continue
      this._registeredServerListeners.delete(listener.constructor.name)
      listener.end()
      this._runningServerListeners = this._runningServerListeners.filter(
        (l) => l.constructor.name !== listener.constructor.name
      )
    }
  }

  public removeAllServerListeners () {
    this._registeredServerListeners.clear()
    for (const listener of this._runningServerListeners) {
      listener.end()
    }
    this._runningServerListeners = []
  }
}
