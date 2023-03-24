import { Client, Conn, ConnOptions, PacketMiddleware, SimplePositionTransformer } from '@rob9315/mcproxy'
import { createServer, PacketMeta, Server, ServerClient } from 'minecraft-protocol'
import { BotOptions } from 'mineflayer'
import { ChatMessage as AgnogChMsg } from 'prismarine-chat'
import merge from 'ts-deepmerge'
import { Vec3 } from 'vec3'
import { AntiAFKServer, StrictAntiAFKEvents } from './antiAfkServer'
import { sleep } from '../util/index'
import { FakePlayer, FakeSpectator } from './spectatorServer/fakes'
import { DefaultProxyOpts, ServerSpectatorOptions } from './spectatorServer/utils'
import { WorldManager } from './spectatorServer/worldManager'

export interface SpectatorServerEvents extends StrictAntiAFKEvents {
  clientChatRaw: (pclient: Client, message: string) => void
  clientChat: (pclient: Client, message: string) => void
  clientConnect: (client: ServerClient) => void
  clientDisconnect: (client: ServerClient) => void
}

export type StrictProxyInspectorEvents = Omit<SpectatorServerEvents, '*'>

export class SpectatorServer extends AntiAFKServer<ServerSpectatorOptions, StrictProxyInspectorEvents> {
  public static readonly blockedPacketsWhenNotInControl: string[] = ['entity_metadata', 'abilities', 'position']

  public proxyChatPrefix: string = '§6P>> §r'

  public worldManager: WorldManager | null = null
  public fakeSpectator: FakeSpectator | null = null
  public fakePlayer: FakePlayer | null = null

  public readonly ChatMessage: typeof AgnogChMsg

  public constructor (
    onlineMode: boolean,
    rawServer: Server,
    bOpts: BotOptions,
    cOpts: Partial<ConnOptions> = {},
    pOpts: Partial<ServerSpectatorOptions> = {}
  ) {
    super(onlineMode, rawServer, bOpts, cOpts, pOpts)
    this.psOpts = merge(DefaultProxyOpts, this.psOpts) as any
    this.loadMiddlewareCmds()
    // TODO: agnostic this.
    this.ChatMessage = require('prismarine-chat')(bOpts.version)

    if (this.psOpts.worldCaching) {
      if (this.cOpts.positionTransformer != null) {
        const positionTransformer =
          this.cOpts.positionTransformer instanceof Vec3
            ? new SimplePositionTransformer(this.cOpts.positionTransformer)
            : this.cOpts.positionTransformer
        this.worldManager = new WorldManager('worlds', { positionTransformer })
      } else {
        this.worldManager = new WorldManager('worlds')
      }
    }
  }

  public static wrapServer (
    online: boolean,
    server: Server,
    bOpts: BotOptions,
    cOpts: Partial<ConnOptions> = {},
    psOptions: Partial<ServerSpectatorOptions> = {}
  ): SpectatorServer {
    return new SpectatorServer(online, server, bOpts, cOpts, psOptions)
  }

  // ======================= //
  //     internal utils      //
  // ======================= //

  public override start (): Conn {
    if (this.isProxyConnected()) return this.proxy as Conn
    const conn = super.start()
    this.setupMiddleware()
    return conn
  }

  botIsInControl () {
    return this._proxy?.pclient == null
  }

  makeViewFakePlayer (client: ServerClient | Client) {
    if (client === this._proxy?.pclient) {
      this.message(client, 'Cannot get into the view. You are controlling the bot')
      return
    }
    if (!this.fakeSpectator) return false;
    this.fakeSpectator.register(client);
    return this.fakeSpectator.makeViewingBotPov(client) 
  }

  makeViewNormal (client: ServerClient | Client) {
    if (client === this._proxy?.pclient) {
      this.message(client, 'Cannot get out off the view. You are controlling the bot')
      return
    }
    return this.fakeSpectator?.revertPov(client) ?? false
  }

