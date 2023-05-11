import { IPositionTransformer, packetAbilities } from "@icetank/mcproxy";
import { Client, PacketMeta } from "minecraft-protocol";
import { Bot } from "mineflayer";
import type { Entity } from "prismarine-entity";
import type { Item as ItemType, NotchItem } from "prismarine-item";
import merge from "ts-deepmerge";
import { Vec3 } from "vec3";
import { OmitX } from "../../types/util";


const itemLoader = require("prismarine-item/index.js"); // ncc compat, get default.
const fetch = require("node-fetch");

function gameModeToNotchian(gamemode: string): 1 | 0 | 2 {
  switch (gamemode) {
    case "survival":
      return 0;
    case "creative":
      return 1;
    case "adventure":
      return 2;
    default:
      return 0;
  }
}

function notchItemEqual(item1?: NotchItem, item2?: NotchItem) {
  item1 = item1 ?? {};
  item2 = item2 ?? {};
  return JSON.stringify(item1) === JSON.stringify(item2);
}

const NoneItemData = {
  blockId: -1,
  itemCount: undefined,
  itemDamage: undefined,
  nbtData: undefined,
} as any;

class FakeEntity {
  armor: Array<NotchItem | undefined>;
  id: number;
  knownPosition: Vec3;
  yaw: number;
  pitch: number;
  oldYaw: number;
  oldPitch: number;
  onGround: boolean;
  mainHand?: NotchItem;
  offHand?: NotchItem;
  properties: any[] = [];

  /**
   * rounded float (yaw) to integer within mc's limits.
   */
  public get intYaw() {
    return -(Math.floor(((this.yaw / Math.PI) * 128 + 255) % 256) - 127);
  }

  /**
   * rounded float (pitch) to integer within mc's limits.
   */
  public get intPitch() {
    return -Math.floor(((this.pitch / Math.PI) * 128) % 256);
  }

  constructor(id: number, pos: Vec3, yaw: number, pitch: number, onGround = true) {
    this.id = id;
    this.knownPosition = pos;
    this.yaw = yaw;
    this.pitch = pitch;
    this.oldYaw = yaw;
    this.oldPitch = pitch;
    this.onGround = onGround;
    this.armor = [];
  }

  static fromEntity(id: number, entity: Entity, PrisItem: typeof ItemType) {
    const tmp = new FakeEntity(id, entity.position, entity.yaw, entity.pitch, entity.onGround);
    tmp.syncToEntity(entity, PrisItem);
    return tmp;
  }

  public syncToEntityPos(entity: Entity) {
    this.knownPosition.set(entity.position.x, entity.position.y, entity.position.z);
    this.oldYaw = this.yaw;
    this.oldPitch = this.pitch;
    this.yaw = entity.yaw;
    this.pitch = entity.pitch;
    this.onGround = entity.onGround;
  }

  public syncToEntity(entity: Entity, PrisItem: typeof ItemType) {
    this.syncToEntityPos(entity);
    this.mainHand = PrisItem.toNotch(entity.heldItem);
    this.offHand = PrisItem.toNotch(entity.equipment[1]); // updated on entities, but maybe not the bot.
    this.armor = entity.equipment.slice(2).map((i) => PrisItem.toNotch(i));
  }

  public getPositionData() {
    return {
      ...this.knownPosition,
      yaw: this.yaw,
      pitch: this.pitch,
      onGround: this.onGround,
    };
  }
}

interface FakeBotEntityOpts {
  username: string;
  uuid: string;
  skinLookup: boolean;
  positionTransformer?: IPositionTransformer;
}

const DefaultPlayerOpts: FakeBotEntityOpts = {
  username: "GhostPlayer",
  uuid: "a01e3843-e521-3998-958a-f459800e4d11",
  skinLookup: true,
};

type AllowedClient = Client;


export class FakeBotEntity {
  public static id = 9999;

  private _synced = false;

  public readonly opts: FakeBotEntityOpts;
  public readonly entityRef: FakeEntity;

  public readonly linkedBot: Bot;
  public readonly linkedClients: Map<string, Client> = new Map();

  protected PrisItem: typeof ItemType;

  public get linkedEntity() {
    return this.linkedBot.entity;
  }

  public get synced() {
    return this._synced;
  }

  public get positionTransformer() {
    return this.opts.positionTransformer;
  }

  constructor(bot: Bot, opts: Partial<FakeBotEntityOpts> = {}) {
    this.opts = merge(DefaultPlayerOpts, opts) as any;
    this.linkedBot = bot;
    this.PrisItem = itemLoader(bot.version);
    this.entityRef = FakeEntity.fromEntity(FakeBotEntity.id, bot.entity, this.PrisItem);
  }

