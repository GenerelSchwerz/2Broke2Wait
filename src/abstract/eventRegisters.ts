import { Client } from 'minecraft-protocol'
import { ClientListener, ClientEvent, ClientEmitters } from '../util/utilTypes'

import type { Bot, BotEvents } from 'mineflayer'
import { IProxyServerEvents, ProxyServer } from './proxyServer'
import { PacketQueuePredictor, PacketQueuePredictorEvents } from './packetQueuePredictor'

export interface EventRegister {
  begin: () => void
  end: () => void
}

export abstract class ClientEventRegister<
  Src extends ClientEmitters,
  T extends ClientEvent<Src>
> implements EventRegister {
  constructor (
    public readonly emitter: Src,
    public readonly wantedEvent: T
  ) { }

  protected abstract listener: T extends ClientEvent<Bot>
    ? BotEvents[T]
    : T extends ClientEvent<Client>
      ? ClientListener<T>[1]
      : never

  public begin (): void {
    this.emitter.on(this.wantedEvent as any, this.listener)
  }

  public end (): void {
    this.emitter.removeListener(this.wantedEvent as any, this.listener)
  }
}

export abstract class ServerEventRegister<
  T extends IProxyServerEvents,
  Key extends keyof T,
  Srv extends ProxyServer = ProxyServer,
> implements EventRegister {
  constructor (
    protected readonly srv: Srv,
    public readonly wantedEvent: Key
  ) { }

  protected abstract listener: T[Key]

  public begin (): void {
    this.srv.on(this.wantedEvent as any, this.listener as any)
  }

  public end (): void {
    this.srv.removeListener(this.wantedEvent as any, this.listener as any)
  }
}

export abstract class QueueEventRegister<
  Src extends ClientEmitters,
  T extends keyof PacketQueuePredictorEvents,
> implements EventRegister {
  constructor (
    protected readonly queue: PacketQueuePredictor<Src, any>,
    public readonly wantedEvent: T
  ) { }

  protected abstract listener: PacketQueuePredictorEvents[T]

  public begin (): void {
    this.queue.on(this.wantedEvent as any, this.listener)
  }

  public end (): void {
    this.queue.removeListener(this.wantedEvent as any, this.listener)
  }
}
