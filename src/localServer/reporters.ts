import { APIEmbed, APIMessage, WebhookClient } from "discord.js";
import { ServerClient } from "minecraft-protocol";
import type { Bot } from "mineflayer";
import { DateTime, Duration } from "ts-luxon";
import { AllEvents, AllOpts, BaseWebhookOpts } from ".";
import { DiscordWebhookOptions, GameChatSetup, Options, QueueSetup } from "../types/options";
import { ProxyServer, ProxyServerPlugin } from "@nxg-org/mineflayer-mitm-proxy";
import { CombinedPredictor } from "./predictors/combinedPredictor";
import { TwoBAntiAFKEvents } from "./twoBAntiAFK";
import { OmitX } from "../types/util";

export class ConsoleReporter extends ProxyServerPlugin<{}, TwoBAntiAFKEvents> {
  constructor(public debug = false) {
    super();
  }

  public onLoad(server: ProxyServer): void {
    super.onLoad(server);
    this.serverOn("enteredQueue", this.onEnteredQueue);
    this.serverOn("leftQueue", this.onLeftQueue);
    this.serverOn("queueUpdate", this.onQueueUpdate);
  }

  private getRemoteServerName(): string {
    return this.server.bOpts.host + (this.server.bOpts.port !== 25565 ? ":" + this.server.bOpts.port : "");
  }

  onPostStart = () => {
    console.log("Server started!");
  };

  onPostStop = () => {
    console.log("Server stopped!");
  };

  onBotAutonomous = (bot: Bot) => {
    console.log("Bot is now moving independently!");
  };

  onBotControlled = (bot: Bot) => {
    console.log("Bot has stopped moving independently!");
  };

  onRemoteDisconnect = (type: string, info: string | Error) => {
    console.error(`[${type.toUpperCase()}]: Remote disconnected!`, info);
  };

  onPlayerConnected = (client: ServerClient, remoteConnected: boolean) => {
    const { address, family, port } = {
      address: "UNKNOWN",
      family: "UNKNOWN",
      port: "UNKNOWN",
      ...client.socket.address(),
    };

    console.log(`Player [${client.username}] connected from ${address}:${port}`);
  };

  onEnteredQueue = () => {
    console.log("Entered queue!");
  };

  onLeftQueue = () => {
    console.log("Left queue!");
  };

  onQueueUpdate = (oldPos: number, newPos: number, eta: number, givenEta?: number) => {
    let etaStr;
    if (Number.isNaN(eta)) {
      etaStr = "ETA: Unknown.";
    } else {
      etaStr = `ETA: ${Duration.fromMillis(eta * 1000 - Date.now()).toFormat("d'd', h'hr', m'min'")}`;
    }

    if (!Number.isNaN(givenEta) && givenEta != null) {
      etaStr += ` | Given ETA: ${Duration.fromMillis(givenEta * 1000 - Date.now()).toFormat("d'd', h'hr', m'min'")}`;
    }

    console.log("Queue update!");
    console.log(`\t${this.getRemoteServerName()} | Pos: ${newPos} | ${etaStr}`);
  };
}

export interface MotdOpts {
  motdPrefix?: string;
}

export class MotdReporter extends ProxyServerPlugin<MotdOpts, TwoBAntiAFKEvents, {}> {
  public onLoad(server: ProxyServer<MotdOpts>): void {
    super.onLoad(server);
    this.serverOn("botevent_health", this.botUpdatesMotd);
    this.serverOn("remoteDisconnect", this.disconnectServerMotd);
    this.serverOn("enteredQueue", this.queueEnterMotd);
    this.serverOn("leftQueue", this.inGameServerMotd);
    this.serverOn("queueUpdate", this.queueUpdateMotd);
  }

  onPostStart = () => {
    this.setServerMotd(`Joining ${this.getRemoteServerName()}`);
  };

  disconnectServerMotd = (type: string, info: string | Error) => {
    this.setServerMotd(`Disconnected from ${this.getRemoteServerName()}!\n[${type}]: ${String(info).substring(0, 48)}`);
  };

  queueEnterMotd = () => {
    this.setServerMotd(`Entered queue on ${this.getRemoteServerName()}`);
  };

