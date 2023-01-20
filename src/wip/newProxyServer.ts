import { Client, Conn, ConnOptions, PacketMiddleware, SimplePositionTransformer } from "@rob9315/mcproxy";
import { EventEmitter } from "events";
import { createServer, PacketMeta, Server, ServerClient } from "minecraft-protocol";
import type { Bot } from "mineflayer";
import { BotOptions } from "mineflayer";
import { ChatMessage as AgnogChMsg } from "prismarine-chat";
import merge from "ts-deepmerge";
import { Vec3 } from "vec3";
import { AntiAFKServer, StrictAntiAFKEvents } from "../impls/antiAfkServer";
import { sleep } from "../util/index";
import { FakePlayer, FakeSpectator } from "./fakes";
import { DefaultProxyOpts, ProxyInspectorOptions } from "./utils";
import { WorldManager } from "./worldManager";

// TODO: agnostic this.
const ChatMessage: typeof AgnogChMsg = require("prismarine-chat")("1.12.2");

/**
 * Functions as a wrapper for {@linkcode ProxyInspector} on {@linkcode Bot} class.
 */
export class BotProxyUtil extends EventEmitter {
  constructor(public readonly pi: ProxyInspector) {
    super();
  }

  public botHasControl(): boolean {
    return !this.pi.proxy?.pclient;
  }

  public message(
    client: Client | ServerClient,
    message: string,
    prefix?: boolean,
    allowFormatting?: boolean,
    position?: number
  ) {
    this.pi.message(client, message, prefix, allowFormatting, position);
  }

  broadcastMessage(message: string, prefix?: boolean, allowFormatting?: boolean, position?: number) {
    this.pi.broadcastMessage(message, prefix, allowFormatting, position);
  }
}

export interface ProxyInspectorEvents extends StrictAntiAFKEvents {
  clientChatRaw: (pclient: Client, message: string) => void;
  clientChat: (pclient: Client, message: string) => void;
  clientConnect: (client: ServerClient) => void;
  clientDisconnect: (client: ServerClient) => void;
}

export class ProxyInspector extends AntiAFKServer<ProxyInspectorOptions, ProxyInspectorEvents> {
  public static readonly blockedPacketsWhenNotInControl: string[] = ["entity_metadata", "abilities", "position"];

  public proxyChatPrefix: string = "§6P >>§r";

  public worldManager: WorldManager | null = null;
  public fakeSpectator: FakeSpectator | null = null;
  public fakePlayer: FakePlayer | null = null;

  public constructor(
    onlineMode: boolean,
    rawServer: Server,
    bOpts: BotOptions,
    cOpts: Partial<ConnOptions> = {},
    pOpts: Partial<ProxyInspectorOptions> = {}
  ) {
    super(onlineMode, rawServer, bOpts, cOpts, pOpts);
    this.psOpts = merge(DefaultProxyOpts, this.psOpts);
    this.loadCmds();
  }

  public static wrapServer1(
    online: boolean,
    server: Server,
    bOpts: BotOptions,
    cOpts: Partial<ConnOptions> = {},
    psOptions: Partial<ProxyInspectorOptions> = {}
  ): ProxyInspector {
    return new ProxyInspector(online, server, bOpts, cOpts, psOptions);
  }

  // ======================= //
  //     internal utils      //
  // ======================= //

  public override start(): Conn {
    if (this.isProxyConnected()) return this.proxy!;
    super.start();
    this.registerProxy(this._proxy!);
    return this._proxy!;
  }

  public override stop() {
    if (!this.isProxyConnected()) return;
    this.removeProxy(this._proxy!);
    super.stop();
  }

  botIsInControl() {
    return !this._proxy?.pclient;
  }

  printHelp(client: Client | ServerClient) {
    this.message(client, "---------- Proxy Commands: ------------- ", false);
    this.message(client, "§6/c [msg]:§r Send a message to all other connected clients", false);
    this.message(client, "§6/link:§r Links to the proxy if no one else is linked", false);
    this.message(client, "§6/unlink:§r Unlink and put into spectator mode", false);
    this.message(client, "§6/view:§r Connect to the view connected person's view", false);
    this.message(client, "§6/unview:§r Disconnect from the view", false);
    this.message(client, "§6/tp:§r Tp the spectator to the current proxy", false);
    this.message(client, "§6/phelp:§r This message", false);
  }

