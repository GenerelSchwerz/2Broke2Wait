import { Client, Server, createServer, ServerOptions, ServerClient } from "minecraft-protocol";
import { BotOptions, Bot, BotEvents } from "mineflayer";
import { ConnOptions, Conn, Client as ProxyClient } from "@icetank/mcproxy";
import { Arguments, ListType, TypedEventEmitter, U2I } from "../types/util";
import { CommandHandler, CommandMap } from "../util/commandHandler";
import { ChatMessage as AgnogChMsg } from "prismarine-chat";
import { sleep } from "../util/index";
import merge from "ts-deepmerge";
import { LogConfig, Logger } from "../util/logger";
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
    whitelist?: string[] | ((username: string) => boolean);
    kickMessage: string;
  };

  display: {
    motdPrefix: string;
    proxyChatPrefix: string;
  };

  /**
   * Disconnect all connected players once the proxy bot stops.
   * Defaults to true.
   * If not on players will still be connected but won't receive updates from the server.
   *
   */
  disconnectAllOnEnd?: boolean;
  disableCommands?: boolean;

  /**
   * Restart whenever remote bot disconnects. Defaults to false.
   */
  restartOnDisconnect?: boolean;

  /**
   * Millisecnds until next attempt to reconnect.
   */
  reconnectInterval: number;
}

/**
 * W.I.P., extending so far as necessary.
 */
export interface OtherProxyOpts {
  debug?: boolean;
  cOpts?: Partial<ConnOptions>;
  loggerOpts?: Partial<LogConfig>;
}

type PrefixedBotEvents<Prefix extends string = "botevent_"> = {
  [K in keyof BotEvents as K extends string ? `${Prefix}${K}` : never]: (
    bot: Bot,
    ...args: Arguments<BotEvents[K]>
  ) => void;
};

export type IProxyServerEvents = PrefixedBotEvents & {
  remoteDisconnect: (type: "kicked" | "end" | "error", info: string | Error) => void;
  closingConnections: (reason: string) => void;
  playerConnected: (client: ServerClient, remoteConnected: boolean) => void;
  unauthorizedConnection: (client: ServerClient, reason?: string) => void;
  playerDisconnected: (client: ServerClient) => void;
  optionValidation: (bot: Bot) => void;
  initialBotSetup: (bot: Bot) => void;
  proxySetup: (conn: Conn) => void;
  botAutonomous: (bot: Bot) => void;
  botControlled: (bot: Bot) => void;
  starting: (conn: Conn) => void;
  started: (conn: Conn) => void;
  stopping: () => void;
  stopped: () => void;
  restart: () => void;
} ;

// Unused.
export type Test<Events> = {
  [nme in keyof Events as nme extends string ? `on${Capitalize<nme>}` : never]?: Events[nme] extends (
    ...args: infer Args
  ) => infer Ret
    ? (...args: Args) => Ret
    : never;
};

// TODO: Separate plugins into "emitters" and "listeners"
// "emitters" provide custom events, "listeners" do not (can listen to custom though)
// for use in server builder to lock typings further.
export class ProxyServerPlugin<
  Opts = {},
  L = {},
  E = {},
  ListensTo extends IProxyServerEvents = IProxyServerEvents & L,
  AvailableOpts extends IProxyServerOpts = IProxyServerOpts & Opts,
  AvailableEvents extends IProxyServerEvents = IProxyServerEvents & E

  // ListensTo extends IProxyServerEvents = IProxyServerEvents,