  queueUpdateMotd = (oldPos: number, newPos: number, eta: number, givenEta?: number) => {
    let etaStr;
    if (Number.isNaN(eta)) {
      etaStr = "ETA: Unknown.";
    } else {
      etaStr = `ETA: ${Duration.fromMillis(eta * 1000 - Date.now()).toFormat("d'd', h'hr', m'min'")}`;
    }

    if (!Number.isNaN(givenEta) && givenEta != null) {
      etaStr += ` | Given ETA: ${Duration.fromMillis(givenEta * 1000 - Date.now()).toFormat("d'd', h'hr', m'min'")}`;
    }

    this.setServerMotd(`${this.getRemoteServerName()} | Pos: ${newPos}\n${etaStr}`);
  };

  inGameServerMotd = () => {
    this.setServerMotd(`Playing on ${this.getRemoteServerName()}!`);
  };

  botUpdatesMotd = (bot: Bot) => {
    this.setServerMotd(`Health: ${bot.health.toFixed(2)}, Hunger: ${bot.food.toFixed(2)}`);
  };

  getRemoteServerName(): string {
    return this.server.bOpts.host + (this.server.bOpts.port !== 25565 ? ":" + this.server.bOpts.port : "");
  }

  setServerMotd(message: string) {
    if (this.psOpts.motdPrefix) {
      this.server.rawServer.motd = this.psOpts.motdPrefix + message;
    } else {
      this.server.rawServer.motd = message;
    }
  }
}

type CleanEventNames = Exclude<keyof AllEvents, `botevent_${string}`>;
type CleanEvents = AllEvents[CleanEventNames];

const NiceEventNames: { [key in keyof CleanEvents]: string } = {
  closingConnections: "Kicked everyone!",
  enteredQueue: "Entered the queue!",
  invalidData: "Invalid queue data",
  leftQueue: "Left the queue!",
  queueUpdate: "Queue update!",
  remoteError: "Remote disconnect (Error)",
  remoteKick: "Remote disconnect (Kicked)",
  starting: "Server is starting up!",
  started: "Server started!",
  stopping: "Server is stopping!",
  stopped: "Server stopped!",
  optionValidation: "Option configuration checking!",
  initialBotSetup: "Bot initialization!",
  botControlled: "Bot activity stopped!",
  botAutonomous: "Bot activity started!",
  playerConnected: "Player connected!",
  playerDisconnected: "Player disconnected!",
  proxySetup: "Setting up proxy!",
  restart: "Server is restarting!",
  clientChat: "Local proxy chat!",
  clientChatRaw: "Local proxy chat (raw)!",
  "*": "Any event...",
} as const;

async function updateWebhook(webhookInfo: { client: WebhookClient } & WhOpts, reason = "Automatic update from 2b2w") {
  return await webhookInfo.client.edit({
    avatar: webhookInfo.icon,
    name: webhookInfo.username,
    reason,
  });
}

function escapeMarkdown(...texts: string[]): string[] {
  for (const text in texts) {
    const unescaped = texts[text].replace(/\\(\*|_|:|`|~|\\)/g, "$1"); // Unescape backslashed characters
    texts[text] = unescaped.replace(/(\*|_|:|`|~|\\)/g, "\\$1"); // Escape *, _, :, `, ~, \
  }

  return texts;
}

type EventOpts = {
  deleteEvents?: (keyof AllEvents)[];
  skipFooter?: boolean;
  skipTitle?: boolean;
  [k: string]: any;
} & (
  | { edit?: false }
  | {
      edit: true;
      firstMessageId?: string;
    }
);

type WhSetup = {
  url: string;
  wantedEvents?: (keyof AllEvents)[];
};

type WhOpts = {
  icon?: string;
  name?: string;
  username?: string;
};

type WhWrap = WhSetup & WhOpts;

type WhClient = { client: WebhookClient } & WhWrap;

type WhTypes = "queue" | "serverInfo" | "gameChat";

type RelaxedRecord<K extends string | number | symbol, T> = { [P in K]?: T };
type EventConfig = RelaxedRecord<keyof AllEvents, EventOpts>;
type WhConfig = Record<WhTypes, WhWrap>;

export type WhPluginOpts = {
  eventConfig: EventConfig;
  whConfig: WhConfig;
};

export class WebhookReporter extends ProxyServerPlugin<{}, AllEvents> {
  private eventMsgs: RelaxedRecord<keyof AllEvents, [WhClient, APIMessage][]> = {};

  constructor(private readonly opts: WhPluginOpts) {
    super();
  }

