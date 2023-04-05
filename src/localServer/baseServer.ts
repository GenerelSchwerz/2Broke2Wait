import { Client, Server, createServer, ServerOptions, ServerClient } from "minecraft-protocol";
import { BotOptions, Bot, BotEvents } from "mineflayer";
import { ConnOptions, Conn, Client as ProxyClient } from "@rob9315/mcproxy";
import { Arguments, ListType, TypedEventEmitter, U2I, U2T } from "../util/utilTypes";
import { CommandHandler, CommandMap } from "../util/commandHandler";
import { ChatMessage as AgnogChMsg } from "prismarine-chat";
import { sleep } from "../util/index";
import { SpectatorServerEvents, SpectatorServerOpts } from "./plugins/spectator";
import { TwoBAntiAFKEvents, TwoBAntiAFKPlugin } from "./plugins/twoBAntiAFK";
import merge from "ts-deepmerge";

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
}

type PrefixedBotEvents<Prefix extends string = "botevent"> = {
  [K in keyof BotEvents as K extends string ? `${Prefix}_${K}` : never]: (
    bot: Bot,
    ...args: Arguments<BotEvents[K]>
  ) => void;
};

export type IProxyServerEvents = {
  remoteKick: (reason: string) => void;
  remoteError: (error: Error) => void;
  closingConnections: (reason: string) => void;

  playerConnected: (client: ServerClient, remoteConnected: boolean) => void;
  playerDisconnected: (client: ServerClient) => void;
  optionValidation: (bot: Bot) => void;
  initialBotSetup: (bot: Bot) => void;
  proxySetup: (conn: Conn) => void;
  botStartup: (bot: Bot) => void;
  botShutdown: (bot: Bot) => void;
  starting: (conn: Conn) => void;
  started: (conn: Conn) => void;
  stopping: () => void;
  stopped: () => void;
  restart: () => void;
} & PrefixedBotEvents;

export type Test<Events> = {
  [nme in keyof Events as nme extends string ? `on${Capitalize<nme>}`: never]?: 
    Events[nme] extends (...args: infer Args) => infer Ret ? (...args: Args) => Ret : never;
};


interface TestEvents  {
  hi: (num: number) => string
}

// Strongly typed
const test: Test<TestEvents> = {
  onHi: (num) => "hi"
}

export class ProxyServerPlugin<Opts extends IProxyServerOpts, Events extends IProxyServerEvents> {

  public declare _server: ProxyServer<Opts, Events>;
  public declare name: string;
  public declare connectedCmds?: CommandMap;
  public declare disconnectedCmds?: CommandMap;

  public get server(): ProxyServer<Opts, Events> {
    if (this._server == null) throw Error("Server was wanted before proper initialization!");
    return this._server;
  }

  public get psOpts(): Opts {
    if (this._server == null) throw Error("Proxy options were wanted before proper initialization!");
    return this._server.psOpts;
  }

  // potential listener methods
  onPreStart?: (conn: Conn) => void;
  onPostStart?: () => void;
  onPreStop?: () =>  void;
  onPostStop?: () => void;
  onBotStartup?: (bot: Bot) => void;
  onBotShutdown?: (bot: Bot) => void;
  onProxySetup?: (conn: Conn) => void;
  onOptionValidation?: (bot: Bot) => void;
  onInitialBotSetup?: (bot: Bot) => void;
  onClosingConnections?: (reason: string) => void;
  onPlayerConnected?: (client: ServerClient, remoteConnected: boolean) => void;
  whileConnectedLoginHandler?: (player: ServerClient) => Promise<boolean>;
  notConnectedLoginHandler?: (player: ServerClient) => Promise<boolean>;
  onRemoteKick?: (reason: string) => void;
  onRemoteError?: (error: Error) => void;