> {
  private _enabled = true;

  public declare _server: ProxyServer<AvailableOpts, AvailableEvents>;
  public declare connectedCmds?: CommandMap;
  public declare disconnectedCmds?: CommandMap;

  public get server(): ProxyServer<AvailableOpts, AvailableEvents> {
    if (this._server == null) throw Error("Server was wanted before proper initialization!");
    return this._server;
  }

  public get psOpts(): AvailableOpts {
    if (this._server == null) throw Error("Proxy options were wanted before proper initialization!");
    return this._server.psOpts;
  }

  public enable() {
    this._enabled = true;
  }

  public disable() {
    this._enabled = false;
  }

  // potential listener methods
  onPreStart?: (conn: Conn) => void;
  onPostStart?: () => void;
  onPreStop?: () => void;
  onPostStop?: () => void;
  onBotAutonomous?: (bot: Bot) => void;
  onBotControlled?: (bot: Bot) => void;
  onProxySetup?: (conn: Conn) => void;
  onOptionValidation?: (bot: Bot) => void;
  onInitialBotSetup?: (bot: Bot) => void;
  onClosingConnections?: (reason: string) => void;
  onPlayerConnected?: (client: ServerClient, remoteConnected: boolean) => void;
  whileConnectedLoginHandler?: (player: ServerClient) => Promise<boolean> | boolean;
  notConnectedLoginHandler?: (player: ServerClient) => Promise<boolean> | boolean;
  onRemoteKick?: (reason: string) => void;
  onRemoteDisconnect?: (type: "kicked" | "end" | "error", info: string | Error) => void;

  private readonly listenerMap: Map<keyof ListensTo, Array<{ original: Function; ref: Function }>> = new Map();

  /**
   * Creates wrapper around whatever function is provided so that it fires only when the plugin is enabled
   * @param event Event to listen to (based on Events typing from class)
   * @param listener Listener to apply to event
   * @returns void
   */
  public serverOn<Key extends keyof ListensTo>(
    event: Key,
    listener: ListensTo[Key] extends Function ? ListensTo[Key] : never
  ) {
    const listeners = this.listenerMap.get(event) ?? [];
    const test = listener;
    const wrapper = (...args: any[]) => {
      if (this._enabled) {
        listener(...args);
      }
    };

    const built = {
      original: test,
      ref: wrapper,
    };

    if (listeners.findIndex((check) => check.original === test) > -1) {
      throw Error(`Registering event ${String(event)} twice on ${this.constructor.name}`);
    }

    listeners.push(built);
    this.listenerMap.set(event, listeners);
    this._server.on(event as any, wrapper as any);
  }

  /**
   * Utility method to remove the wrapped function based on the original input.
   * @param event Event to listen to (based on Events typing from class)
   * @param listener Listener to apply to event
   * @returns void
   */
  public serverOff<Key extends keyof ListensTo>(
    event: Key,
    listener: ListensTo[Key] extends Function ? ListensTo[Key] : never
  ) {
    const listeners = this.listenerMap.get(event);
    if (listeners == null) return;

    const idx = listeners.findIndex((check) => check.original === listener);
    const found = listeners[idx];
    this.listenerMap.set(event, listeners.splice(idx, 1));
    this._server.off(event as any, found.ref as any);
  }

  /**
   * Function that is called whenever the server is ready to load plugins
   * @param server
   */
  public onLoad(server: ProxyServer<AvailableOpts, AvailableEvents>) {
    this._server = server;

    // TODO: Generalize this.

    if (this.onPreStop != null) this.serverOn("stopping", this.onPreStop as any);
    if (this.onPostStop != null) this.serverOn("stopped", this.onPostStop as any);
    if (this.onPreStart != null) this.serverOn("starting", this.onPreStart as any);
    if (this.onPostStart != null) this.serverOn("started", this.onPostStart as any);
    if (this.onProxySetup != null) this.serverOn("proxySetup", this.onProxySetup as any);
    if (this.onBotAutonomous != null) this.serverOn("botAutonomous", this.onBotAutonomous as any);
    if (this.onBotControlled != null) this.serverOn("botControlled", this.onBotControlled as any);
    if (this.onClosingConnections != null) this.serverOn("closingConnections", this.onClosingConnections as any);
    if (this.onPlayerConnected != null) this.serverOn("playerConnected", this.onPlayerConnected as any);
    if (this.onOptionValidation != null) this.serverOn("optionValidation", this.onOptionValidation as any);
    if (this.onInitialBotSetup != null) this.serverOn("initialBotSetup", this.onInitialBotSetup as any);
    if (this.onRemoteDisconnect != null) this.serverOn("remoteDisconnect", this.onRemoteDisconnect as any);
  }

  /**
   * This is never called by the server.
   *
   * However, code-wise it is possible to unload plugins.
   * @param server
   */
  public onUnload(server: ProxyServer<AvailableOpts, AvailableEvents>) {
    this._server = server;
    for (const [event, listenerList] of this.listenerMap.entries()) {
      listenerList.forEach((e) => this.serverOff(event as any, e as any));
    }
  }

  /**
   * Emit proxy to go straight to the server.
   * @param event
   * @param args
   */
  public serverEmit<E extends keyof AvailableEvents>(event: E, ...args: Arguments<AvailableEvents[E]>) {
    this.server.emit(event, ...args);
  }

  /**
   * Log data from plugins to the server's logger.
   * @param name
   * @param data
   */
  public serverLog = (name: string, ...data: any[]) => {
    this.server.logger.log(name, "localServerPlugins", data);
  };

  /**
   * Set the server's opts via merging partial options.
   *
   * NOTE: Technically not type-safe. (could provide "undefined" to otherwise required input)
   * @param opts
   */
  public setServerOpts(opts: Partial<AvailableOpts>) {
    this.server.psOpts = merge(opts, this.psOpts) as any;
  }

  /**
   * Share data into {@link ProxyServer.pluginStorage a shared plugin storage}.
   * @param key {string} Value to index by to retrieve stored value.
   * @param data {any} Value to store
   * @returns
   */
  public share(key: string, data: any) {
    return this.server.storeSharedData(key, data);
  }

  /**
   * Drops data from {@link ProxyServer.pluginStorage a shared plugin storage}.
   * @param key {string} Value to index by to delete stored value.
   * @returns
   */
  public drop(key: string) {
    return this.server.dropSharedData(key);
  }

  /**
   * Get data shared from {@link share}
   * @param key {string} Value to index by to retrieve stored value.
   * @returns
   */
  public getShared<Value extends any>(key: string): Value | undefined {
    return this.server.getSharedData(key);
  }
}