  onLoad(server: ProxyServer) {
    super.onLoad(server);
    console.log(this.opts);
    const whList = Object.values(this.opts.whConfig);
    for (const [key, val] of Object.entries(this.opts.eventConfig)) {
      const k = key as keyof AllEvents;
      this.eventMsgs[k] = [];

      whList
        .filter((wanted) => wanted.wantedEvents?.includes(k))
        .map((w) => {
          return { client: new WebhookClient({ url: w.url }), ...w };
        })
        .forEach((w) => {
          updateWebhook(w);
          this.handleEventType(k, w, val);
        });
    }
  }

  private handleEventType = (eventName: keyof AllEvents, wh: WhClient, conf: EventOpts) => {
    const setup =
      <Fn extends (...args: any[]) => any>(func: Fn) =>
      async (...args: OmitX<3, Parameters<Fn>>) => {
        await func.bind(this, wh, conf, eventName)(...args);
        await this.cleanupMsgs(conf);
      };

    switch (eventName) {
      case "started":
        return this.serverOn("started", setup(this.startReporter));
      case "stopped":
        return this.serverOn("stopped", setup(this.stopReporter));
      case "queueUpdate":
        return this.serverOn("queueUpdate", setup(this.queueUpdateReporter));
      case "leftQueue":
        return this.serverOn("leftQueue", setup(this.leftQueueReporter));
      case "enteredQueue":
        return this.serverOn("enteredQueue", setup(this.enterQueueReporter));
      case "botevent_chat":
        return this.serverOn("botevent_chat", setup(this.botChatReporter));
    }
  };

  async startReporter(wh: WhClient, eConf: EventOpts, eName: keyof AllEvents) {
    const embed = this.buildServerEmbed("started", eConf);
    embed.description = `Started at: ${DateTime.local().toFormat("hh:mm a, MM/dd")}\n`;
    await this.handleMsgSend(wh, eConf, eName, { embeds: [embed] });
  }

  async stopReporter(wh: WhClient, eConf: EventOpts, eName: keyof AllEvents) {
    const embed = this.buildServerEmbed("stopped", eConf);
    embed.description = `Closed at: ${DateTime.local().toFormat("hh:mm a, MM/dd")}\n`;
    await this.handleMsgSend(wh, eConf, eName, { embeds: [embed] });
  }

  async queueUpdateReporter(
    wh: WhClient,
    eConf: EventOpts,
    eName: keyof AllEvents,
    oldPos: number,
    newPos: number,
    eta: number,
    givenEta?: number
  ) {
    if (eConf.reportAt && Number(eConf.reportAt) < newPos) return;

    const embed = this.buildServerEmbed("queueUpdate", eConf);

    const strETA = !Number.isNaN(eta)
      ? Duration.fromMillis(eta * 1000 - Date.now()).toFormat("h 'hours and ' m 'minutes'")
      : "Unknown (NaN)";

    const twoBETA =
      !givenEta || Number.isNaN(givenEta)
        ? "Unknown (NaN)"
        : Duration.fromMillis(givenEta * 1000 - Date.now()).toFormat("h 'hours and ' m 'minutes'");

    embed.description =
      `Current time: ${DateTime.local().toFormat("hh:mm a, MM/dd")}\n` +
      `Old position: ${oldPos}\n` +
      `New position: ${newPos}\n` +
      `Estimated ETA: ${strETA}\n` +
      `2b2t's ETA: ${twoBETA}`;

    await this.handleMsgSend(wh, eConf, eName, { embeds: [embed] });
  }

  async leftQueueReporter(wh: WhClient, eConf: EventOpts, eName: keyof AllEvents) {
    const embed = this.buildServerEmbed("leftQueue", wh);
    embed.description = `Left queue at ${DateTime.local().toFormat("hh:mm a, MM/dd")}`;
    await this.handleMsgSend(wh, eConf, eName, { embeds: [embed] });
  }

  async enterQueueReporter(wh: WhClient, eConf: EventOpts, eName: keyof AllEvents) {
    const embed = this.buildServerEmbed("enteredQueue", wh);
    embed.description = `Entered queue at ${DateTime.local().toFormat("hh:mm a, MM/dd")}`;
    await this.handleMsgSend(wh, eConf, eName, { embeds: [embed] });
  }