  public onLoad(server: ProxyServer<Opts, Events>) {
    this._server = server;
    // TODO: Generalize this.
    if (this.onPreStop != null) this._server.on("stopping", this.onPreStop);
    if (this.onPostStop != null) this._server.on("stopped", this.onPostStop);
    if (this.onPreStart != null) this._server.on("starting" as any, this.onPreStart);
    if (this.onPostStart != null) this._server.on("started", this.onPostStart);
    if (this.onProxySetup != null) this._server.on("proxySetup" as any, this.onProxySetup);
    if (this.onBotStartup != null) this._server.on("botStartup" as any, this.onBotStartup);
    if (this.onBotShutdown != null) this._server.on("botShutdown" as any, this.onBotShutdown);
    if (this.onClosingConnections != null) this._server.on("closingConnections" as any, this.onClosingConnections);

    if (this.onPlayerConnected != null) this._server.on("playerConnected" as any, this.onPlayerConnected);
    if (this.onOptionValidation != null) this._server.on("optionValidation" as any, this.onOptionValidation);
    if (this.onInitialBotSetup != null) this._server.on("initialBotSetup" as any, this.onInitialBotSetup);
    if (this.onRemoteError != null) this._server.on("remoteError" as any, this.onRemoteError);
    if (this.onRemoteKick != null) this._server.on("remoteKick" as any, this.onRemoteKick);
  }

  // This doesn't work since binding. Oh well, we'll never call this.
  public onUnload(server: ProxyServer<Opts, Events>) {
    this._server = server;
    if (this.onPreStop != null) this._server.off("stopping", this.onPreStop);
    if (this.onPostStop != null) this._server.off("stopped", this.onPostStop);
    if (this.onPreStart != null) this._server.off("starting" as any, this.onPreStart);
    if (this.onPostStart != null) this._server.off("started", this.onPostStart);
    if (this.onProxySetup != null) this._server.off("proxySetup" as any, this.onProxySetup);
    if (this.onBotStartup != null) this._server.off("botStartup" as any, this.onBotStartup);
    if (this.onBotShutdown != null) this._server.off("botShutdown" as any, this.onBotShutdown);
    if (this.onClosingConnections != null) this._server.off("closingConnections" as any, this.onClosingConnections);

    if (this.onPlayerConnected != null) this._server.off("playerConnected" as any, this.onPlayerConnected);
    if (this.onOptionValidation != null) this._server.off("optionValidation" as any, this.onOptionValidation);
    if (this.onInitialBotSetup != null) this._server.off("initialBotSetup" as any, this.onInitialBotSetup);
    if (this.onRemoteError != null) this._server.off("remoteError" as any, this.onRemoteError);
    if (this.onRemoteKick != null) this._server.off("remoteKick" as any, this.onRemoteKick);
  }

  /**
   * Emit proxy to go straight to the server.
   * @param event
   * @param args
   */
  public serverEmit<E extends keyof Events>(event: E, ...args: Arguments<Events[E]>) {
    this.server.emit(event, ...args);
  }

  public setServerOpts(opts: Partial<Opts>) {
    this.server.psOpts = merge(opts, this.psOpts) as any;
  }

  public share(key: string, data: any) {
    return this.server.storePluginData(key, data);
  }

  public getShared<Value extends any>(key: string): Value | undefined {
    return this.server.getPluginData(key);
  }
}


type OptExtr<Fuck> = Fuck extends ProxyServerPlugin<infer Opts, any> ? Opts : never;
type EvExtr<Fuck> = Fuck extends ProxyServerPlugin<any, infer Events> ? Events : never;


/**
 * Strongly typed server builder. Makes sure settings matches all plugins.
 */
export class ServerBuilder<Opts extends IProxyServerOpts, Events extends IProxyServerEvents, AppliedSettings = false> {
  private _plugins: ProxyServerPlugin<any, any>[];
  
