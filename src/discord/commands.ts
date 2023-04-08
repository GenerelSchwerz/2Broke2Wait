import { CommandInteraction, OAuth2Scopes, ApplicationCommandOptionType } from "discord.js";
import { Client, Discord, Slash, SlashGroup, SlashOption } from "discordx";
import { DateTime, Duration } from "ts-luxon";

import { hourAndMinToDateTime, pingTime, tentativeStartTime, waitUntilStartingTime } from "../util/remoteInfo";
import { CombinedPredictor } from "../localServer/predictors";
import { sleep } from "../util";

@Discord()
@SlashGroup({ description: "Queue related commands", name: "queue" })
@SlashGroup("queue")
export class QueueCommands {
  @Slash({ description: "Get queue position." })
  async pos(
    @SlashOption({
      description: "specific username",
      name: "username",
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    username: string = "/0all",
    interaction: CommandInteraction,
    client: Client
  ) {
    const mcServer = client.mcServer;

    // do not reply w/ this bot instance if a username is specified AND it does not match.
    if (username !== "/0all" && mcServer.bOpts.username !== username) return;

    if (!mcServer.isProxyConnected()) return await interaction.reply("We are not connected to the server!");

    const queue = mcServer.getSharedData<CombinedPredictor>("queue");
    if (queue == null) return await interaction.reply("No queue loaded!");
    const spot = queue.lastPos;
    if (Number.isNaN(spot)) return await interaction.reply(`Queue position for ${mcServer.bOpts.username} unknown!.`);
    interaction.reply(`Queue pos for ${mcServer.bOpts.username}: ${spot}`);
  }

  @Slash({ description: "Check queue position and other additional info." })
  async info(
    @SlashOption({
      description: "specific username for info",
      name: "username",
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    username: string = "/0all",

    interaction: CommandInteraction,
    client: Client
  ) {
    const mcServer = client.mcServer;

    // do not reply w/ this bot instance if a username is specified AND it does not match.
    if (username !== "/0all" && mcServer.bOpts.username !== username) return;

    if (!mcServer.isProxyConnected()) return await interaction.reply("We are not connected to the server!");

    const queue = mcServer.getSharedData<CombinedPredictor>("queue");
    if (queue == null) return await interaction.reply("No queue loaded!");

    let eta;
    let joiningAt;
    if (!Number.isNaN(queue.eta)) {
      eta = Duration.fromMillis(queue.eta * 1000 - Date.now()).toFormat("h 'hours and' m 'minutes'");
      joiningAt = DateTime.local().plus({ seconds: queue.eta }).toFormat("hh:mm a, MM/dd");
    } else {
      eta = "Unknown (ETA is NaN)";
    }

    let str = `Queue pos: ${queue.lastPos}\nQueue ETA: ${eta}`;
    if (joiningAt) str += `\nJoining at: ${joiningAt}`;

    await interaction.reply(str);
  }
}

@Discord()
@SlashGroup({ description: "Local server related commands", name: "local" })
@SlashGroup("local")
export class LocalServerCommands {
  @Slash({ description: "Start local server." })
  async start(
    @SlashOption({
      description: "specific username to start.",
      name: "username",
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    username: string = "/0all",
    interaction: CommandInteraction,
    client: Client
  ) {
    const mcServer = client.mcServer;

    // do not reply w/ this bot instance if a username is specified AND it does not match.
    if (username !== "/0all" && mcServer.bOpts.username !== username) return;

    if (mcServer.isProxyConnected()) return await interaction.reply("We are already connected to the server!");

    mcServer.start();
    await interaction.reply("Server started!");
  }

  @Slash({ description: "Stop local server." })
  async stop(
    @SlashOption({
      description: "specific username to start.",
      name: "username",
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    username: string = "/0all",

    interaction: CommandInteraction,
    client: Client
  ) {
    const mcServer = client.mcServer;

    // do not reply w/ this bot instance if a username is specified AND it does not match.
    if (username !== "/0all" && mcServer.bOpts.username !== username) return;

    if (!mcServer.isProxyConnected()) return await interaction.reply("We are already disconnected from the server!");

    mcServer.stop();
    await interaction.reply("Server stopped!");
  }

  @Slash({
    description: "Attempt to start server so that the bot is ready to play at a certain time.",
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
    @SlashOption({
      description: "Static prediction (do not adjust estimated prediction time)",
      name: "static_predict",
      required: false,
      type: ApplicationCommandOptionType.Boolean,
    })
    staticPredict: boolean = true,
    @SlashOption({
      description: "Specific username to start at time.",
      name: "username",
      required: false,
      type: ApplicationCommandOptionType.String,
    })
    username: string = "/0all",
    interaction: CommandInteraction,
    client: Client
  ) {
    const mcServer = client.mcServer;

    // do not reply w/ this bot instance if a username is specified AND it does not match.
    if (username !== "/0all" && mcServer.bOpts.username !== username) return;

    if (mcServer.isProxyConnected()) return await interaction.reply("We are already connected to the server!");

    const secondsTilStart = await tentativeStartTime(hour, minute);
    const hoursTilStart = Math.floor(secondsTilStart / 3600);
    const minutesTilStart = Math.ceil((secondsTilStart - hoursTilStart * 3600) / 60);

    const dateStart = secondsTilStart > 0 ? DateTime.local().plus({ seconds: secondsTilStart }) : DateTime.local();
    const data = hourAndMinToDateTime(hour, minute);
    if (secondsTilStart > 0) {
      interaction.reply(
        `To play at ${data.toFormat("MM/dd hh:mm a").toLowerCase()}, ` +
          `the server will start in ${hoursTilStart} hours and ${minutesTilStart} minutes!\n` +
          `Start time: ${dateStart.toFormat("hh:mm a, MM/dd")}`
      );
    } else {
      interaction.reply(
        `To play at ${data.toFormat("MM/dd hh:mm a").toLowerCase()}, ` +
          "the server should right now!\n" +
          `Start time: ${dateStart.toFormat("hh:mm a, MM/dd")}`
      );
    }

    if (staticPredict) {
      if (secondsTilStart > 0) await sleep(secondsTilStart * 1000);
    } else {
      await waitUntilStartingTime(hoursTilStart, minutesTilStart);
    }
    mcServer.start();

    await interaction.editReply(
      `We initially predicted ${dateStart.toFormat("hh:mm a, MM/dd")}.\n` +
        `We joined at: ${DateTime.local().toFormat("hh:mm a, MM/dd")}`
    );
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
      description: "port value (default 25565)",
      name: "port",
      required: false,
      type: ApplicationCommandOptionType.Number,
    })
    port: number = 25565,
    interaction: CommandInteraction
  ) {
    await interaction.reply(`Pinging ${host}${port === 25565 ? "" : ":" + port}!`);

    const num = await pingTime(host, port);
    if (Number.isNaN(num)) {
      await interaction.editReply("There was a problem pinging the server. (Value is NaN)");
      return;
    }
    await interaction.editReply(`Response time was: ${num} ms.`);
  }

  @Slash({ description: "invite" })
  invite(interaction: CommandInteraction, client: Client) {
    interaction.reply(
      client.generateInvite({
        permissions: "Administrator",
        scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
      })
    );
  }
}
