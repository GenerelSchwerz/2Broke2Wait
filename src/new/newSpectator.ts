import { StrictAntiAFKEvents } from "./newAntiAfk";
import { ProxyServer, ProxyServerPlugin } from "./newProxyServer";

import { Client, Conn, ConnOptions, PacketMiddleware, SimplePositionTransformer } from "@rob9315/mcproxy";
import { createServer, PacketMeta, Server, ServerClient } from "minecraft-protocol";
import { BotOptions } from "mineflayer";

import merge from "ts-deepmerge";
import { Vec3 } from "vec3";
import { sleep } from "../util/index";
import { FakePlayer, FakeSpectator } from "../impls/spectatorServer/fakes";
import { DefaultProxyOpts, SpectatorServerOpts } from "../impls/spectatorServer/utils";
import { WorldManager } from "../impls/spectatorServer/worldManager";

export interface SpectatorServerEvents extends StrictAntiAFKEvents<SpectatorServerOpts> {
  clientChatRaw: (pclient: Client, message: string) => void;
  clientChat: (pclient: Client, message: string) => void;
  clientConnect: (client: ServerClient) => void;
  clientDisconnect: (client: ServerClient) => void;
}

export type StrictSpectatorServerEvents = Omit<SpectatorServerEvents, "*">;

export class SpectatorServerPlugin extends ProxyServerPlugin<SpectatorServerOpts, StrictSpectatorServerEvents> {
  public static readonly notControllingBlockedPackets: string[] = ["entity_metadata", "abilities", "position"];
  name = "Spectator Server";

  public worldManager: WorldManager | null = null;
  public fakeSpectator: FakeSpectator | null = null;
  public fakePlayer: FakePlayer | null = null;

  onProxySetup = (conn: Conn, psOpts: SpectatorServerOpts) => {
    const data = conn.toClientDefaultMiddleware != null ? conn.toClientDefaultMiddleware : [];
    const data1 = conn.toServerDefaultMiddleware != null ? conn.toServerDefaultMiddleware : [];
    conn.toClientDefaultMiddleware = [...this.genToClientMiddleware(conn), ...data];
    conn.toServerDefaultMiddleware = [...this.genToServerMiddleware(conn), ...data1];
    if (conn.stateData.bot.entity) {
      this.buildFakeData(conn);
    } else {
      conn.stateData.bot.once("login", () => {
        this.buildFakeData(conn);
      });
    }
  };

  // ======================= //
  //     server utils        //
  // ======================= //

  private buildFakeData(conn: Conn) {
    this.fakePlayer = new FakePlayer(conn.stateData.bot as any, {
      username: conn.stateData.bot.username,
      uuid: conn.stateData.bot._client.uuid,
      positionTransformer: conn.positionTransformer,
    });

    this.fakeSpectator = new FakeSpectator(conn.stateData.bot as any, {
      positionTransformer: conn.positionTransformer,
    });

    conn.stateData.bot.once("end", () => {
      this.fakePlayer?.destroy();
    });
  }

  public async sendPackets(client: Client) {
    while (this.server.remoteBot?.player == null) {
      await sleep(100);
    }
    this.server.conn?.sendPackets(client);
  }

  public override whileConnectedLoginHandler = async (client: ServerClient) => {
    if (this.server.remoteBot == null) return true;
    if (this.server.conn == null) return true;
    if (!this.server.isUserWhitelisted(client)) {
      const { address, family, port } = {
        address: "unknown",
        family: "unknown",
        port: "unknown",
        ...client.socket.address(),
      };
      client.end(this.server.psOpts.security?.kickMessage ?? "You are not in the whitelist");
      return true;
    }

    if (this.worldManager != null) {
      const managedPlayer = this.worldManager.newManagedPlayer(client, this.server.remoteBot.entity.position);
      managedPlayer.loadChunks(this.server.remoteBot.world);
      managedPlayer.awaitPosReference(this.server.remoteBot);

      this.server.conn.attach(client as unknown as Client, {
        toClientMiddleware: [...managedPlayer.getMiddlewareToClient()],
      });
    } else {
      this.server.conn.attach(client as unknown as Client);
    }
    await this.sendPackets(client as unknown as Client);

    const connect = this.server.psOpts.linkOnConnect && this.server.conn?.pclient == null;

    if (!connect) {
      this.fakePlayer!.register(client);
      this.fakeSpectator!.register(client);
      this.fakeSpectator!.makeSpectator(client);

      if (this.server.conn?.pclient == null) {
        this.server.beginBotLogic();
      }
    } else {
      this.link(client);
    }

    client.once("end", () => {
      if (client.uuid === this.server.conn?.pclient?.uuid) this.server.beginBotLogic();
      this.fakePlayer?.unregister(client);
      this.fakeSpectator?.unregister(client);
      this.unlink(client);
      this.serverEmit("clientDisconnect", client);
    });

    this.serverEmit("clientConnect", client);

    return true;
  };