  makeViewFakePlayer(client: ServerClient | Client) {
    // if (!this._proxy?.pclient) return
    if (client === this._proxy?.pclient) {
      this.message(client, `Cannot get into the view. You are controlling the bot`);
      return;
    }
    return this.fakeSpectator?.makeViewingBotPov(client);
  }

  makeViewNormal(client: ServerClient | Client) {
    // if (!this._proxy?.pclient) return false
    if (client === this._proxy?.pclient) {
      this.message(client, "Cannot get out off the view. You are controlling the bot");
      return;
    }
    return this.fakeSpectator?.revertPov(client) ?? false;
  }

  link(client: ServerClient | Client) {
    if (!this._proxy) return;
    if (client === this._proxy.pclient) {
      this.message(client, "Already in control cannot link!");
      return;
    }

    if (!this._proxy.pclient) {
      this.message(client, "Linking");
      this._proxy.link(client as unknown as Client);
      this.fakeSpectator?.revertPov(client);
      this.fakePlayer?.unregister(client as unknown as ServerClient);
      this.fakeSpectator?.revertToNormal(client as unknown as ServerClient);
      this._controllingPlayer = client as unknown as ServerClient;
    } else {
      const mes = `Cannot link. User §3${this._proxy.pclient.username}:§r is linked.`;
      this.message(client, mes);
    }
  }

  unlink(client: Client | ServerClient | null) {
    if (!this._proxy) return;
    if (client) {
      if (client !== this._proxy.pclient) {
        this.message(client, "Cannot unlink as not in control!");
        return;
      }
      this.fakePlayer?.register(client as unknown as ServerClient);
      this.fakeSpectator?.makeSpectator(client as unknown as ServerClient);
      this.message(client, "Unlinking");
    }
    this._proxy.unlink();
    if (!this._controllingPlayer && !this.botIsInControl()) {
      this.beginBotLogic();
    }
  }

  // ======================= //
  //     server utils        //
  // ======================= //

  private buildFakeData() {
    if (!this._proxy) return;
    this.fakePlayer = new FakePlayer(this._proxy.stateData.bot as any, {
      username: this._proxy.stateData.bot.username,
      uuid: this._proxy.stateData.bot._client.uuid,
      positionTransformer: this._proxy.positionTransformer,
    });

    this.fakeSpectator = new FakeSpectator(this._proxy.stateData.bot as any, {
      positionTransformer: this._proxy.positionTransformer,
    });

    this._proxy.stateData.bot.once("end", () => {
      this.fakePlayer?.destroy();
      if (this.psOpts.disconnectAllOnEnd) {
        this.closeConnections();
      }
    });
  }


  public registerProxy(conn: Conn) {
    conn.toClientDefaultMiddleware = [...this.genToClientMiddleware(), ...(conn.toClientDefaultMiddleware || [])];
    conn.toServerDefaultMiddleware = [...this.genToServerMiddleware(), ...(conn.toServerDefaultMiddleware || [])];
    this._proxy = conn;

    if (this._proxy.stateData.bot.entity) {
      this.buildFakeData();
    } else {
      this._proxy.stateData.bot.once("login", () => {
        this.buildFakeData();
      });
    }
  }

  public removeProxy(conn: Conn) {
    const clientMiddle = this.genToClientMiddleware();
    const serverMiddle = this.genToServerMiddleware();
    if (conn.toClientDefaultMiddleware) {
      conn.toClientDefaultMiddleware = conn.toClientDefaultMiddleware.filter((m) => !clientMiddle.includes(m));
    }

    if (conn.toServerDefaultMiddleware) {
      conn.toServerDefaultMiddleware = conn.toServerDefaultMiddleware.filter((m) => !serverMiddle.includes(m));
    }

    this.fakePlayer = null;
    this.fakeSpectator = null;
  }

  // ======================= //
  //        bot utils        //
  // ======================= //

