
import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";

import { Discord, Slash, SlashOption } from "discordx";

@Discord()
export class Example {
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