  link (client: ServerClient | Client) {
    if (this._proxy == null) return
    if (client === this._proxy.pclient) {
      this.message(client, 'Already in control, cannot link!')
      return
    }

    if (this._proxy.pclient == null) {
      this.message(client, 'Linking')

      this.fakeSpectator?.revertPov(client)
      this.fakePlayer?.unregister(client as unknown as ServerClient)
      this.fakeSpectator?.revertToNormal(client as unknown as ServerClient)
      this._proxy.link(client as unknown as Client)
      this._controllingPlayer = client as unknown as ServerClient
      this.endBotLogic()
    } else {
      const mes = `Cannot link. User §3${this._proxy.pclient.username}:§r is linked.`
      this.message(client, mes)
    }
  }

  unlink (client: Client | ServerClient | null) {
    if (this._proxy == null) return
    if (client != null) {
      if (client !== this._proxy.pclient) {
        this.message(client, 'Cannot unlink as not in control!')
        return
      }
      this._controllingPlayer = null
      this.fakePlayer?.register(client as unknown as ServerClient)
      this.fakeSpectator?.makeSpectator(client as unknown as ServerClient)
      this.message(client, 'Unlinking')
    }
    this._proxy.unlink()
    this.beginBotLogic()
  }

  public attach (
    client: ServerClient | Client,
    options: {
      toClientMiddleware?: PacketMiddleware[]
      toServerMiddleware?: PacketMiddleware[]
    } = {}
  ) {
    if (this._proxy == null) return
    this._proxy.attach(client as unknown as Client, options)
  }

  public async sendPackets (client: Client) {
    while (this._proxy?.stateData.bot?.player == null) {
      await sleep(100)
    }
    this._proxy.sendPackets(client)
  }

  // ======================= //
  //     server utils        //
  // ======================= //

  private buildFakeData () {
    if (this._proxy == null) return
    this.fakePlayer = new FakePlayer(this._proxy.stateData.bot as any, {
      username: this._proxy.stateData.bot.username,
      uuid: this._proxy.stateData.bot._client.uuid,
      positionTransformer: this._proxy.positionTransformer
    })

    this.fakeSpectator = new FakeSpectator(this._proxy.stateData.bot as any, {
      positionTransformer: this._proxy.positionTransformer
    })

    this._proxy.stateData.bot.once('end', () => {
      this.fakePlayer?.destroy()
    })
  }

  public setupMiddleware () {
    if (this._proxy == null) return
    const data = this._proxy.toClientDefaultMiddleware != null ? this._proxy.toClientDefaultMiddleware : []
    const data1 = this._proxy.toServerDefaultMiddleware != null ? this._proxy.toServerDefaultMiddleware : []
    this._proxy.toClientDefaultMiddleware = [...this.genToClientMiddleware(), ...data]
    this._proxy.toServerDefaultMiddleware = [...this.genToServerMiddleware(), ...data1]
    if (this._proxy.stateData.bot.entity) {
      this.buildFakeData()
    } else {
      this._proxy.stateData.bot.once('login', () => {
        this.buildFakeData()
      })
    }
  }