  private genToClientMiddleware() {
    const inspector_toClientMiddleware: PacketMiddleware = ({ meta, isCanceled, bound }) => {
      // console.log(meta, data)
      if (!this._proxy || isCanceled || bound !== "client") return;
      if (this.botIsInControl() && ProxyInspector.blockedPacketsWhenNotInControl.includes(meta.name)) {
        return;
      }
    };

    const inspector_toClientFakePlayerSync: PacketMiddleware = ({ isCanceled, pclient, data, meta }) => {
      if (isCanceled || pclient === this._proxy?.pclient) return;
      if (!this._proxy) return;
      if (data.collectorEntityId === this._proxy.stateData.bot.entity.id) {
        switch (meta.name) {
          case "collect":
            data.collectorEntityId = FakePlayer.fakePlayerId;
            break;
          case "entity_metadata":
            data.entityId = FakePlayer.fakePlayerId;
            break;
          case "entity_update_attributes":
            data.entityId = FakePlayer.fakePlayerId;
            break;
          case "entity_velocity":
            data.entityId = FakePlayer.fakePlayerId;
            break;
        }
      }
      if (data.entityId === this.remoteBot.entity.id) {
        switch (meta.name) {
          case "entity_velocity":
            data.entityId = FakePlayer.fakePlayerId;
            return false; // can't sim, so might as well ignore for now.
        }
      }
      return data;
    };

    const inspector_toClientMiddlewareRecipesFix: PacketMiddleware = ({ meta, data, bound, isCanceled }) => {
      if (isCanceled) return;
      if (bound !== "client") return;
      if (meta.name === "unlock_recipes") {
        return;
      }
    };

    return [inspector_toClientMiddleware, inspector_toClientFakePlayerSync, inspector_toClientMiddlewareRecipesFix];
  }

