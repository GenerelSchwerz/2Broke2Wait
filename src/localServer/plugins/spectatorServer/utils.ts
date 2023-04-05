import { SpectatorServerOpts } from '../spectator'


export const DefaultProxyOpts: SpectatorServerOpts = {
  security: {
    whitelist: undefined,
    kickMessage: 'Default kick message'
  },
  display: {
    motdPrefix: "§6",
    proxyChatPrefix: '§6P>> §r'
  },

  linkOnConnect: false,
  disableCommands: false,
  disconnectAllOnEnd: true,
  worldCaching: false,
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
