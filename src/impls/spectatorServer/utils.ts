import { AntiAFKOpts } from '../antiAfkServer'

type AllowListCallback = (username: string) => boolean

export interface SpectatorServerOpts extends AntiAFKOpts {
  linkOnConnect: boolean
  /** Log players joining and leaving the proxy. Default: false */
  logPlayerJoinLeave: boolean
  /** Disconnect all connected players once the proxy bot stops. Defaults to true. If not on players will still be connected but won't receive updates from the server. */
  disconnectAllOnEnd: boolean
  disableCommands: boolean
  worldCaching: boolean
}

export const DefaultProxyOpts: SpectatorServerOpts = {
  security: {
    whitelist: undefined,
    kickMessage: 'Default kick message'
  },
  display: {
    proxyChatPrefix: '§6P>> §r'
  },
  
  linkOnConnect: false,
  disableCommands: false,
  disconnectAllOnEnd: true,
  worldCaching: false,
  logPlayerJoinLeave: false,
  restartOnDisconnect: false,
  antiAFK: {
    enabled: true,
    modules: {
      RandomMovementModule: { enabled: false }
    },
    passives: {
      KillAuraPassive: {
        playerWhitelist: [],
        reach: 5,
        entityBlacklist: [],
        multi: false,
        enabled: true
      }
    }
  },
  autoEat: true
}