  protected override whileConnectedLoginHandler = async (client: ServerClient) => {
    if (this.remoteBot == null) return
    if (!this.isUserWhitelisted(client)) {
      const { address, family, port } = {
        address: 'unknown',
        family: 'unknown',
        port: 'unknown',
        ...client.socket.address()
      }
      console.warn(`${client.username} is not in the whitelist, kicking (${address}, ${family}, ${port})`)
      client.end(this.psOpts.security?.kickMessage ?? 'You are not in the whitelist')
      return
    }

    if (this.psOpts.logPlayerJoinLeave) {
      console.info(`Player ${client.username} joined the proxy`)
    }

    if (this.worldManager != null) {
      const managedPlayer = this.worldManager.newManagedPlayer(client, this.remoteBot.entity.position)
      managedPlayer.loadedChunks = this.remoteBot.world
        .getColumns()
        .map(({ chunkX, chunkZ }: { chunkX: number, chunkZ: number }) => new Vec3(chunkX * 16, 0, chunkZ * 16))
      this.remoteBot.on('spawn', () => {
        managedPlayer.positionReference = this.remoteBot!.entity.position
      })
      this.attach(client, { toClientMiddleware: [...managedPlayer.getMiddlewareToClient()] })
    } else {
      this.attach(client)
    }
    await this.sendPackets(client as unknown as Client)

    const connect = this.psOpts.linkOnConnect && this._proxy?.pclient == null
    this.broadcastMessage(
      `User §3${client.username}§r logged in. ${connect ? 'He is in control.' : 'He is not in control.'}`
    )
    this.printHelp(client)

    if (!connect) {
      this.fakePlayer!.register(client)
      this.fakeSpectator!.register(client)
      this.fakeSpectator!.makeSpectator(client)
    } else {
      this.link(client)
    }

    client.once('end', () => {
      if (client.uuid === this._proxy?.pclient?.uuid) {
        this.beginBotLogic()
      }
      this.fakePlayer?.unregister(client)
      this.fakeSpectator?.unregister(client)
      this.unlink(client)
      this.emit('clientDisconnect', client)
      this.broadcastMessage(`${this.proxyChatPrefix} User §3${client.username}:§r disconnected`)
      if (this.psOpts.logPlayerJoinLeave) {
        console.info(`Player ${client.username} disconnected from the proxy`)
      }
    })

    if (this._proxy?.pclient == null) {
      if (!this.botIsInControl()) {
        this.beginBotLogic()
      }
    }

    this.emit('clientConnect', client)
  }

  protected loadMiddlewareCmds () {
    this.cmdHandler.loadDisconnectedCommands({
      start: this.start
    })

    this.cmdHandler.loadProxyCommands({
      default: this.printHelp,
      phelp: this.printHelp,
      link: this.link,
      unlink: this.unlink,
      c: (client, ...args) => this.broadcastMessage(`[${client.username}] ${args.join(' ')}`),

      stopbot: (client) => {
        if (!this.botIsInControl()) return this.message(client, 'Bot is not running.')
        this.endBotLogic()
      },
      startbot: (client) => {
        if (this.botIsInControl()) return this.message(client, 'Bot is already in control.')
        this.beginBotLogic()
      },

      view: (client) => {
        const res0 = this.makeViewFakePlayer(client)
        if (res0) this.message(client, 'Connecting to view. Type /unview to exit')
      },

      unview: (client) => {
        const res1 = this.makeViewNormal(client)
        if (res1) this.message(client, 'Disconnecting from view. Type /view to connect')
      },

      tpto: (client, ...args) => {
        if (client.uuid === this._proxy?.pclient?.uuid) {
          this.message(client, 'Cannot tp. You are controlling the bot.')
          return
        }

        if (this.fakeSpectator?.clientsInCamera[client.uuid].status) {
          this.message(client, `You are viewing the bot's perspective.`)
        }

        this.fakeSpectator?.revertPov(client)
        this.fakeSpectator?.tpToFakePlayer(client)
      }

      // removed due to issue with prismarine-world storage.
      // viewdistance: (client, ...args) => {
      //   if (!this.worldManager) {
      //     this.message(client, "World caching not enabled");
      //     return;
      //   }
      //   if (args[0] === "disable") {
      //     this.message(client, "Disabling extended render distance");
      //     this.worldManager.disableClientExtension(client);
      //     return;
      //   }
      //   let chunkViewDistance = Number(args[0]);
      //   if (isNaN(chunkViewDistance)) {
      //     chunkViewDistance = 20;
      //   }
      //   this.message(client, `Setting player view distance to ${chunkViewDistance}`, true, true);
      //   this.worldManager.setClientView(client, chunkViewDistance);
      // },

      // reloadchunks: (client) => {
      //   if (!this.worldManager) {
      //     this.message(client, "World caching not enabled");
      //     return;
      //   }
      //   this.message(client, "Reloading chunks", true, true);
      //   this.worldManager.reloadClientChunks(client, 2);
      // },
    })
  }

