import { EventRegister } from "../abstract/EventRegister";
import { ProxyServer } from "../abstract/proxyServer";
import { ServerLogic } from "../serverLogic";
import { Options } from "./options";
import type { Bot } from "mineflayer";
import { ChatMessage } from "prismarine-chat";
import { WebhookClient, APIEmbed } from "discord.js";

let sendToWebhook = (...any: any[]) => {};

function escapeMarkdown(text) {
	const unescaped = text.replace(/\\(\*|_|:|`|~|\\)/g, '$1'); // Unescape backslashed characters
	const escaped = unescaped.replace(/(\*|_|:|`|~|\\)/g, '\\$1'); // Escape *, _, :, `, ~, \
	return escaped;
}

// since chat is only triggered by players, no need to wait for in queue.
class GameChatListener extends EventRegister<Bot, "chat"> {
  private _webhookClient: WebhookClient;

  constructor(private readonly srv: ServerLogic, public readonly webhookUrl: string) {
    super(srv.remoteBot, "chat");
    this._webhookClient = new WebhookClient({ url: webhookUrl });
  }

  private createEmbeds(username: string, message: string): APIEmbed {
    const embed: APIEmbed = {
        title: "chat message",
        author: {
            name: "Account: " + username,
			icon_url: "https://minotar.net/helm/" + username + "/69.png"
        },
        description: escapeMarkdown(message)
    }

    if (!!this.srv.proxyServer.connectedPlayer) {
        embed.footer = {
            text: "Connected player: " + this.srv.proxyServer.connectedPlayer.username
        }
    }
    return embed;
  }

  protected listener = async (username, message) => {
    const data = await this._webhookClient.send({
        embeds: [this.createEmbeds(username, message)]
    });

    console.log(data);
  };
}

export function applyWebhookListeners(
  srv: ServerLogic,
  config: Options["discord"]["webhooks"]
) {
  if (!config.enabled) return;

  if (!!config.gameChat) {
    const gameChatHelper = new GameChatListener(srv, config.gameChat)
    srv.registerListeners(gameChatHelper);
  }

  if (!!config.spam) {
    console.log("not done yet");
  }
}