  link(client: ServerClient | Client) {
    if (this.server.conn == null) return;
    if (client === this.server.conn.pclient) {
      this.server.message(client, "Already in control, cannot link!");
      return;
    }

    if (this.server.conn.pclient == null) {
      this.server.message(client, "Linking");

      this.fakeSpectator?.revertPov(client);
      this.fakePlayer?.unregister(client as unknown as ServerClient);
      this.fakeSpectator?.revertToNormal(client as unknown as ServerClient);
      this.server.conn.link(client as unknown as Client);
      this.server.endBotLogic();
    } else {
      const mes = `Cannot link. User §3${this.server.conn.pclient.username}:§r is linked.`;
      this.server.message(client, mes);
    }
  }

  unlink(client: Client | ServerClient | null) {
    if (this.server.conn == null) return;
    if (client != null) {
      if (client !== this.server.conn.pclient) {
        this.server.message(client, "Cannot unlink as not in control!");
        return;
      }
      this.fakePlayer?.register(client as unknown as ServerClient);
      this.fakeSpectator?.makeSpectator(client as unknown as ServerClient);
      this.server.message(client, "Unlinking");
    }
    this.server.conn.unlink();
    this.server.beginBotLogic();
  }

  // ======================= //
  //        bot utils        //
  // ======================= //

  private genToClientMiddleware(conn: Conn) {
    const inspector_toClientMiddleware: PacketMiddleware = ({ meta, data, isCanceled, bound }) => {
      if (conn == null || isCanceled || bound !== "client") return;
      if (!this.server.isPlayerControlling() && SpectatorServerPlugin.notControllingBlockedPackets.includes(meta.name))
        return;
    };

    const inspector_toClientFakePlayerSync: PacketMiddleware = ({ isCanceled, pclient, data, meta }) => {
      if (isCanceled || pclient === conn?.pclient) return;
      if (conn == null) return;
      if (data.collectorEntityId === conn.stateData.bot.entity?.id) {
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
        }
      }
      if (data.entityId === conn.stateData.bot.entity?.id) {
        switch (meta.name) {
          case "entity_velocity":
            data.entityId = FakePlayer.fakePlayerId;
            return; // can't sim, so might as well ignore for now.
        }
      }
      return data;
    };

    const inspector_toClientMiddlewareRecipesFix: PacketMiddleware = ({ meta, data, bound, isCanceled }) => {
      if (isCanceled) return;
      if (bound !== "client") return;
      if (meta.name === "unlock_recipes") {
      }
    };

    return [inspector_toClientMiddleware, inspector_toClientFakePlayerSync, inspector_toClientMiddlewareRecipesFix];
  }

  private genToServerMiddleware(conn: Conn) {
    const inspector_toServerMiddleware: PacketMiddleware = ({ meta, pclient, data, isCanceled }) => {
      if (conn == null || pclient == null) return;
      switch (meta.name) {
        case "use_entity":
          if (this.fakeSpectator?.clientsInCamera[pclient.uuid] == null) return data;
          if (!this.fakeSpectator.clientsInCamera[pclient.uuid].status && data.target === FakePlayer.fakePlayerId) {
            if (data.mouse === 0 || data.mouse === 1) {
              this.fakeSpectator.makeViewingBotPov(pclient);
            }
          }
          break;
      }
    };

    return [inspector_toServerMiddleware];
  }
}