  private _settings?: Opts;
  private _appliedSettings: AppliedSettings = false as any;
  constructor(
    public readonly lsOpts: ServerOptions,
    public readonly bOpts: BotOptions,
    public readonly cOpts: Partial<ConnOptions> = {},
    ...plugins: ProxyServerPlugin<any, any>[]
  ) {
    this._plugins = plugins;
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

  public addPlugin<FoundEvent extends IProxyServerEvents, FoundOpts extends IProxyServerOpts>(
    this: ServerBuilder<Opts, Events, false>,
    plugin: ProxyServerPlugin<FoundOpts, FoundEvent>
  ): ServerBuilder<Opts & FoundOpts, Events & FoundEvent, AppliedSettings> {
    this.plugins.push(plugin);
    return this as any;
  }

  public addPlugins<
    Plugins extends ProxyServerPlugin<any, any>[],
    NewOpts = U2I<OptExtr<ListType<Plugins>>>,
    NewEvs = U2I<EvExtr<ListType<Plugins>>>
  >(
    this: ServerBuilder<Opts, Events, false>,
    ...plugins: Plugins
  ): ServerBuilder<Opts & NewOpts, Events & NewEvs, AppliedSettings> {
    this._plugins = this.plugins.concat(...plugins);
    return this as any;
  }

  public addPluginStatic<FoundOpts extends IProxyServerOpts, FoundEvent extends IProxyServerEvents>(
    this: ServerBuilder<Opts, Events, false>,
    plugin: typeof ProxyServerPlugin<FoundOpts, FoundEvent>
  ): ServerBuilder<Opts & FoundOpts, Events & FoundEvent, AppliedSettings> {
    const build = new plugin();
    this.plugins.push(build);
    return this as any;
  }

  public setSettings(settings: Opts): ServerBuilder<Opts, Events, true> {
    this._settings = settings;
    (this as any)._appliedSettings = true;
    return this as any;
  }

  public build<This extends ServerBuilder<Opts, Events, true>>(this: This) {
    let srv = new ProxyServer(this.lsOpts, this.settings!, this.bOpts, this.cOpts);
    for (const plugin of this.plugins) {
      srv = srv.loadPlugin(plugin);
    }
    return srv as ProxyServer<Opts, Events>;
  }
}



export class ProxyServer<
  Opts extends IProxyServerOpts,
  Events extends IProxyServerEvents
> extends TypedEventEmitter<Events> {
  protected readonly plugins: Map<string, ProxyServerPlugin<IProxyServerOpts, IProxyServerEvents>> = new Map();
  protected readonly pluginStorage: Map<string, any> = new Map();
  protected readonly cmdHandler: CommandHandler<ProxyServer<Opts, Events>>;
  protected readonly _rawServer: Server;

  protected _conn: Conn | null;
  public bOpts: BotOptions;
  public cOpts: Partial<ConnOptions>;
  public lsOpts: ServerOptions;
  public psOpts: Opts;

  public manuallyStopped: boolean = false;
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

  constructor(lsOpts: ServerOptions, psOpts: Opts, bOpts: BotOptions, cOpts: Partial<ConnOptions> = {}) {
    super();
    this.bOpts = bOpts;
    this.cOpts = cOpts;
    this.lsOpts = lsOpts;
    this.psOpts = psOpts;
    this._conn = null;
    this._rawServer = createServer(lsOpts);
    this.ChatMessage = require("prismarine-chat")(bOpts.version);

    this.cmdHandler = new CommandHandler(this);
    this.cmdHandler.loadProxyCommand("pstop", this.stop);
    this.cmdHandler.loadDisconnectedCommand("pstart", this.start);

    this._rawServer.on("login", this.loginHandler);
  }

  // TODO: Broken typings.
  public loadPlugin<FoundOpts extends IProxyServerOpts, FoundEvents extends IProxyServerEvents>(
    inserting: Opts extends FoundOpts ? Events extends FoundEvents ?  ProxyServerPlugin<FoundOpts, FoundEvents> : never : never
  ): ProxyServer<Opts & FoundOpts, Events & FoundEvents> {
    inserting.onLoad(this as any);
    this.plugins.set(inserting.name, inserting as any);
    if (inserting.connectedCmds != null) this.cmdHandler.loadProxyCommands(inserting.connectedCmds);
    if (inserting.disconnectedCmds != null) this.cmdHandler.loadDisconnectedCommands(inserting.disconnectedCmds);

    return this as any;
  }

  public unloadPlugin(removing: ProxyServerPlugin<any, any> | string) {
    if (removing instanceof String) {
      this.plugins.get(removing as string)?.onUnload(this);
      this.plugins.delete(removing as string);
    } else {
      this.plugins.get((removing as ProxyServerPlugin<any, any>).name)?.onUnload(this);
      this.plugins.delete((removing as ProxyServerPlugin<any, any>).name);
    }
  }

  public hasPlugin(removing: ProxyServerPlugin<any, any> | string) {
    if (removing instanceof String) {
      return Boolean(this.plugins.get(removing as string));
    } else {
      return Boolean(this.plugins.get((removing as ProxyServerPlugin<any, any>).name));
    }
  }

  /**
   * To be used by plugins.
   * @param key 
   * @param data 
   * @returns 
   */
  public storePluginData(key: string, data: any) {
    return this.pluginStorage.set(key, data);
  }


  public getPluginData<Value extends any>(key: string): Value | undefined {
    return this.pluginStorage.get(key)
  }

  public start(): Conn {
    if (this.isProxyConnected()) return this._conn!;
    this.closeConnections("Proxy restarted! Rejoin to re-sync.");
    this._conn = new Conn(this.bOpts, this.cOpts);
    this.manuallyStopped = false;
    this.emit("starting" as any, this._conn);
    this.setup();
    this.emit("started" as any);
    return this._conn;
  }

  public stop(): void {
    if (!this.isProxyConnected()) return;
    this.manuallyStopped = true;
    this.emit("stopping" as any);
    this.closeConnections("Proxy stoppped.", true);
    this.emit("stopped" as any);
  }

  public async restart(ms = 0) {
    this.stop();
    await sleep(ms);
    this.start();
  }

  private setup(): void {
    if (this.remoteBot == null || this.remoteClient == null) {
      throw Error("Setup called when remote bot does not exist!");
    }

    this.emit("proxySetup" as any, this._conn!, this.psOpts);

    const oldEmit = this.remoteBot.emit.bind(this.remoteBot);

    this.remoteBot.emit = <E extends keyof BotEvents>(event: E, ...args: Arguments<BotEvents[E]>) => {
      this.emit(`botevent:${event}` as any, this.remoteBot!, ...args);
      return oldEmit(event, ...args);
    };

    this.emit("optionValidation" as any, this.remoteBot, this.psOpts);

    this.emit("initialBotSetup" as any, this.remoteBot, this.psOpts);

    this.remoteBot.once("spawn", this.beginBotLogic);
    this.remoteBot.on("kicked", (info) => {
      if (this.psOpts.disconnectAllOnEnd) this.remoteClientDisconnect(info);
    });
    this.remoteClient.on("login", () => {
      this._remoteIsConnected = true;
    });
  }

  public beginBotLogic = (): void => {
    if (this.remoteBot == null) throw Error("Bot logic called when bot does not exist!");
    this.emit("botStartup" as any, this.remoteBot, this.psOpts);
  };

  public endBotLogic = (): void => {
    if (this.remoteBot == null) throw Error("Bot logic called when bot does not exist!");
    this.emit("botShutdown" as any, this.remoteBot, this.psOpts);
  };

  private readonly loginHandler = (actualUser: ServerClient) => {
    this.emit("playerConnected" as any, actualUser, this.isProxyConnected());
    actualUser.once("end", () => this.emit("playerDisconnected" as any, actualUser));

    this.cmdHandler.updateClientCmds(actualUser as unknown as ProxyClient);
    if (this.isProxyConnected()) this.whileConnectedLoginHandler(actualUser);
    else this.notConnectedLoginHandler(actualUser);
  };

  private readonly remoteClientDisconnect = async (info: string | Error) => {
    if (this.controllingPlayer != null) this.controllingPlayer.end("Connection reset by server.");
    this.endBotLogic();
    if (info instanceof Error) {
      this.emit("remoteError" as any, info);
      this.closeConnections("Connection reset by server.", true, `Javascript Error: ${info}`);
    } else {
      this.emit("remoteKick" as any, info);
      this.closeConnections("Connection reset by server.", true, info);
    }
  };

  private readonly closeConnections = (closeReason: string, closeRemote = false, additional?: string) => {
    const reason = additional ? closeReason + additional : closeReason;

    this.emit("closingConnections" as any, reason);

    Object.keys(this._rawServer.clients).forEach((clientId) => {
      this._rawServer.clients[Number(clientId)].end(reason);
    });

    if (closeRemote) {
      this._conn?.disconnect();
      this._remoteIsConnected = false;
      this._conn = null;

      if (this.psOpts.restartOnDisconnect && !this.manuallyStopped) {
        this.restart(1000);
      }
    }
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
      actualUser.end(this.psOpts.security?.kickMessage ?? "You are not in the whitelist");
      return;
    }

    const allowedToControl = this.lsOpts["online-mode"]
      ? this.remoteClient?.uuid === actualUser.uuid
      : this.remoteClient?.username === actualUser.username;

    if (!allowedToControl) {
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

  public isUserWhitelisted = (user: ServerClient): boolean => {
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
    client: Client | ServerClient,
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