  async botChatReporter(
    wh: WhClient,
    eConf: EventOpts,
    eName: keyof AllEvents,
    _bot: Bot,
    username: string,
    message: string
  ) {
    const embed = this.buildClientEmbed("chat", eConf);
    embed.author = {
      name: username,
      icon_url: `https://minotar.net/helm/${username}/69.png`,
    };

    embed.description = escapeMarkdown(message)[0];

    if (eConf.timestamp) {
      if (embed.footer?.text) {
        embed.footer.text += `\nSent: ${DateTime.local().toFormat("hh:mm a, MM/dd")}`;
      } else {
        embed.footer = { text: `Sent: ${DateTime.local().toFormat("hh:mm a, MM/dd")}` };
      }
    }

    await this.handleMsgSend(wh, eConf, eName, { embeds: [embed] });
  }

  private cleanupMsgs = async (eConf: EventOpts) => {
    if (!eConf.deleteEvents) return;
    eConf.deleteEvents.forEach((e) => {
      const msgs = this.eventMsgs[e];
      if (msgs)
        msgs.forEach(([w, msg]) =>
          w.client
            .deleteMessage(msg)
            .then((res) => {
              if (msg.id === this.opts.eventConfig[e]?.firstMessageId) delete this.opts.eventConfig[e]?.firstMessageId;
              this.eventMsgs[e]!.splice(this.eventMsgs[e]!.findIndex((v) => v[1] === msg)!, 1);
            })
            .catch((rej) => {
              console.error(rej);
            })
        );
    });
  };

  private handleMsgSend = async (wh: WhClient, eConf: EventOpts, name: keyof AllEvents, msgData: any) => {
    if (eConf.edit) {
      if (eConf.firstMessageId == null) {
        const sent = await wh.client.send(msgData);
        eConf.firstMessageId = sent.id;
        this.eventMsgs[name]!.push([wh, sent]);
      } else {
        await wh.client.editMessage(eConf.firstMessageId, msgData);
      }
    } else {
      const sent = await wh.client.send(msgData);
      this.eventMsgs[name]!.push([wh, sent]);
    }
  };

  private buildClientEmbed(wantedEvent: string, config?: EventOpts): APIEmbed;
  private buildClientEmbed(wantedEvent: keyof CleanEvents | string, config: EventOpts = {}): APIEmbed {
    wantedEvent = (NiceEventNames as any)[wantedEvent] ?? wantedEvent;

    const embed: APIEmbed = {
      title: config.skipTitle ? undefined : wantedEvent,
    };

    if (config.skipFooter) return embed;

    if (this.server.controllingPlayer != null) {
      embed.footer = {
        text: `Connected player: ${this.server.controllingPlayer.username}`,
      };
    }
    return embed;
  }

  private buildServerEmbed(wantedEvent: string, config?: EventOpts): APIEmbed;
  private buildServerEmbed(wantedEvent: keyof AllEvents | string, config: EventOpts = {}) {
    wantedEvent = (NiceEventNames as any)[wantedEvent] ?? wantedEvent;
    const embed: APIEmbed = {
      title: config.skipTitle ? undefined : wantedEvent,
    };

    const queue = this.getShared<CombinedPredictor>("queue");

    let eta = null;
    if (queue != null) {
      eta = Number.isNaN(queue.eta) ? null : Duration.fromMillis(queue.eta * 1000 - Date.now());
    }

    if (config.skipFooter) return embed;

    let text;
    if (this.server.isProxyConnected()) {
      text = `Connected to: ${this.server.bOpts.host}`;
      if (this.server.bOpts.port !== 25565) text += `:${this.server.bOpts.port}`;
      text += "\n";
    } else {
      text = "Not connected.\n";
    }

    if (this.server.controllingPlayer != null) text += `Connected player: ${this.server.controllingPlayer.username}\n`;
    if (queue?.inQueue && eta != null) {
      text += `Join time: ${DateTime.local().plus(eta).toFormat("hh:mm a, MM/dd")}\n`;
    }

    embed.footer = { text };

    return embed;
  }
}

// export class OldWebhookReporter extends ProxyServerPlugin<{}, TwoBAntiAFKEvents> {
//   public queueInfo?: WebhookWrapper & QueueSetup;
//   public serverInfo?: WebhookWrapper;
//   public gameChat?: WebhookWrapper & GameChatSetup;

//   private serverStopDels: [WebhookWrapper, string][] = [];
//   private serverStartDels: [WebhookWrapper, string][] = [];

//   constructor(webhookUrls: DiscordWebhookOptions) {
//     super();

//     if (webhookUrls.queue.url) {
//       this.queueInfo = {
//         client: new WebhookClient({ url: webhookUrls.queue.url }),
//         config: { skipFooter: true },
//         ...webhookUrls.queue,
//       };
//       updateWebhook(this.queueInfo);
//     }

