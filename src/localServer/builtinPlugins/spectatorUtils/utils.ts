import { SpectatorServerOpts } from '../spectator'

export const DefaultProxyOpts: SpectatorServerOpts = {
  security: {
    whitelist: undefined,
    kickMessage: 'Default kick message'
  },
  display: {
    motdPrefix: '§6',
    proxyChatPrefix: '§6P>> §r'
  },

  linkOnConnect: false,
  disableCommands: false,
  disconnectAllOnEnd: true,
  worldCaching: false,
  restartOnDisconnect: true,
  reconnectInterval: 5000
}