  // ======================= //
  //        bot utils        //
  // ======================= //

  private genToClientMiddleware () {
    const inspector_toClientMiddleware: PacketMiddleware = ({ meta, data, isCanceled, bound }) => {
      if (this._proxy == null || isCanceled || bound !== 'client') return
      if (this.botIsInControl() && SpectatorServer.blockedPacketsWhenNotInControl.includes(meta.name)) {

      }
    }

    const inspector_toClientFakePlayerSync: PacketMiddleware = ({ isCanceled, pclient, data, meta }) => {
      if (isCanceled || pclient === this._proxy?.pclient) return
      if (this._proxy == null) return
      if (data.collectorEntityId === this._proxy.stateData.bot.entity?.id) {
        switch (meta.name) {
          case 'collect':
            data.collectorEntityId = FakePlayer.fakePlayerId
            break
          case 'entity_metadata':
            data.entityId = FakePlayer.fakePlayerId
            break
          case 'entity_update_attributes':
            data.entityId = FakePlayer.fakePlayerId
            break
        }
      }
      if (data.entityId === this.remoteBot?.entity?.id) {
        switch (meta.name) {
          case 'entity_velocity':
            data.entityId = FakePlayer.fakePlayerId
            return // can't sim, so might as well ignore for now.
        }
      }
      return data
    }

    const inspector_toClientMiddlewareRecipesFix: PacketMiddleware = ({ meta, data, bound, isCanceled }) => {
      if (isCanceled) return
      if (bound !== 'client') return
      if (meta.name === 'unlock_recipes') {

      }
    }

    return [inspector_toClientMiddleware, inspector_toClientFakePlayerSync, inspector_toClientMiddlewareRecipesFix]
  }

  private genToServerMiddleware () {
    const inspector_toServerMiddleware: PacketMiddleware = ({ meta, pclient, data, isCanceled }) => {
      if (this._proxy == null || pclient == null) return
      // if (meta.name.includes("position") || meta.name.includes("look")) return;
      // console.log("TO SERVER:", meta, data)
      switch (meta.name) {
        case 'use_entity':
          if (this.fakeSpectator?.clientsInCamera[pclient.uuid] == null) return data
          if (!this.fakeSpectator.clientsInCamera[pclient.uuid].status && data.target === FakePlayer.fakePlayerId) {
            if (data.mouse === 0 || data.mouse === 1) {
              this.fakeSpectator.makeViewingBotPov(pclient)
            }
          }
          break
      }
    }

    return [inspector_toServerMiddleware]
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
    if (prefix) message = this.proxyChatPrefix + message
    this.sendMessage(client, message, position)
  }

  sendMessage (client: ServerClient | Client, message: string, position: number = 1) {
    const messageObj = new this.ChatMessage(message)
    client.write('chat', { message: messageObj.json.toString(), position })
  }

  broadcastMessage (message: string, prefix?: boolean, allowFormatting?: boolean, position?: number) {
    Object.values(this.server.clients).forEach((c) => {
      this.message(c, message, prefix, allowFormatting, position)
    })
  }

  printHelp (client: Client | ServerClient) {
    this.message(client, '---------- Proxy Commands: ------------- ', false)
    this.message(client, '§6/c [msg]:§r Send a message to all other connected clients', false)
    this.message(client, '§6/link:§r Links to the proxy if no one else is linked', false)
    this.message(client, '§6/unlink:§r Unlink and put into spectator mode', false)
    this.message(client, "§6/view:§r Connect to the view connected person's view", false)
    this.message(client, '§6/unview:§r Disconnect from the view', false)
    this.message(client, '§6/tp:§r Tp the spectator to the current proxy', false)
    this.message(client, '§6/phelp:§r This message', false)
  }
}