//     if (webhookUrls.serverInfo.url) {
//       this.serverInfo = {
//         client: new WebhookClient({ url: webhookUrls.serverInfo.url }),
//         config: { skipFooter: true },
//         ...webhookUrls.serverInfo,
//       };
//       updateWebhook(this.serverInfo);
//     }

//     if (webhookUrls.gameChat.url) {
//       this.gameChat = {
//         client: new WebhookClient({ url: webhookUrls.gameChat.url }),
//         config: { skipTitle: true, skipFooter: true },
//         ...webhookUrls.gameChat,
//       };

//       updateWebhook(this.gameChat);
//     }
//   }

//   public onLoad(server: ProxyServer): void {
//     super.onLoad(server);
//     this.serverOn("queueUpdate", this.onQueueUpdate);
//     this.serverOn("enteredQueue", this.onEnteredQueue);
//     this.serverOn("leftQueue", this.onLeftQueue);
//     this.serverOn("botevent_chat", this.onBotChat);
//     this.serverOn("started", this.startCleanup);
//     this.serverOn("stopped", this.stopCleanup);
//   }

//   private readonly startCleanup = async () => {
//     for (const [sender, msgId] of this.serverStartDels) {
//       if (sender.edit) if (sender.firstMessageId === msgId) delete sender.firstMessageId;
//       await sender.client.deleteMessage(msgId);
//     }
//     this.serverStartDels = [];
//   };

//   private readonly stopCleanup = async () => {
//     for (const [sender, msgId] of this.serverStopDels) {
//       if (sender.edit) if (sender.firstMessageId === msgId) delete sender.firstMessageId;
//       await sender.client.deleteMessage(msgId);
//     }
//     this.serverStopDels = [];
//   };

//   // 1am edit, im too lazy to add typings.
//   private readonly sendOrEdit = async (wrap: WebhookWrapper, message: any, additionalConfig?: AdditionaWhConfig) => {
//     let ret;
//     if (wrap.edit) {
//       if (wrap.firstMessageId == null) {
//         ret = await wrap.client.send(message);
//         wrap.firstMessageId = ret.id;
//         if (additionalConfig?.deleteOnServerStop) this.serverStopDels.push([wrap, ret.id]);
//         else if (additionalConfig?.deleteOnServerStart) this.serverStartDels.push([wrap, ret.id]);
//       } else {
//         ret = await wrap.client.editMessage(wrap.firstMessageId, message);
//       }
//     } else {
//       ret = await wrap.client.send(message);
//       if (additionalConfig?.deleteOnServerStop) this.serverStopDels.push([wrap, ret.id]);
//       else if (additionalConfig?.deleteOnServerStart) this.serverStartDels.push([wrap, ret.id]);
//     }
//     return ret;
//   };

//   /**
//    * @override
//    * @returns
//    */
//   async onPostStart() {
//     if (this.serverInfo == null) return;
//     const embed = this.buildServerEmbed("started", this.serverInfo.config);
//     embed.description = `Started at: ${DateTime.local().toFormat("hh:mm a, MM/dd")}\n`;
//     await this.sendOrEdit(
//       this.serverInfo,
//       {
//         embeds: [embed],
//       },
//       { deleteOnServerStop: true }
//     );
//   }

//   async onPostStop() {
//     if (this.serverInfo == null) return;
//     const embed = this.buildServerEmbed("stopped", this.serverInfo.config);
//     embed.description = `Closed at: ${DateTime.local().toFormat("hh:mm a, MM/dd")}\n`;
//     await this.sendOrEdit(
//       this.serverInfo,
//       {
//         embeds: [embed],
//       },
//       { deleteOnServerStart: true }
//     );
//   }

//   async onRemoteDisconnect(type: string, info: string | Error) {
//     if (this.serverInfo == null) return;
//     const embed = this.buildServerEmbed("Bot disconnected!", this.serverInfo.config);

//     embed.description =
//       `Time: ${DateTime.local().toFormat("hh:mm a, MM/dd")}\n` + `Reason: ${String(info).substring(0, 1000)}`;

//     await this.serverInfo.client.send({
//       embeds: [embed],
//     });
//   }

//   async onBotChat(_bot: Bot, username: string, message: string) {
//     if (this.gameChat == null) return;
//     const embed = this.buildClientEmbed("chat", this.gameChat.config);
//     embed.author = {
//       name: username,
//       icon_url: `https://minotar.net/helm/${username}/69.png`,
//     };