type OptExtr<Fuck> = Fuck extends ProxyServerPlugin<infer Opts, any> ? Opts : never;
type LiExtr<Fuck> = Fuck extends ProxyServerPlugin<any, infer Events, any> ? Events : never;
type EmExtr<Fuck> = Fuck extends ProxyServerPlugin<any, any, infer Events> ? Events : never;

/**
 * Strongly typed server builder. Makes sure settings matches all plugins.
 */
export class ServerBuilder<Opts extends IProxyServerOpts, Emits extends IProxyServerEvents, AppliedSettings = false> {
  private _plugins: Array<ProxyServerPlugin<any, any, any>>;

  private _settings?: Opts;
  private _otherSettings: OtherProxyOpts = {};
  private readonly _appliedSettings: AppliedSettings = false as any;
  constructor(public readonly lsOpts: ServerOptions, public readonly bOpts: BotOptions, other: OtherProxyOpts = {}) {
    this._plugins = [];
    this._otherSettings = other;
  }

  public get appliedSettings(): AppliedSettings {
    return this._appliedSettings;
  }

  public get settings() {
    return this._settings;
  }

  public get plugins() {
    return this._plugins;
  }

  public addPlugin<O, L, E>(
    this: ServerBuilder<Opts, Emits, false>,
    plugin: Emits extends L ? ProxyServerPlugin<O, L, E> : never
  ): ServerBuilder<Opts & O, Emits & E, AppliedSettings> {
    this.plugins.push(plugin);
    return this as any;
  }

  public addPlugins<
    Plugins extends Array<ProxyServerPlugin<any, any>>,
    O = U2I<OptExtr<ListType<Plugins>>>,
    E = U2I<EmExtr<ListType<Plugins>>>
  >(this: ServerBuilder<Opts, Emits, false>, ...plugins: Plugins): ServerBuilder<Opts & O, Emits & E, AppliedSettings> {
    this._plugins = this.plugins.concat(...plugins);
    return this as any;
  }

