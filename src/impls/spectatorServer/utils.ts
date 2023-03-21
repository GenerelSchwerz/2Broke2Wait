import EventEmitter from 'events'
import { StrictEventEmitter } from 'strict-event-emitter-types'
import { IProxyServerOpts } from '../../abstract/proxyServer'
import { AntiAFKOpts } from '../antiAfkServer'

type AllowListCallback = (username: string) => boolean

export interface ServerSpectatorOptions extends AntiAFKOpts {
  security: {
    /** Optional. If not set all players are allowed to join. Either a list off players allowed to connect to the proxy or a function that returns a boolean value. */
    allowList?: string[] | AllowListCallback
    kickMessage: string
  }

  linkOnConnect: boolean
  /** Log players joining and leaving the proxy. Default: false */
  logPlayerJoinLeave: boolean
  /** Disconnect all connected players once the proxy bot stops. Defaults to true. If not on players will still be connected but won't receive updates from the server. */
  disconnectAllOnEnd: boolean
  disabledCommands: boolean
  worldCaching: boolean
}

export const DefaultProxyOpts: ServerSpectatorOptions = {
  security: {
    allowList: undefined,
    kickMessage: 'Default kick message'
  },
  linkOnConnect: false,
  disabledCommands: false,
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