  /// /////////////
  // util funcs //
  /// /////////////

  writeRaw = writeRaw;

  getPositionData = getPositionData;

  protected writeAll(name: string, data: any) {
    for (const c of this.linkedClients.values()) this.writeRaw(c, name, data);
  }

  public doForAllClients = <Func extends (client: Client, ...args: any[]) => any>(
    func: Func,
    ...args: OmitX<1, Parameters<Func>>
  ) => {
    for (const c of this.linkedClients.values()) func.call(this, c, ...args);
  };

  public onLinkedMove = (pos: Vec3) => {
    this.entityRef.syncToEntityPos(this.linkedEntity);

    this.writeAll("entity_teleport", {
      entityId: this.entityRef.id,
      ...this.entityRef.knownPosition,
      yaw: this.entityRef.intYaw,
      pitch: this.entityRef.intPitch,
      onGround: this.entityRef.onGround,
    });
    this.writeAll("entity_look", {
      entityId: this.entityRef.id,
      yaw: this.entityRef.intYaw,
      pitch: this.entityRef.intPitch,
      onGround: this.entityRef.onGround,
    });

    this.writeAll("entity_head_rotation", {
      entityId: this.entityRef.id,
      headYaw: this.entityRef.intYaw,
    });
  };

  public onLinkedForceMove = () => {
    this.entityRef.syncToEntityPos(this.linkedEntity);
    this.writeAll("entity_teleport", {
      entityId: this.entityRef.id,
      ...this.entityRef.getPositionData(),
    });
  };

  public onItemChange = () => {
    this.linkedBot.updateHeldItem(); // shouldn't be needed.
    this.doForAllClients(this.updateEquipmentFor);
  };

  public updateEquipmentFor = (client: Client) => {
    const mainHand = this.linkedBot.heldItem != null ? this.PrisItem.toNotch(this.linkedBot.heldItem) : NoneItemData;
    const offHand = this.linkedBot.inventory.slots[45]
      ? this.PrisItem.toNotch(this.linkedBot.inventory.slots[45])
      : NoneItemData;

    const entityEquipWrite = (slot: number, item: ItemType) =>
      this.writeRaw(client, "entity_equipment", { entityId: this.entityRef.id, slot, item });

    if (!notchItemEqual(mainHand, this.entityRef.mainHand)) {
      entityEquipWrite(0, mainHand);
      this.entityRef.mainHand = mainHand;
    }

    if (!notchItemEqual(offHand, this.entityRef.offHand)) {
      entityEquipWrite(1, offHand);
      this.entityRef.offHand = offHand;
    }

    const equipmentMap = [5, 4, 3, 2];
    for (let i = 0; i < 4; i++) {
      const armorItem = this.linkedBot.inventory.slots[i + 5]
        ? this.PrisItem.toNotch(this.linkedBot.inventory.slots[i + 5])
        : NoneItemData;

      if (!notchItemEqual(armorItem, this.entityRef.armor[i])) {
        entityEquipWrite(equipmentMap[i], armorItem);
        this.entityRef.armor[i] = armorItem;
      }
    }
  };

  listenerWorldLeave = () => {
    // listen for 5 seconds, then determine that we are not re-joining.
    const timeout = setTimeout(() => {
      this.linkedBot._client.off("position", this.listenerWorldJoin);
    }, 5000);

    // if new pos happens, clear removal listener and fire event.
    this.linkedBot._client.once("position", () => {
      clearTimeout(timeout);
      this.listenerWorldJoin();
    });
    this.doForAllClients(this.writeDestroyEntity);
  };

  listenerWorldJoin = () => this.doForAllClients(this.writePlayerEntity);

  async getPlayerUuid(): Promise<string | null> {
    
    let resp;
    try {
      resp = await fetch(
        `https://api.minecraftservices.com/minecraft/profile/lookup/name/${this.linkedBot.username}`
      );
      if (resp.status !== 200) {
        console.warn(`Request for ${this.linkedBot.username} failed!`);
        return null;
      }

      const data = await resp.json();
      if (!data.id) {
        console.warn(`UUID for ${this.linkedBot.username} is not present in lookup!`);
        return null;
      }
      return data.id;
    } catch (e) {
      console.error("UUID lookup failed", e, resp);
      return null;
    }
  }

