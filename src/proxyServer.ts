import {
  createServer,
  ServerOptions,
  Server,
  Client,
  ServerClient,
  PacketMeta
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
  antiAFK: boolean;
  stopServerOnError: boolean;
}

/**
 * This proxy server provides a wrapper around the connection to the remote server and
 * the local server that players can connect to.
 */
export class ProxyServer extends EventEmitter {

  /**
   * flag to reuse the internal server instance across proxy servers. 
   * 
   * This is handled by 
   *  {@link ProxyServer.createProxyServer} and 
   *  {@link ProxyServer.ProxyServerReuseServer}.
   */
  public readonly reuseServer: boolean;

  /**
   * Options for the proxy server.
   * This is meant to be extended later.
   */
  public opts: IProxyServerOpts;

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
  private constructor(
    reuseServer: boolean,
    server: Server,
    proxy: Conn,
    opts: Partial<IProxyServerOpts> = {}
  ) {
    super();
    this.reuseServer = reuseServer;
    this.server = server;
    this.proxy = proxy;
    this.remoteBot = proxy.stateData.bot;
    this.remoteClient = proxy.stateData.bot._client;

    this.opts = merge({ whitelist: true, stopServerOnError: true }, opts);
    this.opts.antiAFK = this.opts.antiAFK && !!proxy.stateData.bot.hasPlugin(antiAFK);

    server.on("login", this.serverLoginHandler);

    this.remoteClient.on("end", this.remoteClientDisconnect);
    this.remoteClient.on("error", this.remoteClientDisconnect);
  }

  /**
   * Creates Proxy server based on given arguments.
   * 
   * Does NOT re-use the server.
   * @param {BotOptions} bOptions Mineflayer bot options.
   * @param {Plugin[]} plugins Mineflayer bot plugins to load into the remote bot.
   * @param {ServerOptions} sOptions Minecraft-protocol server options.
   * @param {Partial<IProxyServerOpts>} psOptions Partial list of ProxyServer options.
   * @returns {ProxyServer} Built proxy server.
   */
  public static createProxyServer(
    bOptions: BotOptions,
    plugins: Plugin[],
    sOptions: ServerOptions,
    psOptions: Partial<IProxyServerOpts> = {}
  ): ProxyServer {
    const conn = new Conn(bOptions);
    conn.stateData.bot.loadPlugins(plugins);
    return new ProxyServer(false, createServer(sOptions), conn, psOptions);
  }

  /**
   * Creates Proxy server based on given arguments.
   * 
   * DOES re-use the server.
   * @param {Server} server running Minecraft-protocol server.
   * @param {BotOptions} bOptions Mineflayer bot options.
   * @param {Plugin[]} plugins Mineflayer bot plugins to load into the remote bot.
   * @param {Partial<IProxyServerOpts>} psOptions Partial list of ProxyServer options.
   * @returns {ProxyServer} Built proxy server.
   */
  public static ProxyServerReuseServer(
    server: Server,
    bOptions: BotOptions,
    plugins: Plugin[],
    psOptions: Partial<IProxyServerOpts> = {}
  ): ProxyServer {
    const conn = new Conn(bOptions);
    conn.stateData.bot.loadPlugins(plugins);
    return new ProxyServer(true, server, conn, psOptions);
  }

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
   * Helper method when {@link ProxyServer._controllingPlayer | the controlling player} disconnects.
   * 
   * Begin certain bot logic here.
   */
  protected beginBotLogic() {
    if (this.opts.antiAFK) {
      this.remoteBot.antiafk.start();
    }
  }

  /**
   * Helper method when {@link ProxyServer._controllingPlayer | the controlling player} connects/reconnects.
   * 
   * End certain bot logic here.
   */
  protected endBotLogic() {
    if (this.opts.antiAFK) {
      this.remoteBot.antiafk.stop();
    }
  }

  /**
   * TODO: Add functionality to server (if reused) and remote is not currently connected.
   * 
   * @param {ServerClient} actualUser user that just connected to the local server.
   */
  private serverLoginHandler = async (actualUser: ServerClient) => {
    if (this.opts.whitelist && this.remoteClient.uuid !== actualUser.uuid) {

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
      this.beginBotLogic();
      
    });

    // as player has just connected, end all bot activity and give control back to player.
    this.endBotLogic();

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
