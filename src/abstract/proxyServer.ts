import {
  createServer,
  ServerOptions,
  Server,
  Client,
  ServerClient,
  PacketMeta,
} from "minecraft-protocol";
import merge from "ts-deepmerge";
import { Conn } from "@rob9315/mcproxy";
import { EventEmitter } from "events";

import type { Bot, BotOptions, Plugin } from "mineflayer";
import antiAFK from "@nxg-org/mineflayer-antiafk";

/**
 * Function to filter out some packets that would make us disconnect otherwise.
 *
 * Note: This is where you could filter out packets with sign data to prevent chunk bans.
 * @param {any} data data from the server
 * @param {PacketMeta} meta metadata name of the packet
 * @param {Client} dest ServerClient to proxy data to.
 */
function filterPacketAndSend(data, meta: PacketMeta, dest: Client) {
  if (meta.name !== "keep_alive" && meta.name !== "update_time") {
    //keep alive packets are handled by the client we created,
    // so if we were to forward them, the minecraft client would respond too
    // and the server would kick us for responding twice.
    dest.writeRaw(data);
  }
}

/**
 * Interface for the ProxyServer options.
 */
export interface IProxyServerOpts {
  whitelist: boolean;
  stopServerOnError: boolean;
}

/**
 * This proxy server provides a wrapper around the connection to the remote server and
 * the local server that players can connect to.
 */
export abstract class ProxyServer<T extends IProxyServerOpts> extends EventEmitter {
  /**
   * flag to reuse the internal server instance across proxy servers.
   *
   * This is handled by
   *  {@link createProxyServer} and
   *  {@link ProxyServerReuseServer}.
   */
  public readonly reuseServer: boolean;

  /**
   * Options for the proxy server.
   * This is meant to be extended later.
   */
  public opts: T;

  /**
   * Internal server. Actual server clients connect to.
   * Used to proxy data to and from remote server.
   */
  public readonly server: Server;

  /**
   * Proxy instance. see Rob's proxy. {@link Conn}
   */
  public readonly proxy: Conn;

  /**
   * Internal bot connected to remote server. Created by {@link ProxyServer.proxy | ProxyServer's proxy.}
   */
  public readonly remoteBot: Bot;

  /**
   * Internal mc protocol client connected to remote server. Created by {@link ProxyServer.proxy | ProxyServer's proxy.}
   */
  public readonly remoteClient: Client;

  /**
   * Potential player that controls the remoteBot.
   */
  private _controllingPlayer: ServerClient | null;

  /**
   * Getter for {@link ProxyServer._controllingPlayer}
   */
  public get connectedPlayer() {
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

  /**
   * Hidden constructor. Use static methods.
   * @param {boolean} reuseServer Whether or not to destroy internal server on close.
   * @param {Server} server Internal minecraft-protocol server.
   * @param {Conn} proxy Proxy connection to remote server.
   * @param {IProxyServerOpts} opts Options for ProxyServer.
   */
  protected constructor(
    reuseServer: boolean,
    onlineMode: boolean,
    server: Server,
    proxy: Conn,
    opts: Partial<T> = {}
  ) {
    super();
    this.reuseServer = reuseServer;
    this.onlineMode = onlineMode;
    console.log(this.onlineMode)
    this.server = server;
    this.proxy = proxy;
    this.remoteBot = proxy.stateData.bot;
    this.remoteClient = proxy.stateData.bot._client;

    // TODO: somehow make this type-safe.
    this.opts = merge({ whitelist: true, stopServerOnError: true }, opts) as any;

 
    this.initialBotSetup(this.remoteBot);
    this.optionValidation();
  
    server.on("login", this.serverLoginHandler);
    this.remoteBot.once("spawn", this.beginBotLogic.bind(this));
    this.remoteClient.on("end", this.remoteClientDisconnect);
    this.remoteClient.on("error", this.remoteClientDisconnect);
  }

  /**
   * Function to handle any additional options for the config.
   * I.E. checking if plugins necessary for options are available.
   */
  protected abstract optionValidation(): T;

  /**
   * Function to call on initialization of the bot.
   * 
   * Note that this is called BEFORE {@link ProxyServer.optionValidation | option validation}.
   */
  protected initialBotSetup(bot: Bot): void {}


  /**
   * Helper method when {@link ProxyServer._controllingPlayer | the controlling player} disconnects.
   *
   * Begin certain bot logic here.
   * 
   * Note: Workaround, we make this a function instead of anonymous. We just bind.
   */
  protected abstract beginBotLogic(): void;

  /**
   * Helper method when {@link ProxyServer._controllingPlayer | the controlling player} connects/reconnects.
   *
   * End certain bot logic here.
   * 
   * Note: Workaround, we make this a function instead of anonymous. We just bind.
   */
  protected abstract endBotLogic(): void;


  /**
   * Handler for when the remote client disconnects from remote server.
   *
   * Usually, we do not know the reason. So for now, we emit an event.
   * @param {string | Error} info reason of disconnect.
   */
  private remoteClientDisconnect = async (info: string | Error) => {
    if (this._controllingPlayer) {
      this._controllingPlayer.end("Connection reset by 2b2t server.");
    }
    this._controllingPlayer = null;
    this.emit("remoteDisconnect", info);
  };


  /**
   * Helper method to determine whether or not the user should be allowed
   * to control the proxy bot.
   * 
   * @param {ServerClient} user Local connection to control the bot.
   */
  private isUserGood(user: ServerClient): boolean {
    if (this.onlineMode) {
      return this.remoteClient.uuid === user.uuid
    } else {
      return this.remoteClient.username === user.username;
    }

  }

  /**
   * TODO: Add functionality to server (if reused) and remote is not currently connected.
   *
   * @param {ServerClient} actualUser user that just connected to the local server.
   */
  private serverLoginHandler = async (actualUser: ServerClient) => {
    if (!this.isUserGood(actualUser)) {
      // Send disconnect message for why they were kicked.
      actualUser.end(
        "Not whitelisted!\n" +
          "You need to use the same account as 2b2w or turn the whitelist off."
      );
      return; // early end.
    }

    // proxy data.
    actualUser.on("packet", (data, meta, rawData) =>
      filterPacketAndSend(rawData, meta, this.remoteClient)
    );

    // set event for when they end.
    actualUser.on("end", (reason) => {
      this._controllingPlayer = null;
      this.beginBotLogic.bind(this)();
    });

    // as player has just connected, end all bot activity and give control back to player.
    this.endBotLogic.bind(this)();

    this.proxy.sendPackets(actualUser as any); // works in original?
    this.proxy.link(actualUser as any); // again works
    this._controllingPlayer = actualUser;
  };

  /**
   * Custom version of minecraft-protocol's server close() to give a better message.
   *
   * Note: this also provides cleanup for the remote client and our proxy.
   */
  public close(): void {
    // cleanup listeners.
    this.remoteClient.removeListener("end", this.remoteClientDisconnect);
    this.remoteClient.removeListener("error", this.remoteClientDisconnect);

    // close remote bot cleanly.
    this.proxy.disconnect();

    // disconnect all local clients cleanly.
    Object.keys(this.server.clients).forEach((clientId) => {
      const client: Client = this.server.clients[clientId];
      client.end("Proxy stopped.");
    });

    // shutdown actual socket server.
    if (!this.reuseServer) {
      this.server["socketServer"].close();
    }

    this.emit("close");
  }
}
