import * as fs from "fs";
import type { BotOptions } from "mineflayer";
import merge from "ts-deepmerge";
import { configSchema } from "./util/schemas";

// Minecraft and discord options such as discord bot prefix and minecraft login info
interface Options {
  discord: {
    token: string;
    prefix: string;
  };
  minecraft: {
    account: {
      username: string;
      email: string;
      password: string;
      auth: string;
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


function buildBotOpts(opts: Options): BotOptions {
  const fuck = merge(
    opts.minecraft.account,
    opts.minecraft.remoteServer
  ) as BotOptions;
  if (fuck.auth === "microsoft") {
    delete fuck["password"]; // Allows for first-time microsoft sign-in.
  }
  return fuck;
}

export function validateConfig<T extends object>(config: any): T {
  const validationResult = configSchema.validate(config, {
    // Validate schema
    abortEarly: false, // (find all errors)
    allowUnknown: true, // (allow undefined values (we'll set defaults where we can))
  });

  const validationErrors = validationResult.error;
  if (validationErrors) {
    // If error found, print error to console and kill process...
    if (validationErrors.details.length === 1) {
      console.log(
        "\x1b[36m",
        "Stopped proxy, encountered an error in config.json (you must fix it): \n"
      );
    } else {
      console.log(
        "\x1b[36m",
        "Stopped proxy, encountered " +
          validationErrors.details.length +
          " errors in config.json (you must fix them): \n"
      );
    }
    for (let i = 0; i < validationErrors.details.length; i++) {
      // Print helpful color-coded errors to console
      const error = validationErrors.details[i];
      console.log("\x1b[33m", "ERROR #" + i + ": " + error.message);
      console.log("\x1b[32m", "- Invalid Value: " + error.context.value);
      console.log("\x1b[32m", "- Should Be Type: " + error.type);
      if (i !== validationErrors.details.length) {
        console.log("\x1b[36m", "");
      }
    }
    throw new Error("Couldn't validate config.json"); // Kill the process here
  }

  return validationResult.value;
}