  async writePlayerInfo(client: Client) {
    let properties = [];
    if (this.opts.skinLookup) {
      const uuid = await this.getPlayerUuid();
      if (uuid == null) return;
      let response;
      try {
        response = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}?unsigned=false`);
        if (response.status === 204) console.warn("Offline mode, no skin for", uuid);
        else {
          const p = await response.json();
          properties = p?.properties ?? [];
          if (properties?.length !== 1) console.warn("Skin lookup failed for", uuid);
        }
      } catch (err) {
        console.error("Skin lookup failed", err, response);
      }
    }

    this.entityRef.properties = properties;

    this.writeRaw(client, "player_info", {
      action: 0,
      data: [
        {
          UUID: this.opts.uuid,
          name: this.opts.username,
          properties,
          gamemode: gameModeToNotchian(this.linkedBot.game.gameMode),
          ping: 0,
        },
      ],
    });
  }

  private readonly writePlayerEntity = (client: Client) => {
    this.writeRaw(client, "named_entity_spawn", {
      entityId: this.entityRef.id,
      playerUUID: this.opts.uuid,
      ...this.entityRef.knownPosition,
      yaw: this.entityRef.yaw,
      pitch: this.entityRef.pitch,
      metadata: [
        {
          key: 5,
          type: 6,
          value: true, // No gravity
        },
      ],
    });

    this.writeRaw(client, "entity_look", {
      entityId: this.entityRef.id,
      yaw: this.entityRef.yaw,
      pitch: this.entityRef.pitch,
      onGround: this.entityRef.onGround,
    });

    this.writeRaw(client, "entity_head_rotation", {
      entityId: this.entityRef.id,
      headYaw: this.entityRef.intYaw,
    });

    this.updateEquipmentFor(client);

  };

  private writeDestroyEntity(client: Client) {
    this.writeRaw(client, "entity_destroy", {
      entityIds: [this.entityRef.id],
    });
  }

  private despawn(client: Client) {
    this.writeDestroyEntity(client);
    this.writeRaw(client, "player_info", {
      action: 4,
      data: [{ UUID: this.opts.uuid }],
    });
  }

  public spawn(client: Client) {
    this.writePlayerInfo(client)
      .then(() => this.writePlayerEntity(client))
      .catch(console.error);
  }

  public subscribe(client: AllowedClient) {
    if (this.linkedClients.get(client.uuid) != null) return;
    this.linkedClients.set(client.uuid, client);
    this.spawn(client);
  }

  public unsubscribe(client: AllowedClient) {
    if (this.linkedClients.get(client.uuid) == null) return;
    this.despawn(client);
    this.linkedClients.delete(client.uuid);
  }

  public sync() {
    this.entityRef.syncToEntity(this.linkedBot.entity, this.PrisItem);
    this.linkedBot.on("move", this.onLinkedMove);
    this.linkedBot.on("forcedMove", this.onLinkedForceMove);
    this.linkedBot.inventory.on("updateSlot", this.onItemChange);
    this.linkedBot._client.on("mcproxy:heldItemSlotUpdate", this.onItemChange);
    this.linkedBot.on("respawn", this.listenerWorldLeave);
    this._synced = true;
  }

  public unsync() {
    this.linkedBot.off("move", this.onLinkedMove);
    this.linkedBot.off("forcedMove", this.onLinkedForceMove);
    this.linkedBot.inventory.off("updateSlot", this.onItemChange);
    this.linkedBot._client.off("mcproxy:heldItemSlotUpdate", this.onItemChange);
    this.linkedBot.off("respawn", this.listenerWorldLeave);
    this._synced = false;
  }
}

export class GhostInfo {
  public readonly clientRef: Client;
  public readonly pos: Vec3;
  public yaw: number;
  public pitch: number;
  public onGround: boolean;

  public cleanup: () => void;

  constructor(client: Client, cleanup = () => {}) {
    this.clientRef = client;
    this.cleanup = cleanup;
    this.pos = new Vec3(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
  }

  getPositionData = getPositionData;

  posListener = (data: any, meta: PacketMeta) => {
    if (meta.name.includes("position")) {
      this.pos.set(data.x, data.y, data.z);
      this.onGround = data.onGround;
    }
    if (meta.name.includes("look")) {
      this.yaw = data.yaw;
      this.pitch = data.pitch;
      this.onGround = data.onGround;
    }
  };
}

interface GhostHandlerOpts {}

const DefaultGhostHandlerOpts: GhostHandlerOpts = {};

export class GhostHandler {
  public readonly linkedFakeBot: FakeBotEntity;
  public readonly clientsInCamera: Record<string, GhostInfo> = {};

  public opts: GhostHandlerOpts;

  public get linkedBot() {
    return this.linkedFakeBot.linkedBot;
  }

  public get positionTransformer() {
    return this.linkedFakeBot.positionTransformer;
  }

  constructor(host: FakeBotEntity, opts: Partial<GhostHandlerOpts> = {}) {
    this.linkedFakeBot = host;
    this.opts = merge(DefaultGhostHandlerOpts, opts) as any;
  }

  writeRaw = writeRaw;

  public tpToFakePlayer(client: Client) {
    this.writeRaw(client, "position", this.linkedFakeBot.entityRef.getPositionData());
  }

  public tpToOtherClient(client: Client, username: string) {
    let target;
    for (const clientUser in this.clientsInCamera) {
      if (username === clientUser) {
        target = this.clientsInCamera[clientUser];
        break;
      }
    }
    if (target == null) return;
    this.writeRaw(client, "position", target.getPositionData());
  }

  public makeSpectator(client: Client) {
    this.writeRaw(client, "player_info", {
      action: 1,
      data: [{ UUID: client.uuid, gamemode: 3 }],
    });

    // https://wiki.vg/index.php?title=Protocol&oldid=14204#Change_Game_State
    this.writeRaw(client, "game_state_change", { reason: 3, gameMode: 3 });

    this.writeRaw(client, "abilities", {
      flags: 7,
      flyingSpeed: 0.05000000074505806,
      walkingSpeed: 0.10000000149011612,
    });

    this.linkedFakeBot.subscribe(client);
  }

  public revertPov(client: Client) {
    if (!this.clientsInCamera[client.uuid]) return false;

    this.unregister(client);

    this.writeRaw(client, "camera", {
      cameraId: this.linkedBot.entity.id,
    });

    return true;
  }

  public revertToBotGamemode(client: Client) {
    const a = packetAbilities(this.linkedBot);
    if (this.linkedBot.game.gameMode === "survival") a.data.flags = 0; // hotfix
    const notchGM = gameModeToNotchian(this.linkedBot.game.gameMode);
    this.writeRaw(client, a.name, a.data);

    this.writeRaw(client, "player_info", {
      action: 1,
      data: [{ UUID: client.uuid, gamemode: notchGM }],
    });
    // https://wiki.vg/index.php?title=Protocol&oldid=14204#Change_Game_State
    this.writeRaw(client, "game_state_change", {
      reason: 3,
      gameMode: notchGM,
    });

    this.writeRaw(client, "position", {
      ...this.linkedBot.entity.position,
      yaw: this.linkedBot.entity.yaw,
      pitch: this.linkedBot.entity.pitch,
      onGround: this.linkedBot.entity.onGround,
    });

    this.writeRaw(client, a.name, a.data);
  }

  public revertToBotStatus(client: Client) {
    this.linkedFakeBot.unsubscribe(client);
    this.revertPov(client);
    this.revertToBotGamemode(client);
  }

  public linkToBotPov(client: Client) {
    if (this.clientsInCamera[client.uuid]) {
      console.warn("Already in the camera", client.username);
      this.unregister(client);
    }

    this.makeSpectator(client);

    this.writeRaw(client, "camera", {
      cameraId: this.linkedFakeBot.entityRef.id,
    });
    const updatePos = () => {
      this.writeRaw(client, "position", {
        ...this.linkedFakeBot.entityRef.knownPosition,
        yaw: 180 - (this.linkedFakeBot.entityRef.yaw * 180) / Math.PI,
        pitch: -(this.linkedFakeBot.entityRef.pitch * 180) / Math.PI,
      });
    }

    updatePos();
    const onMove = () => updatePos();
    const cleanup = () => {
      this.linkedBot.removeListener("move", onMove);
      this.linkedBot.removeListener("end", cleanup);
      client.removeListener("end", cleanup);
    };
    this.linkedBot.on("move", onMove);
    this.linkedBot.once("end", cleanup);
    client.once("end", cleanup);
    this.register(client, cleanup);
    return true;
  }

  register(client: Client, cleanup: () => void = () => {}) {
    if (this.clientsInCamera[client.uuid]) {
      this.clientsInCamera[client.uuid].cleanup();
    }
    this.clientsInCamera[client.uuid] = new GhostInfo(client, cleanup);
  }

  unregister(client: Client) {
    if (this.clientsInCamera[client.uuid]) {
      this.clientsInCamera[client.uuid].cleanup();
    }
    delete this.clientsInCamera[client.uuid];
  }
}

function writeRaw(
  this: {
    positionTransformer?: IPositionTransformer;
  },
  client: Client,
  name: string,
  data: any
) {
  if (this.positionTransformer != null) {
    const result = this.positionTransformer.onSToCPacket(name, data);
    if (!result) return;
    if (result && result.length > 1) return;
    const [transformedName, transformedData] = result[0];
    client.write(transformedName, transformedData);
  } else {
    client.write(name, data);
  }
}

function getPositionData(this: { yaw: number; pitch: number; onGround: boolean; pos: Vec3 }) {
  return {
    ...this.pos,
    yaw: this.yaw,
    pitch: this.pitch,
    onGround: this.onGround,
  };
}
