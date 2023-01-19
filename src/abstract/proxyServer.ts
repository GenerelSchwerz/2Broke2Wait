// import { Conn } from "@rob9315/mcproxy";
// import { ConstructorOptions, EventEmitter2 } from "eventemitter2";
// import {
//   Client, createServer, PacketMeta, Server, ServerClient, ServerOptions
// } from "minecraft-protocol";
import merge from "ts-deepmerge";

import type { Bot, BotOptions } from "mineflayer";
import { ServerClient, Client, Server, PacketMeta } from "minecraft-protocol";
import StrictEventEmitter from "strict-event-emitter-types";
import { sleep } from "../util/index";
import { ClientEventRegister, ServerEventRegister } from "./eventRegisters";
import { Conn, ConnOptions, PacketMiddleware} from "@rob9315/mcproxy";
import EventEmitter2, { ConstructorOptions } from "eventemitter2";
import { TypedEventEmitter } from "../util/utilTypes";


/**
 * Interface for the ProxyServer options.
 */
export interface IProxyServerOpts {
  whitelist?: string[] | ((username: string) => boolean);
  restartOnDisconnect: boolean;
}

export interface IProxyServerEvents {
  remoteKick: (reason: string) => void;
  remoteError: (error: Error) => void;
  closedConnections: (reason: string) => void;
  started: (conn: Conn) => void;
}

/**
 * This proxy server provides a wrapper around the connection to the remote server and
 * the local server that players can connect to.
 */
export abstract class ProxyServer<
  T extends IProxyServerOpts = IProxyServerOpts,
  Events extends IProxyServerEvents = IProxyServerEvents
