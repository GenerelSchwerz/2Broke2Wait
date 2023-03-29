import type { BotOptions } from "mineflayer";
import type { ServerOptions, Client } from "minecraft-protocol";
import merge from "ts-deepmerge";
import { readFileSync } from "fs";
import { ServerSpectatorOptions } from "../impls/spectatorServer/utils";
import { BaseWebhookOpts } from "../abstract/webhookReporters";
import {SocksClient} from "socks";
import { Agent } from "http";
const ProxyAgent = require("proxy-agent");

// Minecraft and discord options such as discord bot prefix and minecraft login info
export interface Options {
  discord: {
    bot: {
      enabled: boolean;
      botToken: string;
      prefix: string;
    };
    webhooks: {
      enabled: boolean;
      gameChat: BaseWebhookOpts;
      serverInfo: BaseWebhookOpts;
      queue: BaseWebhookOpts & {
        reportAt: number;
      };
    };
  };
  minecraft: {
    account: BotOptions;
    proxy?: {
      enabled: boolean;
      protocol: "socks5h" | "socks5" | "socks4";
      host: string;
      port: number;
      username?: string;
      password?: string;
    };

    remoteServer: {
      host: string;
      port: number;
      version: string;
    };
    localServer: {
      host: string;
      port: number;
      version: string;
      "online-mode": boolean;
      maxPlayers: number;
    };
    localServerOptions: {
      motdOptions?: {
        prefix?: string;
      };
      favicon?: string;
    };
    localServerProxyConfig: ServerSpectatorOptions;
  };
}

function socksConstruct(
  dest: { host: string; port: number },
  opts: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    protocol: "socks4" | "socks5" | "socks5h";
  }
) {
  const numType = opts.protocol.includes("socks5") ? 5 : 4;
  return {
    connect: (client: Client) => {
      SocksClient.createConnection(
        {
          proxy: {
            ...opts,
            type: numType,
            userId: opts.username, // changed name
          },
          command: "connect",
          destination: dest,
        },
        (err, info) => {
          if (err) return console.error(err);
          client.setSocket(info!.socket);
          client.emit("connect");
        }
      );
    },
    agent: new ProxyAgent({
      ...opts,
    }) as Agent,
  };
}

export function botOptsFromConfig(opts: Options): BotOptions {
  let ret = merge(opts.minecraft.account, opts.minecraft.remoteServer);
  if (ret.auth === "microsoft") {
    delete ret.password; // Allows for first-time microsoft sign-in.
  }

  if (opts.minecraft.proxy && opts.minecraft.proxy.enabled) {
    ret = merge(ret, socksConstruct(opts.minecraft.remoteServer, opts.minecraft.proxy));
  }
  return ret;
}

export function serverOptsFromConfig(opts: Options): ServerOptions {
  const serverOpts: ServerOptions = opts.minecraft.localServer;
  const iconPath = opts.minecraft.localServerOptions.favicon;
  let realIcon;
  if (iconPath) {
    if (iconPath.includes("http://") || iconPath.includes("https://")) {
      // todo
      throw Error("Not implemented.")
    } else {
      realIcon = "data:image/png;base64," + readFileSync(iconPath).toString("base64");
    }
  }
  serverOpts.favicon = realIcon;
  return serverOpts;
}
