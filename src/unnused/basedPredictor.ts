import { PacketQueuePredictor } from '../abstract/packetQueuePredictor'
import { Conn } from '@rob9315/mcproxy'

import type { Client, PacketMeta } from 'minecraft-protocol'

export class BasedPredictor extends PacketQueuePredictor<Client, 'packet'> {
  public constructor (conn: Conn) {
    super(conn, conn.stateData.bot._client, 'packet')
  }

  protected listener = (data: any, packetMeta: PacketMeta) => {
    // console.log(packetMeta.name);
    switch (packetMeta.name) {
      case 'difficulty':
        this.difficultyPacketHandler(data)
        break
      case 'playerlist_header':
        this.playerlistHeaderPacketHandler(data)
        break
    }
  }

  /**
   * Difficulty packet handler.
   * checks whether or not we're in queue.
   *
   * When rerouted by Velocity, the difficulty packet is always sent after the MC|Brand packet.
   */
  public difficultyPacketHandler (packetData: any) {
    const inQueue =
      (this.remoteBot.game as any).serverBrand === '2b2t (Velocity)' &&
      this.remoteBot.game.dimension === ('minecraft:end' as any) &&
      packetData.difficulty === 1
    if (this._inQueue !== inQueue) {
      this.emit(!inQueue ? 'leftQueue' : 'enteredQueue')
    }
    this._inQueue = inQueue
  }

  /**
   * Playerlist packet handler, checks position in queue
   */
  public playerlistHeaderPacketHandler (packetData: any) {
    // If no longer in queue, stop here
    if (!this._inQueue) {
      return
    }

    // Parse header packets
    const header = JSON.parse(packetData.header).extra
    if (header && header.length === 6) {
      const position: number = Number(
        header[4].extra[0].text.replace(/\n/, '')
      )
      const rawEta: string = header[5].extra[0].text.replace(/\n/, '')
      const eta = stringToUnix(rawEta)

      if (Number.isNaN(position) || Number.isNaN(eta)) {
        this.emit('invalidData', { position, eta })
        return
      }

      if (this._lastPos !== position) {
        this.emit('queueUpdate', this._lastPos, position, eta)
      }
      this._lastPos = position
      this._eta = eta
    }
  }
}

/**
 * Assumes queue will not be more than 2 days (christ haus, get it together).
 * @param input
 * @returns {number} Unix timestamp (seconds since epoch).
 */
function stringToUnix (input: string): number {
  const days = input[2] === 'd' ? 1 : 0
  const res = input.split(/[a-z]/).map((str) => Number(str))
  if (res.some(Number.isNaN)) {
    return NaN
  }
  const timeshift = days * 86400 + res[0] * 3600 + res[1] * 60 + res[2] // time to go in secs
  return Math.floor(Date.now() / 1000) + timeshift
}
