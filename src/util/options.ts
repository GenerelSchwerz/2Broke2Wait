import type { BotOptions } from "mineflayer";
import merge from "ts-deepmerge";

// Minecraft and discord options such as discord bot prefix and minecraft login info
export interface Options {
  discord: {
    token: string;
    prefix: string;
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
      onlineMode: string;
      host: string;
      port: number;
      version: string;
      maxPlayers: number;
    };
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