//     embed.description = escapeMarkdown(message)[0];

//     if (this.gameChat.timestamp) {
//       if (embed.footer?.text) {
//         embed.footer.text += `\nSent: ${DateTime.local().toFormat("hh:mm a, MM/dd")}`;
//       } else {
//         embed.footer = { text: `Sent: ${DateTime.local().toFormat("hh:mm a, MM/dd")}` };
//       }
//     }

//     await this.gameChat.client.send({
//       embeds: [embed],
//     });
//   }

//   async onLeftQueue() {
//     if (this.queueInfo == null) return;
//     const embed = this.buildServerEmbed("leftQueue", this.queueInfo.config);
//     embed.description = `Left queue at ${DateTime.local().toFormat("hh:mm a, MM/dd")}`;
//     await this.queueInfo.client.send({
//       embeds: [embed],
//     });
//   }

//   async onEnteredQueue() {
//     if (this.queueInfo == null) return;
//     const embed = this.buildServerEmbed("enteredQueue", this.queueInfo.config);
//     embed.description = `Entered queue at ${DateTime.local().toFormat("hh:mm a, MM/dd")}`;
//     await this.queueInfo.client.send({
//       embeds: [embed],
//     });
//   }

//   async onQueueUpdate(oldPos: number, newPos: number, eta: number, givenEta?: number) {
//     if (this.queueInfo == null) return;
//     const embed = this.buildServerEmbed("queueUpdate", this.queueInfo.config);

//     const strETA = !Number.isNaN(eta)
//       ? Duration.fromMillis(eta * 1000 - Date.now()).toFormat("h 'hours and ' m 'minutes'")
//       : "Unknown (NaN)";

//     const twoBETA =
//       !givenEta || Number.isNaN(givenEta)
//         ? "Unknown (NaN)"
//         : Duration.fromMillis(givenEta * 1000 - Date.now()).toFormat("h 'hours and ' m 'minutes'");

//     embed.description =
//       `Current time: ${DateTime.local().toFormat("hh:mm a, MM/dd")}\n` +
//       `Old position: ${oldPos}\n` +
//       `New position: ${newPos}\n` +
//       `Estimated ETA: ${strETA}\n` +
//       `2b2t's ETA: ${twoBETA}`;

//     await this.sendOrEdit(this.queueInfo, {
//       embeds: [embed],
//     });
//   }

//   private buildClientEmbed(wantedEvent: string, config?: WebhookEmbedConfig): APIEmbed;
//   private buildClientEmbed(wantedEvent: keyof CleanEvents | string, config: WebhookEmbedConfig = {}): APIEmbed {
//     wantedEvent = (NiceEventNames as any)[wantedEvent] ?? wantedEvent;

//     const embed: APIEmbed = {
//       title: config.skipTitle ? undefined : wantedEvent,
//     };

//     if (config.skipFooter) return embed;

//     if (this.server.controllingPlayer != null) {
//       embed.footer = {
//         text: `Connected player: ${this.server.controllingPlayer.username}`,
//       };
//     }
//     return embed;
//   }

//   private buildServerEmbed(wantedEvent: string, config?: WebhookEmbedConfig): APIEmbed;
//   private buildServerEmbed(wantedEvent: keyof AllEvents | string, config: WebhookEmbedConfig = {}) {
//     wantedEvent = (NiceEventNames as any)[wantedEvent] ?? wantedEvent;
//     const embed: APIEmbed = {
//       title: config.skipTitle ? undefined : wantedEvent,
//     };

//     const queue = this.getShared<CombinedPredictor>("queue");

//     let eta = null;
//     if (queue != null) {
//       eta = Number.isNaN(queue.eta) ? null : Duration.fromMillis(queue.eta * 1000 - Date.now());
//     }

//     if (config.skipFooter) return embed;

//     let text;
//     if (this.server.isProxyConnected()) {
//       text = `Connected to: ${this.server.bOpts.host}`;
//       if (this.server.bOpts.port !== 25565) text += `:${this.server.bOpts.port}`;
//       text += "\n";
//     } else {
//       text = "Not connected.\n";
//     }

//     if (this.server.controllingPlayer != null) text += `Connected player: ${this.server.controllingPlayer.username}\n`;
//     if (queue?.inQueue && eta != null) {
//       text += `Join time: ${DateTime.local().plus(eta).toFormat("hh:mm a, MM/dd")}\n`;
//     }

//     embed.footer = { text };

//     return embed;
//   }
// }