> extends TypedEventEmitter<Events> {
  public readonly server: Server;

  private _registeredClientListeners: Set<string> = new Set();
  private _runningClientListeners: ClientEventRegister<Bot | Client, any>[] =
    [];

  private _registeredServerListeners: Set<string> = new Set();
  private _runningServerListeners: ServerEventRegister<any, any>[] = [];

  /**
   * flag to reuse the internal server instance across proxy servers.
   *
   * This is handled by
   *  {@link } and
   *  {@link }.
   */
  public readonly reuseServer: boolean = true;

  //   private _registeredClientListeners: Set<string> = new Set();
  //   private _runningClientListeners: ClientEventRegister<Bot | Client, any>[] = [];

  //   private _registeredServerListeners: Set<string> = new Set();
  //   private _runningServerListeners: ServerEventRegister<any>[] = [];

  /**
   * Proxy instance. see Rob's proxy. {@link Conn}
   */
  protected _proxy: Conn | null;
 
  protected _bOpts: BotOptions;

  public get bOpts() {
    return this._bOpts;
  }

  /**
   * Proxy instance. see Rob's proxy. {@link Conn}
   */
  public get proxy() {
    return this._proxy;
  }

  /**
   * Internal bot connected to remote server. Created by {@link ProxyServer.proxy | ProxyServer's proxy.}
   */
  public get remoteBot() {
    return this._proxy?.stateData.bot;
  }

  /**
   * Internal mc protocol client connected to remote server. Created by {@link ProxyServer.proxy | ProxyServer's proxy.}
   */
  public get remoteClient() {
    return this._proxy?.stateData.bot._client;
  }

  /**
   * Whether or not the proxy is currently connected to the server.
   */
  protected _remoteIsConnected: boolean = false;

  /**
   * Potential player that controls the remoteBot.
   */
  protected _controllingPlayer: ServerClient | null = null;

  /**
   * Getter for {@link ProxyServer._controllingPlayer}
   */
  public get controllingPlayer() {
    return this._controllingPlayer;
  }

  /**
   * Flag to check whether or not internal server is online.
   */
  public readonly onlineMode: boolean;

  /**
   * Checks if there is a player connected to the local server controlling the remote bot.
   * @returns {boolean} Whether there is a player controlling the remote client or not.
   */
  public isPlayerConnected() {
    return this._controllingPlayer !== null;
  }

  public isProxyConnected(): boolean {
    return this._remoteIsConnected;
  }

  public psOpts: T;

  private boundGoodCmds
  private boundBadCmds;
  private boundGoodLogin;
  private boundBadLogin;

  /**
   * Hidden constructor. Use static methods.
   * @param {boolean} onlineMode Whether the server is online or not.
   * @param {Server} server Internal minecraft-protocol server.
   * @param {BotOptions} bOpts mineflayer bot options.
   * @param {Partial<ConnOptions>} cOpts Connection options to the server.
   * @param {Partial<IProxyServerOpts>} opts Options for ProxyServer.
   */
  protected constructor(
    onlineMode: boolean,
    server: Server,
    bOpts: BotOptions,
    cOpts: Partial<ConnOptions> = {},
    opts: Partial<T> = {}
  ) {
    super({ wildcard: true });
    this.onlineMode = onlineMode;
    this.server = server;

    // TODO: somehow make this type-safe.
    this.psOpts = merge.withOptions(
      { mergeArrays: false },
      <IProxyServerOpts>{ whitelist: [], restartOnDisconnect: false },
      opts
    ) as any;

    this._bOpts = bOpts;
    this.boundGoodLogin = this.whileConnectedLoginHandler.bind(this);
    this.boundGoodCmds =  this.whileConnectedCommandHandler.bind(this);
    this.boundBadCmds = this.notConnectedCommandHandler.bind(this);
    this.boundBadLogin = this.notConnectedLoginHandler.bind(this);
  }

  /**
   * Function to handle any additional options for the config.
   *
   * I.E. checking if plugins necessary for options are available.
   */
  protected abstract optionValidation(): T;

  /**
   * Function to call on initialization of the bot.
   *
   * Note: this is called before {@link ProxyServer.optionValidation | option validation}.
   */
  protected initialBotSetup(bot: Bot): void {}

  /**
   * Helper method when {@link ProxyServer["_controllingPlayer"] | the controlling player} disconnects.
   *
   * Begin certain bot logic here.
   *
   * Note: Workaround, we make this a function instead of anonymous. We just bind.
   */
  protected abstract beginBotLogic: () => void;

  /**
   * Helper method when {@link ProxyServer._controllingPlayer | the controlling player} connects/reconnects.
   *
   * End certain bot logic here.
   *
   * Note: Workaround, we make this a function instead of anonymous. We just bind.
   */
  protected abstract endBotLogic: () => void;

  public setupProxy(): void {
    this.initialBotSetup(this.remoteBot!);
    this.optionValidation();

    this.remoteClient!.on("end", this.remoteClientDisconnect);
    this.remoteClient!.on("error", this.remoteClientDisconnect);
    this.remoteClient!.on("login", () => {
      this._remoteIsConnected = true;
    });
    this.remoteBot!.once("spawn", this.beginBotLogic);
  }

  /**
   * Function to filter out some packets that would make us disconnect otherwise.
   *
   * Note: This is where you could filter out packets with sign data to prevent chunk bans.
   * @param {any} data data from the server
   * @param {PacketMeta} meta metadata name of the packet
   * @param {Client} dest ServerClient to proxy data to.
   */
  protected proxyPacketToDest(data, meta: PacketMeta, dest: Client) {
    if (meta.name !== "keep_alive" && meta.name !== "update_time") {
      //keep alive packets are handled by the client we created,
      // so if we were to forward them, the minecraft client would respond too
      // and the server would kick us for responding twice.
      dest.writeRaw(data);
    }
  }

  /**
   * Handler for when the remote client disconnects from remote server.
   *
   * Usually, we do not know the reason. So for now, we emit an event.
   * @param {string | Error} info reason of disconnect.
   */
  private remoteClientDisconnect = async (info: string | Error) => {
    if (this._controllingPlayer) {
      this._controllingPlayer.end("Connectiofn reset by 2b2t server.");
    }
    this.endBotLogic();
    this.convertToDisconnected();
    this._controllingPlayer = null;
    this._remoteIsConnected = false;
    if (info instanceof Error) {
      this.emit("remoteError" as any, info);
    } else {
      this.emit("remoteKick" as any, info);
    }
  };

  /**
   * Helper method to determine whether or not the user should be allowed
   * to control the proxy bot.
   *
   * @param {ServerClient} user Local connection to control the bot.
   */
  protected isUserGood(user: ServerClient): boolean {
    if (this.onlineMode) {
      return this.remoteClient?.uuid === user.uuid;
    } else {
      return this.remoteClient?.username === user.username;
    }
  }

  protected isUserWhiteListed(user: ServerClient): boolean {
    if (!this.psOpts.whitelist) return true;
    if (typeof this.psOpts.whitelist === "object") {
      return this.psOpts.whitelist.find((n) => n.toLowerCase() === user.username.toLowerCase()) !== undefined;
    } else if (typeof this.psOpts.whitelist === "function") {
      try {
        return !!this.psOpts.whitelist(user.username);
      } catch (e) {
        console.warn("allowlist callback had error", e);
        return false;
      }
    }
    return false;
  }

  /**
   * Custom version of minecraft-protocol's server close() to give a better message.
   *
   * Note: this also provides cleanup for the remote client and our proxy.
   */
  public closeConnections = (reason: string = "Proxy stopped.") => {
    // close remote bot cleanly.
    this._proxy?.disconnect();


    // disconnect all local clients cleanly.
    Object.keys(this.server.clients).forEach((clientId) => {
      const client: Client = this.server.clients[clientId];
      client.end(reason);
    });

    this.emit("closedConnections" as any, reason);

    // we no longer want to care about this proxy.
    this._proxy = null;
  };

  /**
   * TODO: Add functionality to server (if reused) and remote is not currently connected.
   *
   * @param {ServerClient} actualUser user that just connected to the local server.
   */
  protected whileConnectedLoginHandler(actualUser: ServerClient) {
    console.trace("here");
    if (!this.isUserWhiteListed(actualUser)) {
      actualUser.end(
        "Not whitelisted!\n" + "You need to turn the whitelist off."
      );
      return; // early end.
    }

    if (!this.isUserGood(actualUser)) {
      actualUser.end(
        "Not the same account!\n" +
          "You need to use the same account as the 2b2w."
      );
      return; // early end.
    }

    this._controllingPlayer = actualUser;

    // proxy data.
    // actualUser.on("packet", (packetData, packetMeta, rawBuffer) =>
    //   this.proxyPacketToDest(rawBuffer, packetMeta, this.remoteClient)
    // );

    // set event for when they end.
    actualUser.on("end", (reason) => {
      this._controllingPlayer = null;
      this.beginBotLogic();
    });


    this.endBotLogic();


    this._proxy!.sendPackets(actualUser as any); // works in original?
    this._proxy!.link(actualUser as any); // again works
  
  };

  protected notConnectedLoginHandler = (actualUser: ServerClient) => {
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

  public start() {
    if (this.isProxyConnected()) return this._proxy!;
    this.convertToConnected();
    this._proxy = new Conn(this._bOpts);
    this.setupProxy();
    this.emit("started" as any, this._proxy);
    return this._proxy;
  }

  public stop() {
    if (!this.isProxyConnected()) return;
    this.convertToDisconnected();
    this.closeConnections();
  }

  public async restart(ms: number = 0) {
    this.stop();
    await sleep(ms);
    this.start();
  }

  public convertToConnected() {
    if (this._remoteIsConnected) return;
    // this.server.removeAllListeners("login");
    this.server.on("login", this.boundGoodLogin);
    this.server.on("login", this.boundGoodCmds);
    this.server.off("login", this.boundBadLogin);
    this.server.off("login", this.boundBadCmds);

    for (const client in this.server.clients) {
      this.whileConnectedCommandHandler(this.server.clients[client] as any);
    }
    console.log("TO CONNECTED:", this.server.listeners("login"))
  }

  public convertToDisconnected() {
    // console.trace("here", this._remoteIsConnected);
    if (!this._remoteIsConnected) return;
    // this.server.removeAllListeners("login");
    this.server.on("login", this.boundBadLogin);
    this.server.on("login", this.boundBadCmds);
    this.server.off("login", this.boundGoodLogin);
    this.server.off("login", this.boundGoodCmds);


    for (const client in this.server.clients) {
      this.notConnectedCommandHandler(this.server.clients[client] as any);
    }

    console.log("TO DISCONNECTED:", this.server.listeners("login"))
  }

  protected abstract notConnectedCommandHandler(client: ServerClient): void;

  protected abstract whileConnectedCommandHandler(client: ServerClient): void;

  public registerClientListeners(
    ...listeners: ClientEventRegister<Bot | Client, any>[]
  ) {
    for (const listener of listeners) {
      if (this._registeredClientListeners.has(listener.constructor.name))
        continue;
      this._registeredClientListeners.add(listener.constructor.name);
      listener.begin();
      this._runningClientListeners.push(listener);
    }
  }

  public removeClientListeners(
    ...listeners: ClientEventRegister<Bot | Client, any>[]
  ) {
    for (const listener of listeners) {
      if (!this._registeredClientListeners.has(listener.constructor.name))
        continue;
      this._registeredClientListeners.delete(listener.constructor.name);
      listener.end();
      this._runningClientListeners = this._runningClientListeners.filter(
        (l) => l.constructor.name !== listener.constructor.name
      );
    }
  }

  public removeAllClientListeners() {
    this._registeredClientListeners.clear();
    for (const listener of this._runningClientListeners) {
      listener.end();
    }
    this._runningClientListeners = [];
  }

  public registerServerListeners(
    ...listeners: ServerEventRegister<any, any>[]
  ) {
    for (const listener of listeners) {
      if (this._registeredServerListeners.has(listener.constructor.name))
        continue;
      this._registeredServerListeners.add(listener.constructor.name);
      listener.begin();
      this._runningServerListeners.push(listener);
    }
  }

  public removeServerListeners(...listeners: ServerEventRegister<any, any>[]) {
    for (const listener of listeners) {
      if (!this._registeredServerListeners.has(listener.constructor.name))
        continue;
      this._registeredServerListeners.delete(listener.constructor.name);
      listener.end();
      this._runningServerListeners = this._runningServerListeners.filter(
        (l) => l.constructor.name !== listener.constructor.name
      );
    }
  }

  public removeAllServerListeners() {
    this._registeredServerListeners.clear();
    for (const listener of this._runningServerListeners) {
      listener.end();
    }
    this._runningServerListeners = [];
  }
}
