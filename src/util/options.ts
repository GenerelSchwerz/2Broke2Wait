import type { BotOptions } from "mineflayer";
import merge from "ts-deepmerge";

// Minecraft and discord options such as discord bot prefix and minecraft login info
export interface Options {
  discord: {
    bot: {
      enabled: boolean;
      botToken: string;
      prefix: string;
    },
    webhooks: {
      enabled: boolean;
      queue: string;
      gameChat: string;
      spam: string;
    }
  };
  minecraft: {
    account: {
      username: string;
      email: string;
      password: string;
      auth: "microsoft" | "mojang" | "offline";
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
      restartOnDisconnect: boolean;
      autoEat: boolean;
      antiAFK: boolean;
      whitelist: string[];
    }
  };
}

export function botOptsFromConfig(opts: Options): BotOptions {
  const fuck = merge(
    opts.minecraft.account,
    opts.minecraft.remoteServer
  );
  if (fuck.auth === "microsoft") {
    delete fuck["password"]; // Allows for first-time microsoft sign-in.
  }
  return fuck;
}