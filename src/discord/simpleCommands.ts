

import { Discord, SimpleCommand, SimpleCommandMessage } from "discordx";

@Discord()
export class SimpleExample {
    @SimpleCommand({ aliases: ["perm"], name: "permission" })
    async permit(command: SimpleCommandMessage) {
      command.message.reply("access granted");
    }
}