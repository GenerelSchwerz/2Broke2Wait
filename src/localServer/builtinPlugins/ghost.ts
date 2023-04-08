import { ServerClient } from 'minecraft-protocol'
import { IProxyServerEvents, IProxyServerOpts, ProxyServer, ProxyServerPlugin } from '../baseServer'
import type { Bot } from 'mineflayer'
import { FakeBotEntity } from './ghostUtils/fakes'

export class GhostPlugin extends ProxyServerPlugin {
  public onLoad (server: ProxyServer<IProxyServerOpts, IProxyServerEvents>): void {
    super.onLoad(server)

    this.serverOn('botevent_spawn', this.onNewBotSpawn)
  }

  onNewBotSpawn = (bot: Bot) => {
    const newFake = new FakeBotEntity(bot)
    const oldFake = this.getShared<FakeBotEntity>('fakeBotEntity')
    if ((oldFake != null) && oldFake.destroyed) {
      oldFake.unsync()

      for (const c of oldFake.linkedClients.values()) {
        newFake.subscribe(c)
      }
    }

    newFake.sync()
    this.share('fakeBotEntity', newFake)
  }

  whileConnectedLoginHandler = async (player: ServerClient): Promise<boolean> => {
    if (!this.server.isUserWhitelisted(player)) {
      const { address, family, port } = {
        address: 'UNKNOWN',
        family: 'UNKNOWN',
        port: NaN,
        ...player.socket.address()
      }
    }

    return true
  }
}
