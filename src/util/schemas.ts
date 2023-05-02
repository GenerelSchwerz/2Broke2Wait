// =======
// Imports
// =======

import * as joi from 'joi'
// ===========
// Sub-Schemas
// ===========

// Schema used to validate Minecraft usernames (between 3 and 16 characters, containing only a-z, A-Z, 0-9, and _)
const usernameSchema = joi.string().min(3).max(16).token()

// Schema used to validate packet names (lowercase, consisting only of a-z and underscores)
const packetSchema = joi
  .string()
  .pattern(/^[a-z_]*$/)
  .lowercase()

// Schema used to validate Discord tokens (26 char, period, 6 char, period, 38 char)
const tokenSchema = joi
  .string()
  .pattern(/^[a-zA-Z0-9_].*$/)

const proxySchema = joi.object({
  // host: joi.string().when('host', {
  //   is: joi.string().pattern(/^((\d){1,3}\.?\b){4}$/),
  //   then: joi.string().pattern(/^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/),
  //   otherwise: joi.string()
  // }),
  host: joi.string().description("Proxy's host"),
  port: joi.number().min(1).max(65535).description("Proxy's port"),
  username: joi.string().optional().description("Optional: Proxy's username"),
  password: joi.string().optional().description("Optional: Proxy's password")
})

// =============
// Config Schema
// =============

// Schema used to validate options.yml
export const configSchema = joi.object({
  discord: joi
    .object({
      bot: joi
        .object({
          enabled: joi.boolean().default(false).description('Whether to use the discord bot or not.'),
          botToken: tokenSchema.allow('').default('').description('The discord bot token to send updates to.'),
          prefix: joi.string().default('!').description('The prefix for the discord bot (using simple commands).')
        })
        .default()
        .description("Discord's configuration for an interactive bot."),
      webhooks: joi
        .object({
          enabled: joi.boolean().default(false).description('Whether to use the discord webhooks or not.'),
          queue: joi
            .object({
              url: joi.string().allow('').default('').description('Webhook URL for queue updates.'),
              icon: joi.string().allow('').default('').description('Icon when sending messages.'),
              username: joi.string().default('Queue webhook').description('Username when sending messages.'),
              reportAt: joi
                .number()
                .min(0)
                .default(9999)
                .description('Begin sending updates from this number and under')
            })
            .required()
            .description('Info for queue updates.'),
          gameChat: joi
            .object({
              url: joi.string().allow('').default('').description('Webhook URL for queue updates.'),
              icon: joi.string().allow('').default('').description('Icon when sending messages.'),
              username: joi.string().default('Queue webhook').description('Username when sending messages.')
            })
            .required()
            .description('Info for queue updates.'),
          serverInfo: joi
            .object({
              url: joi.string().allow('').default('').description('Webhook URL for queue updates.'),
              icon: joi.string().allow('').default('').description('Icon when sending messages.'),
              username: joi.string().default('Queue webhook').description('Username when sending messages.')
            })
            .required()
            .description('Info for queue updates.')
        })
        .default()
        .description('Webhook URLs for logging, if wanted.')
    })
    .optional()
    .description('Configuration for a discord bot.'),
  minecraft: joi
    .object({
      account: joi
        .object({
          username: usernameSchema
            .default('default-username')
            .description('The in-game playername of the account (only significant in offline mode).'),
          email: joi
            .string()
            .email()
            .allow('')
            .default('')
            .description('The email of the account. Leave empty for offline accounts.'),
          password: joi
            .string()
            .empty('')
            .default('')
            .description(
              'The password of the account (only required for Mojang accounts, leave it empty for Microsoft accounts. Microsoft accounts will just get instructions in the console to put a token into [microsoft.com/link](https://microsoft.com/link)'
            ), // to-do: add a mojang password regex
          auth: joi
            .string()
            .valid('microsoft', 'mojang', 'offline')
            .default('microsoft')
            .description("Authentication type (options: 'microsoft', 'mojang', 'offline')"),
          fakeHost: joi.string().optional().description('Advanced: fake the host of the client to bypass TCPShield.')
        })
        .default()
        .description('Minecraft account details. Any mineflayer options can be used here.'),
      proxy: joi
        .object({
          proxy: joi
            .object({
              enabled: joi.boolean().default(true).required().description('Whether or not to use the specified proxy.'),
              protocol: joi
                .string()
                .valid('socks5h', 'socks5', 'socks4', 'http', 'https')
                .required()
                .description('The type of proxy to use.'),
              info: proxySchema
            })
            .optional()
            .description('Advanced: Connect the remote bot via a proxy.')
        })
        .description('Advanced: options for proxies'),
      remoteServer: joi
        .object({
          host: joi.string().default('2b2t.org').description('Address of the server to connect the bot to'),
          port: joi.number().port().default(25565).description('Port of the server to connect to'),
          version: joi
            .string()
            .regex(/1\.([1-9](\.|[0-9]\.)|0\.)[0-9]{1,2}$/)
            .default('1.12.2')
            .description('Version of Minecraft the server is on ')
        })
        .default()
        .description('Settings for how the proxy connects to the server')
    })
    .default()
    .description('All minecraft related settings.'),

  localServer: joi
    .object({
      host: joi
        .string()
        .hostname()
        .default('connect.2b2t.org')
        .description('Address of the server for proxy users to connect to'),
      port: joi.number().port().default(25565).description('Port on the machine to connect to the proxy'),
      version: joi
        .string()
        .regex(/1\.([1-9](\.|[0-9]\.)|0\.)[0-9]{1,2}$/)
        .default('1.12.2')
        .description('Version of Minecraft the server is on '),
      'online-mode': joi
        .boolean()
        .default(true)
        .description('Whether to enable online-mode on the proxy. This probably should never be touched'),
      maxPlayers: joi.number().min(1).default(1).description('Maximum allowed players to connect to the local server.')
    })
    .default()
    .description('Settings for how you connect to the proxy'),

  localServerConfig: joi
    .object({
      restartOnDisconnect: joi
        .boolean()
        .default(true)
        .description('Whether or not the bot should reconnect when disconnected.'),
      disconectAllOnEnd: joi
        .boolean()
        .default(true)
        .description('Whether to kick connected clients when the remote bot disconnects'),
      antiAFK: joi
        .object({
          /* todo lmao */
        })
        .description('AntiAFK options.'),
      autoEat: joi.boolean().default(true).description('Whether or not the bot should eat automatically.'),
      whitelist: joi
        .array()
        .items(usernameSchema)
        .optional()
        .description('Playernames of accounts that are allowed to connect to the proxy')
    })
    .default()
    .description('Custom server options not normally found on minecraft-protocol')
})
