
import type { CommandInteraction } from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";

import { Discord, Slash, SlashGroup, SlashOption } from "discordx";

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
export class GeneralCommands {
    @Slash({ description: "invite" })
    invite(
        interaction: CommandInteraction
    ) {
        interaction.reply("https://discord.com/api/oauth2/authorize?client_id=1057786019799380059&permissions=0&scope=bot%20applications.commands")
    }
}