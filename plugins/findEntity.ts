import { Client } from "@icetank/mcproxy";
import { ProxyServerPlugin } from "@nxg-org/mineflayer-mitm-proxy";
import { CommandMap, CmdPerm } from "@nxg-org/mineflayer-mitm-proxy";

class NearestEntity extends ProxyServerPlugin {
  connectedCmds: CommandMap = {
    findEntity: {
      usage: "findEntity <entity username/name>",
      description: "Finds the nearest entity that matches naming",
      allowedIf: CmdPerm.LINKED,
      callable: this.findNearestEntity.bind(this),
    },
  };

  findNearestEntity(client: Client, name: string) {
    const bot = this.server.remoteBot!;

    if (name == null) {
      this.server.message(client, "Did not specify a name!");
      return;
    }

    const e = bot.nearestEntity((e) => Boolean(e.username?.includes(name) || e.name?.includes(name)));

    if (e == null) this.server.message(client, `Could not find entity with identifier: ${name}`);
    else {
      const dist = bot.entity.position.distanceTo(e.position);
      this.server.message(client, `entity ${name} is ${dist.toFixed(2)} blocks away from us.`);
    }
  }
}

export default new NearestEntity();
