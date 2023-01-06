import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";

import { Client, Discord, Slash, SlashGroup, SlashOption } from "discordx";
import { DateTime } from "ts-luxon";
import {
  hourAndMinToDateTime,
  pingTime,
  tentativeStartTime,
} from "../util/remoteInfo";

@Discord()
@SlashGroup({ description: "Queue related commands", name: "queue" })
@SlashGroup("queue")
export class QueueCommands {
  @Slash({ description: "Get queue position." })
  async pos(interaction: CommandInteraction, client: Client) {
    // lazy, don't care anymore.
    const mcServer = client.mcServer;

    if (!mcServer.isProxyConnected()) {
      interaction.reply("We are not connected to the server!");
      return;
    }

    const spot = mcServer.queue.lastPos;

    if (Number.isNaN(spot)) interaction.reply("fuck, couldn't get thingy.");

    interaction.reply(`Queue pos: ${spot}`);
  }

  @Slash({ description: "Check queue position and other additional info." })
  async info(interaction: CommandInteraction, client: Client) {
    // lazy, don't care anymore.
    const mcServer = client.mcServer;

    if (!mcServer.isProxyConnected()) {
      interaction.reply("We are not connected to the server!");
      return;
    }

    interaction.reply(
      `Queue pos: ${mcServer.queue.lastPos}` +
        `Queue ETA: ${mcServer.queue.eta}`
    );

    // const info = GQueueLookup.getQueueInfo();

    // if (isFullRes(info)) {
    //   interaction.reply(
    //     `Queue info!\n` +
    //       `Queue size: ${info.startingPosition}\n` +
    //       `Current position: ${info.currentPosition}\n` +
    //       `Average positions (per min): ${info.averagePositionsPerMinute}\n` +
    //       `Average minutes (per pos): ${info.averageMinutesPerPosition}\n` +
    //       `Time in queue (min): ${info.minutesInQueue}\n` +
    //       `Predicted ETA (min): ${info.predictedETA}\n` +
    //       `Linear estimate (min): ${
    //         info.currentPosition * info.averageMinutesPerPosition
    //       }`
    //   );
    // } else {
    //   interaction.reply(`Queue pos: ${info.currentPosition}`);
    // }
  }
}

@Discord()
@SlashGroup({ description: "Local server related commands", name: "local" })
@SlashGroup("local")
export class LocalServerCommands {
  @Slash({ description: "Start local server." })
  async start(interaction: CommandInteraction, client: Client) {
    // lazy, don't care anymore.
    const mcServer = client.mcServer;

    if (mcServer.isProxyConnected()) {
      interaction.reply("We are already connected to the server!");
      return;
    }

    mcServer.start();

    interaction.reply(`Server started!`);
  }

  @Slash({ description: "Stop local server." })
  async stop(interaction: CommandInteraction, client: Client) {
    // lazy, don't care anymore.
    const mcServer = client.mcServer;

    if (!mcServer.isProxyConnected()) {
      interaction.reply("We are already disProxyConnected from the server!");
      return;
    }

    mcServer.shutdown();

    interaction.reply(`Server stopped!`);
  }

  @Slash({
    description:
      "Attempt to start server so that the bot is ready to play at a certain time.",
  })
  async playat(
    @SlashOption({
      description: "hour value",
      name: "hour",
      required: true,
      type: ApplicationCommandOptionType.Number,
    })
    hour: number,
    @SlashOption({
      description: "minute value",
      name: "minute",
      required: true,
      type: ApplicationCommandOptionType.Number,
    })
    minute: number,
    interaction: CommandInteraction,
    client: Client
  ) {
    // lazy, don't care anymore.
    const mcServer = client.mcServer;

    if (mcServer.isProxyConnected()) {
      interaction.reply("We are already connected to the server!");
      return;
    }

    mcServer.playat(hour, minute);

    const secondsTilStart = await tentativeStartTime(hour, minute);
    const hoursTilStart = Math.floor(secondsTilStart / 3600);
    const minutesTilStart = Math.ceil(
      (secondsTilStart - hoursTilStart * 3600) / 60
    );

    const dateStart = DateTime.local().plus({ seconds: secondsTilStart });
    const data = hourAndMinToDateTime(hour, minute);
    if (secondsTilStart > 0) {
      interaction.reply(
        `To play at ${data.toFormat("MM/dd hh:mm a").toLowerCase()}, ` +
          `the server will start in ${hoursTilStart} hours and ${minutesTilStart} minutes!\n` +
          `Start time: ${dateStart.toFormat("hh:mm a, MM/dd/yyyy")}`
      );
    } else {
      interaction.reply(
        `To play at ${data.toFormat("MM/dd hh:mm a").toLowerCase()}, ` +
          `the server should right now!\n` +
          `Start time: ${DateTime.local().toFormat("hh:mm a, MM/dd/yyyy")}`
      );
    }
  }

  @Slash({
    description:
      "Attempt to start server so that the bot is ready to play at a certain time.",
  })
  async startwhen(
    @SlashOption({
      description: "hour value",
      name: "hour",
      required: true,
      type: ApplicationCommandOptionType.Number,
    })
    hour: number,
    @SlashOption({
      description: "minute value",
      name: "minute",
      required: true,
      type: ApplicationCommandOptionType.Number,
    })
    minute: number,
    interaction: CommandInteraction,
    client: Client
  ) {
    // lazy, don't care anymore.
    const mcServer = client.mcServer;

    if (mcServer.isProxyConnected()) {
      interaction.reply("We are already connected to the server!");
      return;
    }

    const data = hourAndMinToDateTime(hour, minute);
    const secondsTilStart = await tentativeStartTime(hour, minute);
    const hoursTilStart = Math.floor(secondsTilStart / 3600);
    const minutesTilStart = Math.ceil(
      (secondsTilStart - hoursTilStart * 3600) / 60
    );

    const dateStart = DateTime.local().plus({ seconds: secondsTilStart });
    if (secondsTilStart > 0) {
      interaction.reply(
        `To play at ${data.toFormat("MM/dd hh:mm a").toLowerCase()}, ` +
          `the server should start in ${hoursTilStart} hours and ${minutesTilStart} minutes.\n` +
          `Start time: ${dateStart.toFormat("hh:mm a, MM/dd/yyyy")}`
      );
    } else {
      interaction.reply(
        `To play at ${data.toFormat("MM/dd hh:mm a").toLowerCase()}, ` +
          `the server should right now!\n` +
          `Start time: ${DateTime.local().toFormat("hh:mm a, MM/dd/yyyy")}`
      );
    }
  }
}

@Discord()
export class GeneralCommands {
  @Slash({ description: "Ping a minecraft server." })
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
    interaction: CommandInteraction,
    client: Client
  ) {
    // lazy, don't care anymore.
    const mcServer = client.mcServer;

    if (!mcServer.isProxyConnected()) {
      interaction.reply("We are not connected to the server!");
      return;
    }

    const num = await pingTime(host, port);
    if (Number.isNaN(num)) {
      interaction.reply(
        `There was a problem pinging the server. (Value is NaN)`
      );
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
