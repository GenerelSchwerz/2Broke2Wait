import { ServerClient } from 'minecraft-protocol'
import { IProxyServerEvents, IProxyServerOpts, ProxyServer, ProxyServerPlugin } from '@nxg-org/mineflayer-mitm-proxy'
import type { Bot } from 'mineflayer'
import { FakeBotEntity, GhostHandler } from './ghostUtils/fakes'

export class GhostPlugin extends ProxyServerPlugin {
  public onLoad (server: ProxyServer<IProxyServerOpts, IProxyServerEvents>): void {
    super.onLoad(server)

    this.serverOn('botevent_spawn', this.onNewBotSpawn)
  }

  onNewBotSpawn = (bot: Bot) => {
    const newFake = new FakeBotEntity(bot)
    const ghostHandler = new GhostHandler(newFake)
    const oldFake = this.getShared<FakeBotEntity>('fakeBotEntity')
    if ((oldFake != null) && oldFake.synced) {
      oldFake.unsync()

      for (const c of oldFake.linkedClients.values()) {
        newFake.subscribe(c)
      }
    }

    newFake.sync()
    this.share('fakeBotEntity', newFake)
  }
}