  private genToServerMiddleware() {
    const inspector_toServerMiddleware: PacketMiddleware = ({ meta, pclient, data, isCanceled }) => {
      if (!this._proxy || !pclient) return;
      if (meta.name.includes("position") || meta.name.includes("look")) return;
      // console.log(meta, data)
      switch (meta.name) {
        case "use_entity":
       
          if (!this.fakeSpectator?.clientsInCamera[pclient.uuid]) return data;
          if (!this.fakeSpectator.clientsInCamera[pclient.uuid].status && data.target === FakePlayer.fakePlayerId) {
            if (data.mouse === 0 || data.mouse === 1) {
              this.fakeSpectator.makeViewingBotPov(pclient);
              return;
            }
          }
          break;
      }
      return;
    };

    return [inspector_toServerMiddleware];
  }

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
    if (!allowFormatting) {
      const r = /§./;
      while (r.test(message)) {
        message = message.replace(r, "");
      }
    }
    if (prefix) {
      message = `${this.proxyChatPrefix} ${message}`;
    }
    this.sendMessage(client, message, position);
  }

  sendMessage(client: ServerClient | Client, message: string, position: number = 1) {
    const messageObj = new ChatMessage(message);
    client.write("chat", { message: messageObj.json.toString(), position });
  }

  broadcastMessage(message: string, prefix?: boolean, allowFormatting?: boolean, position?: number) {
    Object.values(this.server.clients).forEach((c) => {
      this.message(c, message, prefix, allowFormatting, position);
    });
  }

  attach(
    client: ServerClient | Client,
    options: {
      toClientMiddleware?: PacketMiddleware[];
      toServerMiddleware?: PacketMiddleware[];
    } = {}
  ) {
    if (!this._proxy) return;
    this._proxy.attach(client as unknown as Client, options);
  }

  async sendPackets(client: Client) {
    // this._proxy?.sendPackets(client as unknown as Client)
    while (!this._proxy?.stateData.bot?.player) {
      await sleep(100);
    }
    this._proxy.sendPackets(client);
  }

  protected override async whileConnectedLoginHandler(client: ServerClient) {
    if (!this.isUserWhiteListed(client)) {
      const { address, family, port } = {
        address: "unknown",
        family: "unknown",
        port: "unknown",
        ...client.socket.address(),
      };
      console.warn(`${client.username} is not in the whitelist, kicking (${address}, ${family}, ${port})`);
      client.end(this.psOpts.security?.kickMessage ?? "You are not in the whitelist");
      return;
    }

    if (this.psOpts.logPlayerJoinLeave) {
      console.info(`Player ${client.username} joined the proxy`);
    }

    if (this.worldManager) {
      const managedPlayer = this.worldManager.newManagedPlayer(client, this._proxy!.stateData.bot.entity.position);
      managedPlayer.loadedChunks = this._proxy!.stateData.bot.world.getColumns().map(
        ({ chunkX, chunkZ }: { chunkX: number; chunkZ: number }) => new Vec3(chunkX * 16, 0, chunkZ * 16)
      );
      this._proxy!.stateData.bot.on("spawn", () => {
        managedPlayer.positionReference = this._proxy!.stateData.bot.entity.position;
      });
      this.attach(client, {
        toClientMiddleware: [...managedPlayer.getMiddlewareToClient()],
      });
    } else {
      this.attach(client);
    }
    await this.sendPackets(client as unknown as Client);

    const connect = this.psOpts.linkOnConnect && !this._proxy?.pclient;
    this.broadcastMessage(
      `User §3${client.username}§r logged in. ${connect ? "He is in control" : "He is not in control"}`
    );
    this.printHelp(client);

    if (!this._proxy?.pclient) {
      if (!this.botIsInControl()) {
        this.beginBotLogic();
      }
    }

    if (!connect) {
      this.fakePlayer!.register(client);
      this.fakeSpectator.register(client);
      // this.fakeSpectator!.clientsInCamera[client.uuid] = {status: false, cleanup: () => {}};
      this.fakeSpectator!.makeSpectator(client);
    } else {
      this.link(client);
    }

    client.once("end", () => {
      if (client.uuid === this._proxy?.pclient?.uuid) {
        this.beginBotLogic();
      }
      this.fakePlayer?.unregister(client);
      this.fakeSpectator?.clientsInCamera[client.uuid]?.cleanup();
      this.fakeSpectator.register(client);
      // this.fakeSpectator!.clientsInCamera[client.uuid] = {status: false, cleanup: () => {}};
      this.unlink(client);
      this.emit("clientDisconnect", client);
      this.broadcastMessage(`${this.proxyChatPrefix} User §3${client.username}:§r disconnected`);
      if (this.psOpts.logPlayerJoinLeave) {
        console.info(`Player ${client.username} disconnected from the proxy`);
      }
    });

    this.emit("clientConnect", client);
  }

  protected loadCmds() {
    this.cmdHandler.loadDisconnectedCommands({
      start: this.start
    });

    this.cmdHandler.loadProxyCommands({
      default: (client) => this.printHelp(client),
      phelp: (client) => this.printHelp(client),
      link: (client) => this.link(client),
      unlink: (client) => this.unlink(client),
      c: (client, ...args) => this.broadcastMessage(`[${client.username}] ${args.join(" ")}`),

      stopbot: (client) => {
        if (!this.botIsInControl()) return this.message(client, "Bot is not running.");
        this.endBotLogic();
      },
      startbot: (client) => {
        if (this.botIsInControl()) return this.message(client, "Bot is already in control.");
        this.beginBotLogic();
      },

      view: (client) => {
        const res0 = this.makeViewFakePlayer(client);
        if (res0) this.message(client, "Connecting to view. Type /unview to exit");
      },

      unview: (client) => {
        const res1 = this.makeViewNormal(client);
        if (res1) this.message(client, "Disconnecting from view. Type /view to connect");
      },

      tp: (client, ...args) => {
        if (client.uuid === this._proxy?.pclient?.uuid) {
          this.message(client, `Cannot tp. You are controlling the bot.`);
          return;
        }
        if (args.length !== 0) {
          this.proxy.write("chat", {message: ["/tp", ...args].join(" ")})
          return;
        }
        this.fakeSpectator?.revertPov(client);
        this.fakeSpectator?.tpToOrigin(client);
      },

      viewdistance: (client, ...args) => {
        if (!this.worldManager) {
          this.message(client, "World caching not enabled");
          return;
        }
        if (args[0] === "disable") {
          this.message(client, "Disabling extended render distance");
          this.worldManager.disableClientExtension(client);
          return;
        }
        let chunkViewDistance = Number(args[0]);
        if (isNaN(chunkViewDistance)) {
          chunkViewDistance = 20;
        }
        this.message(client, `Setting player view distance to ${chunkViewDistance}`, true, true);
        this.worldManager.setClientView(client, chunkViewDistance);
      },

      reloadchunks: (client) => {
        if (!this.worldManager) {
          this.message(client, "World caching not enabled");
          return;
        }
        this.message(client, "Reloading chunks", true, true);
        this.worldManager.reloadClientChunks(client, 2);
      },

    });
  }
}
