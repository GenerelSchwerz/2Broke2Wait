import { Client } from 'minecraft-protocol'
import { ClientListener, ClientEvent, ClientEmitters } from '../util/utilTypes'

import type { Bot, BotEvents } from 'mineflayer'
import { IProxyServerEvents, ProxyServer } from './proxyServer'
import { PacketQueuePredictor, PacketQueuePredictorEvents } from './packetQueuePredictor'
import { Conn } from '@rob9315/mcproxy'
import {EventEmitter} from 'events'
import EventEmitter2 from 'eventemitter2'

export abstract class EventRegister<Src extends EventEmitter | EventEmitter2, Event> {


  constructor(protected _emitter: Src, public readonly wantedEvent: Event) {}

  protected abstract listener: any;

  public get emitter(): Src {
    return this._emitter;
  }

  public setEmitter(emitter: Src) {
    this.end();
    this._emitter = emitter;
    this.begin();
  }

 
  public begin (): void {
    this.emitter.on(this.wantedEvent as any, this.listener)
  }

  public end (): void {
    this.emitter.removeListener(this.wantedEvent as any, this.listener)
  }

}

export abstract class ClientEventRegister<
  Src extends ClientEmitters,
  Event extends ClientEvent<Src>
> extends EventRegister<Src, Event> {

  public readonly isSrcBot: Src extends Bot ? true : false;

  constructor (
     _emitter: Src,
    wantedEvent: Event
  ) {
    super(_emitter, wantedEvent)
    this.isSrcBot = !!(_emitter as any)._client as any
   }

  protected abstract listener: Event extends ClientEvent<Bot>
    ? BotEvents[Event]
    : Event extends ClientEvent<Client>
      ? ClientListener<Event>[1]
      : never
}

export abstract class ServerEventRegister<
  Event extends IProxyServerEvents,
  Key extends keyof Event,
  Srv extends ProxyServer = ProxyServer,
> extends EventRegister<Srv, Key> {
  constructor (
    srv: Srv,
    wantedEvent: Key
  ) { 
    super(srv, wantedEvent)
  }

  public get srv(): Srv {
    return this._emitter;
  }

  protected abstract listener: Event[Key]

}

export abstract class QueueEventRegister<
  BaseSrc extends ClientEmitters,
  Event extends keyof PacketQueuePredictorEvents,
> extends EventRegister<PacketQueuePredictor<BaseSrc, any>, Event> {
  constructor (
    _queue: PacketQueuePredictor<BaseSrc, any>,
    wantedEvent: Event
  ) {
    super(_queue, wantedEvent )
   }

   public get queue(): PacketQueuePredictor<BaseSrc, any> {
    return this._emitter;
   }

  protected abstract listener: PacketQueuePredictorEvents[Event]

}
