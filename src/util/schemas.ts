// =======
// Imports
// =======

import * as joi from "joi";
// ===========
// Sub-Schemas
// ===========

// Schema used to validate Minecraft usernames (between 3 and 16 characters, containing only a-z, A-Z, 0-9, and _)
const usernameSchema = joi.string().min(3).max(16).token();

// Schema used to validate packet names (lowercase, consisting only of a-z and underscores)
const packetSchema = joi.string().pattern(/^[a-z_]*$/).lowercase();

// Schema used to validate Discord tokens (26 char, period, 6 char, period, 38 char)
const tokenSchema = joi.string().length(72).pattern(/^[a-zA-Z0-9_].*$/)

// =============
// Config Schema
// =============


// Schema used to validate config.json
export const configSchema = joi.object({
    "discord": joi.object({
        "token": tokenSchema.required().description("The discord bot token to send updates to."),
        "prefix" : joi.string().default("!").description("The prefix for the discord bot (using simple commands).")
    }).optional().description("Configuration for a discord bot."),
	"minecraft": joi.object({
		"account": joi.object({
			"username": usernameSchema.default("default-username")
				.description("The in-game playername of the account (only significant in offline mode)."),
			"email": joi.string().email().allow("").default("")
				.description("The email of the account. Leave empty for offline accounts."),
			"password": joi.string().empty("").default("")
				.description("The password of the account (only required for Mojang accounts, leave it empty for Microsoft accounts. Microsoft accounts will just get instructions in the console to put a token into [microsoft.com/link](https://microsoft.com/link)"), // to-do: add a mojang password regex
			"auth": joi.string().valid("microsoft", "mojang", "offline").default("microsoft")
				.description("Authentication type (options: 'microsoft', 'mojang', 'offline')")
		}).default()
			.description("Minecraft account details."),
		"remoteServer": joi.object({
			"host": joi.string().hostname().default("connect.2b2t.org")
				.description("Address of the server to connect to"),
			"port": joi.number().port().default(25565)
				.description("Port of the server to connect to"),
			"version": joi.string().regex(/1\.([1-9](\.|[0-9]\.)|0\.)[0-9]{1,2}$/).default("1.12.2")
				.description("Version of Minecraft the server is on "),
	
		}).default()
			.description("Settings for how the proxy connects to the server"),
		"localServer": joi.object({
			"onlineMode": joi.boolean().default(true)
			.description("Whether to enable online-mode on the proxy. This probably should never be touched"),
			"whitelist": joi.array().items(usernameSchema)
				.description("Playernames of accounts that are allowed to connect to the proxy"),
			"port": joi.number().port().default(25565)
				.description("Port on the machine to connect to the proxy")
		}).default()
			.description("Settings for how you connect to the proxy")
	}).default()
		.description("All minecraft related settings.")
});
