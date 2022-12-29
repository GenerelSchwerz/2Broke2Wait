import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";

import { Client, Discord, Slash, SlashGroup, SlashOption } from "discordx";
import { QueueResult } from "../../mineflayerPlugins/queueFollower.js";
import { QueueHandler } from "../../queueHandler.js";

@Discord()
@SlashGroup({ description: "Do math stuff.", name: "math" })
@SlashGroup("math")
export class Math {
  @Slash({ description: "add" })
  add(
    @SlashOption({
      description: "x value",
      name: "x",
      required: true,
      type: ApplicationCommandOptionType.Number,
    })
    x: number,
    @SlashOption({
      description: "y value",
      name: "y",
      required: true,
      type: ApplicationCommandOptionType.Number,
    })
    y: number,
    interaction: CommandInteraction
  ) {
    interaction.reply(String(x + y));
  }
}

@Discord()
@SlashGroup({ description: "Queue related commands", name: "queue" })
@SlashGroup("queue")
export class QueueCommands {
  @Slash({ description: "Get queue position." })
  async pos(interaction: CommandInteraction, client: Client) {
    // lazy, don't care anymore.
    const pLogic: QueueHandler = client["pLogic"];

    if (!pLogic.isConnected()) {
      interaction.reply("We are not connected to the server!");
      return;
    }

    const spot = Number(await pLogic.handleCommand("qpos"));

    if (Number.isNaN(spot)) interaction.reply("fuck, couldn't get thingy.");

    interaction.reply(`Queue pos: ${spot}`);
  }

  @Slash({ description: "Check queue position and other additional info." })
  async info(interaction: CommandInteraction, client: Client) {
    function isFullRes(
      res: any
    ): res is QueueResult & { currentPosition: number } {
      return res.queueStartTime;
    }
    // lazy, don't care anymore.
    const pLogic: QueueHandler = client["pLogic"];

    if (!pLogic.isConnected()) {
      interaction.reply("We are not connected to the server!");
      return;
    }

    const info = pLogic.getQueueInfo();

    if (isFullRes(info)) {
      interaction.reply(
        `Queue info!\n` +
          `Queue size: ${info.startingPosition}\n` +
          `Current position: ${info.currentPosition}\n` +
          `Average positions (per min): ${info.averagePositionsPerMinute}\n` +
          `Average minutes (per pos): ${info.averageMinutesPerPosition}\n` +
          `Time in queue (min): ${info.minutesInQueue}\n`
      );
    } else {
      interaction.reply(`Queue pos: ${info.currentPosition}`);
    }
  }
}

@Discord()
@SlashGroup({ description: "Local server related commands", name: "local" })
@SlashGroup("local")
export class LocalServerCommands {
  @Slash({ description: "Start local server." })
  async start(interaction: CommandInteraction, client: Client) {
    // lazy, don't care anymore.
    const pLogic: QueueHandler = client["pLogic"];

    if (pLogic.isConnected()) {
      interaction.reply("We are already connected to the server!");
      return;
    }

    pLogic.start();

    interaction.reply(`Server started!`);
  }

  @Slash({ description: "Stop local server." })
  async stop(interaction: CommandInteraction, client: Client) {
    // lazy, don't care anymore.
    const pLogic: QueueHandler = client["pLogic"];

    if (!pLogic.isConnected()) {
      interaction.reply("We are already disconnected from the server!");
      return;
    }

    pLogic.shutdown();

    interaction.reply(`Server stopped!`);
  }
}

@Discord()
export class GeneralCommands {
  @Slash({description: "Ping a minecraft server."})
  async ping(

    @SlashOption({
      description: "host value",
      name: "host",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    host: string,
    @SlashOption({
      description: "port value",
      name: "port",
      required: true,
      type: ApplicationCommandOptionType.Number,
    })
    port: number,
    interaction: CommandInteraction, client: Client) {
        // lazy, don't care anymore.
        const pLogic: QueueHandler = client["pLogic"];

        if (!pLogic.isConnected()) {
          interaction.reply("We are not connected to the server!");
          return;
        }

        const num = await pLogic.pingTime(host, port);
        if (Number.isNaN(num)) {
          interaction.reply(`There was a problem pinging the server. (Value is NaN)`)
          return;
        }
        interaction.reply(`Response time was: ${num} ms.`);
    
  }
  
  @Slash({ description: "invite" })
  invite(interaction: CommandInteraction) {
    interaction.reply(
      "https://discord.com/api/oauth2/authorize?client_id=1057786019799380059&permissions=0&scope=bot%20applications.commands"
    );
  }
}