  public addPluginStatic<O, E>(
    this: ServerBuilder<Opts, Emits, false>,
    plugin: typeof ProxyServerPlugin<O, any, E>
  ): ServerBuilder<Opts & O, Emits & E, AppliedSettings> {
    const build = new plugin();
    this.plugins.push(build);
    return this as any;
  }

  public setSettings(settings: Opts): ServerBuilder<Opts, Emits, true> {
    this._settings = settings;
    (this as any)._appliedSettings = true;
    return this as any;
  }

  public setOtherSettings(other: OtherProxyOpts): this {
    this._otherSettings = other;
    return this;
  }

  public build<This extends ServerBuilder<Opts, Emits, true>>(this: This): ProxyServer<Opts, Emits> {
    let srv = new ProxyServer<Opts, Emits>(this.lsOpts, this.settings!, this.bOpts, this._otherSettings);
    for (const plugin of this.plugins) {
      srv = srv.loadPlugin(plugin);
    }
    return srv;
  }
}

export class ProxyServer<
  O = {},
  E = {},
  Opts extends IProxyServerOpts = IProxyServerOpts & O,
  Events extends IProxyServerEvents = IProxyServerEvents & E
> extends TypedEventEmitter<Events> {
  protected readonly plugins: Map<string, ProxyServerPlugin<IProxyServerOpts, IProxyServerEvents>> = new Map();
  protected readonly pluginStorage: Map<string, any> = new Map();
  protected readonly cmdHandler: CommandHandler<ProxyServer<Opts, Events>>;
  protected readonly _rawServer: Server;

  protected _conn: Conn | null;
  public bOpts: BotOptions;
  public lsOpts: ServerOptions;
  public psOpts: Opts;
  public otherOpts: OtherProxyOpts;

  private manuallyStopped = false;

  public logger: Logger;

  // public manuallyStopped: boolean = false;
  public ChatMessage!: typeof AgnogChMsg;

  public get rawServer(): Server {
    return this._rawServer;
  }

  public get proxy(): Conn | null {
    return this._conn;
  }

  public get conn(): Conn | null {
    return this._conn;
  }

  public get remoteBot(): Bot | null {
    return this._conn?.stateData.bot ?? null;
  }

  public get remoteClient(): Client | null {
    return this._conn?.stateData.bot._client ?? null;
  }

  protected _remoteIsConnected: boolean = false;

  public get controllingPlayer(): ProxyClient | null {
    return this._conn?.pclient ?? null;
  }

  public isPlayerControlling(): boolean {
    return this._conn?.pclient != null;
  }

  public isProxyConnected() {
    return this._remoteIsConnected;
  }

  constructor(lsOpts: ServerOptions, psOpts: Opts, bOpts: BotOptions, other: OtherProxyOpts = {}) {
    super();
    this.bOpts = bOpts;
    this.otherOpts = other;
    this.lsOpts = lsOpts;
    this.psOpts = psOpts;
    this._conn = null;
    this.logger = new Logger(other?.loggerOpts);
    this._rawServer = createServer(lsOpts);
    this.ChatMessage = require("prismarine-chat")(bOpts.version);

    this.cmdHandler = new CommandHandler(this);
    this.cmdHandler.loadProxyCommand("pstop", {
      description: "stops the server",
      usage: "pstop",
      callable: this.stop.bind(this),
    });
    this.cmdHandler.loadDisconnectedCommand("pstart", {
      description: "starts the server",
      usage: "pstart",
      callable: this.start.bind(this),
    });
    this._rawServer.on("login", this.loginHandler);

    // debugging magick.

    const oldEmit = this.emit.bind(this);

    this.emit = (event: any, ...args: any[]) => {
      oldEmit(event, ...args);
      if (this.otherOpts.debug) {
        const fixedArgs = args.map((arg) =>
          ["string", "number", "boolean", "undefined"].includes(typeof arg) ? arg : arg?.constructor.name ?? "null"
        );

        if (typeof event === "string" && event.startsWith("botevent_")) {
          this.logger.log(event.replace("botevent_", ""), "remoteBotEvents", args);
        }

        this.logger.log(`emit:${String(event)}`, "localServerInfo", fixedArgs);
      }
    };
  }

  // TODO: Broken typings.
  // Use the publicly exposed builder instead.
  public loadPlugin<FoundOpts, FoundEvents>(
    inserting: Opts extends FoundOpts
      ? Events extends FoundEvents
        ? ProxyServerPlugin<FoundOpts, FoundEvents>
        : never
      : never
  ): ProxyServer<Opts, Events> {
    inserting.onLoad(this as any);
    this.plugins.set(inserting.constructor.name, inserting as any);
    if (inserting.connectedCmds != null) this.cmdHandler.loadProxyCommands(inserting.connectedCmds);
    if (inserting.disconnectedCmds != null) this.cmdHandler.loadDisconnectedCommands(inserting.disconnectedCmds);

    return this as any;
  }

  public unloadPlugin(removing: ProxyServerPlugin<any, any>): void {
    this.plugins.get(removing.constructor.name)?.onUnload(this as any);
    this.plugins.delete(removing.constructor.name);
  }

  public hasPlugin(removing: ProxyServerPlugin<any, any>): boolean {
    return Boolean(this.plugins.get(removing.constructor.name));
  }

  public enablePlugin(plugin: ProxyServerPlugin<any, any>): boolean {
    const gotten = this.plugins.get(plugin.constructor.name);
    if (gotten == null) return false;
    gotten.enable();
    return true;
  }

  public disablePlugin(plugin: ProxyServerPlugin<any, any>): boolean {
    const gotten = this.plugins.get(plugin.constructor.name);
    if (gotten == null) return false;
    gotten.disable();
    return true;
  }

  /**
   * To be used by plugins.
   * @param key
   * @param data
   * @returns
   */
  public storeSharedData(key: string, data: any) {
    return this.pluginStorage.set(key, data);
  }

  /**
   * Drop value indexed by key.
   * @param key
   * @returns
   */
  public dropSharedData(key: string) {
    return this.pluginStorage.delete(key);
  }

  public getSharedData<Value extends any>(key: string): Value | undefined {
    return this.pluginStorage.get(key);
  }

  public runCmd(client: Client, cmd: string, ...args: string[]) {
    this.cmdHandler.manualRun(cmd, client, ...args);
  }

  public start(): Conn {
    if (this.isProxyConnected()) return this._conn!;
    this.manuallyStopped = false;
    this._conn = new Conn(this.bOpts, this.otherOpts.cOpts);
    this.reconnectAllClients(this._conn);
    this.emit("starting" as any, this._conn as any);
    this.setup();
    this.emit("started" as any);
    return this._conn;
  }

  public stop(): void {
    if (!this.isProxyConnected()) return;
    this.emit("stopping" as any);
    this.manuallyStopped = true;
    this.disconnectRemote("Proxy manually stopped.");
    this.emit("stopped" as any);
  }

  public async restart(ms = 0) {
    this.stop();
    await sleep(ms);
    this.start();
  }

  private setup(): void {
    if (this.remoteBot == null || this.remoteClient == null || this.conn == null) {
      throw Error("Setup called when remote bot does not exist!");
    }

    this.emit("proxySetup" as any, this._conn!, this.psOpts);

    this.remoteClient.on("packet", (data, meta, buffer) => this.logger.log(meta.name, "remoteBotReceive", data));

    this.emit("optionValidation" as any, this.remoteBot, this.psOpts);
    this.emit("initialBotSetup" as any, this.remoteBot, this.psOpts);

    this.remoteBot.once("spawn", this.beginBotLogic);
    this.remoteBot.on("kicked", this.remoteClientDisconnect.bind(this, "KICKED"));
    this.remoteBot.on("end", this.remoteClientDisconnect.bind(this, "END"));
    this.remoteBot.on("error", this.remoteClientDisconnect.bind(this, "ERROR"));

    this.remoteClient.on("login", () => {
      this._remoteIsConnected = true;
    });

    const oldEmit = this.remoteBot.emit.bind(this.remoteBot);

    // We overwrite emits from bots and clients to log their data.
    this.remoteBot.emit = <E extends keyof BotEvents>(event: E, ...args: Arguments<BotEvents[E]>) => {
      this.emit(`botevent_${event}` as any, this.remoteBot!, ...args);
      return oldEmit(event, ...args);
    };

    const oldClientWrite = this.remoteClient.write.bind(this.remoteClient);
    this.remoteClient.write = (name, params) => {
      this.logger.log(name, "remoteBotSend", params);
      return oldClientWrite(name, params);
    };

    const oldClientWriteChannel = this.remoteClient.writeChannel.bind(this.remoteClient);
    this.remoteClient.writeChannel = (channel, params) => {
      this.logger.log(`channel${channel}`, "remoteBotSend", params);
      return oldClientWriteChannel(channel, params);
    };

    const oldClientWriteRaw = this.remoteClient.writeRaw.bind(this.remoteClient);
    this.remoteClient.writeRaw = (buffer) => {
      this.logger.log("rawBuffer", "remoteBotSend", buffer);
      return oldClientWriteRaw(buffer);
    };

    this.conn.write = this.remoteClient.write;
    this.conn.writeChannel = this.remoteClient.writeChannel;
    this.conn.writeRaw = this.remoteClient.writeRaw;
    // const oldWriteIf = this.conn.writeIf.bind(this.conn);
    // this.conn.writeIf = async (name: string, data: any) => {
    //   console.log("conn write", name)
    //   this.logger.log(name, "remoteBotSend", data);
    //   return oldWriteIf(name, data);
    // }
  }

  public beginBotLogic = (): void => {
    if (this.remoteBot == null) throw Error("Bot logic called when bot does not exist!");
    this.emit("botAutonomous" as any, this.remoteBot, this.psOpts);
  };

  public endBotLogic = (): void => {
    if (this.remoteBot == null) throw Error("Bot logic called when bot does not exist!");
    this.emit("botControlled" as any, this.remoteBot, this.psOpts);
  };

  private readonly loginHandler = (actualUser: ServerClient) => {
    this.emit("playerConnected" as any, actualUser, this.isProxyConnected());
    actualUser.once("end", () => this.emit("playerDisconnected" as any, actualUser));

    this.cmdHandler.updateClientCmds(actualUser as unknown as ProxyClient);
    if (this.isProxyConnected()) this.whileConnectedLoginHandler(actualUser);
    else this.notConnectedLoginHandler(actualUser);
  };

  private readonly remoteClientDisconnect = async (reason: string, info: string | Error) => {
    if (this.remoteBot == null) return; // assume we've already exited ( we want to leave early on kicks )

    this.endBotLogic();

    this.emit("remoteDisconnect" as any, reason, info);
    if (this.psOpts.disconnectAllOnEnd) {
      // parse out text content, otherwise raw.
      try {
        info = JSON.parse(info as any).text;
      } catch (e) {}
      this.closeConnections("Kicked from server.", true, String(info));
    } else {
      this.broadcastMessage("[WARNING] Bot has disconnected!");
      this.broadcastMessage("You are still connected.");
    }

    this._remoteIsConnected = false;
    this._conn = null;

    if (this.psOpts.restartOnDisconnect && !this.manuallyStopped) {
      this.restart(this.psOpts.reconnectInterval);
    }
  };

  private readonly closeConnections = (closeReason: string, closeRemote = false, additional?: string) => {
    const reason = additional ? closeReason + "\n\nReason: " + additional : closeReason;

    this.emit("closingConnections" as any, reason);

    Object.keys(this._rawServer.clients).forEach((clientId) => {
      this._rawServer.clients[Number(clientId)].end(reason);
    });

    if (closeRemote) {
      this.disconnectRemote(closeReason);
    }
  };

  private readonly disconnectRemote = (reason: string) => {
    if (this._conn != null) {
      // const currentClients = Object.values(this._rawServer.clients);
      // for (const pc of this._conn.pclients) {
      //   const found = currentClients.find(c => pc.uuid === c.uuid);
      //   if (found) {
      //     (found as any).cachedClientMiddlewares = pc.toClientMiddlewares;
      //     (found as any).cachedServerMiddlewares = pc.toServerMiddlewares;
      //   }
      // }

      this._conn.stateData.bot._client.end("[2B2W]: " + reason);
      this._conn.pclients.forEach(this._conn.detach.bind(this._conn));
    }
  };

  private readonly reconnectAllClients = (conn: Conn) => {
    Object.values(this._rawServer.clients).forEach((c) => {
      this.broadcastMessage("[INFO] Bot has started!");
      this.broadcastMessage("Reconnect to see the new bot.");
      this.cmdHandler.decoupleClientCmds(c as unknown as ProxyClient);
      this.cmdHandler.updateClientCmds(c as unknown as ProxyClient);
    });
  };

  /**
   * Default login handler. This can/will be overriden by plugins.
   * @param actualUser
   * @returns
   */
  private readonly whileConnectedLoginHandler = async (actualUser: ServerClient) => {
    for (const plugin of this.plugins.values()) {
      const res = await plugin.whileConnectedLoginHandler?.(actualUser);
      if (res != null) return;
    }

    if (!this.isUserWhitelisted(actualUser)) {
      const { address, family, port } = {
        address: "unknown",
        family: "unknown",
        port: "unknown",
        ...actualUser.socket.address(),
      };
      this.emit("unauthorizedConnection" as any, actualUser);
      actualUser.end(this.psOpts.security?.kickMessage ?? "You are not in the whitelist");
      return;
    }

    const allowedToControl = this.lsOpts["online-mode"]
      ? this.remoteClient?.uuid === actualUser.uuid
      : this.remoteClient?.username === actualUser.username;

    if (!allowedToControl) {
      this.emit("unauthorizedConnection" as any, actualUser);
      actualUser.end("This user is not allowed to control the bot!");
      return; // early end.
    }

    // set event for when they end.
    actualUser.on("end", (reason) => {
      this.beginBotLogic();
    });

    this.endBotLogic();
    this._conn!.sendPackets(actualUser as any); // works in original?
    this._conn!.link(actualUser as any); // again works
  };

  protected notConnectedLoginHandler = (actualUser: ServerClient) => {
    for (const plugin of this.plugins.values()) {
      if (plugin.notConnectedLoginHandler?.(actualUser) != null) return;
    }

    actualUser.write("login", {
      entityId: actualUser.id,
      levelType: "default",
      gameMode: 0,
      dimension: 0,
      difficulty: 2,
      maxPlayers: 1,
      reducedDebugInfo: false,
    });
    actualUser.write("position", {
      x: 0,
      y: 1.62,
      z: 0,
      yaw: 0,
      pitch: 0,
      flags: 0x00,
    });
  };

  public isUserWhitelisted = (user: Client): boolean => {
    if (this.psOpts.security.whitelist == null) return true;
    if (this.psOpts.security.whitelist instanceof Array) {
      return this.psOpts.security.whitelist.find((n) => n.toLowerCase() === user.username.toLowerCase()) !== undefined;
    } else if (typeof this.psOpts.security.whitelist === "function") {
      try {
        return !!this.psOpts.security.whitelist(user.username);
      } catch (e) {
        console.warn("allowlist callback had error", e);
        return false;
      }
    }
    return false;
  };

  // ======================= //
  //     message utils       //
  // ======================= //

  message(
    client: Client,
    message: string,
    prefix: boolean = true,
    allowFormatting: boolean = true,
    position: number = 1
  ) {
    if (!allowFormatting) message = message.replaceAll(/§./, "");
    if (prefix) message = this.psOpts.display.proxyChatPrefix + message;
    this.sendMessage(client, message, position);
  }

  sendMessage(client: ServerClient | Client, message: string, position: number = 1) {
    const messageObj = new this.ChatMessage(message);
    client.write("chat", { message: messageObj.json.toString(), position });
  }

  broadcastMessage(message: string, prefix: boolean = true, allowFormatting?: boolean, position?: number) {
    Object.values(this._rawServer.clients).forEach((c) => {
      this.message(c, message, prefix, allowFormatting, position);
    });
  }
}
