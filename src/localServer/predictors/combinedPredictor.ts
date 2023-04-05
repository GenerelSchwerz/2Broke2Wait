import { Conn } from '@rob9315/mcproxy'
import { PacketQueuePredictor } from './packetQueuePredictor'
import { getWaitTime, hourAndMinToDateTime } from '../../util/remoteInfo'
import type { Client, PacketMeta } from 'minecraft-protocol'

export class CombinedPredictor extends PacketQueuePredictor<Client, 'packet'> {
  private _startingPos: number = NaN

  public constructor (conn: Conn) {
    super(conn, conn.stateData.bot._client, 'packet')
  }

  public getPredictedEta (): number {
    if (Number.isNaN(this._startingPos)) return NaN

    const totalWaitTime = getWaitTime(this._startingPos, 0)
    const timepassed = getWaitTime(this._startingPos, this._lastPos)
    const predictedETA = totalWaitTime - timepassed
    return Math.floor(Date.now() / 1000) + Math.floor(predictedETA)
  }

  protected listener = (data: any, packetMeta: PacketMeta) => {
    // console.log(packetMeta.name)
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
      this._lastPos = NaN
      this._startingPos = NaN
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
    const header = JSON.parse(packetData.header).extra as Array<{ text: string, [key: string]: any }>
    let pos = 2 // hardcoded

    if (header) {
      const search0 = header.findIndex(element => element.text.toLowerCase().includes('position'))  // find pisition based on text relevance
 
      if (search0 > -1) pos = search0

      const position = Number(header[pos].extra[0].text.replace(/\n/, ''))
   
      if (Number.isNaN(position)) {
        this.emit('invalidData', { position, eta: this._eta })
        return
      }

      if (this._lastPos !== position) {
        if (Number.isNaN(this._lastPos)) {
          this._startingPos = position
        }
        this._eta = this.getPredictedEta()

        let givenEta;
        const search1 = header.findIndex(element => element.text.toLowerCase().includes('estimated')) // estimated "time", most likely.
        if (search1 >= 0) {
          const rawGivenEta: string = header[search1].extra[0].text.replace(/\n/, '') // XXhXXmXXs
         
          const val = rawGivenEta.match(/^(\d{1,2})h(?:([0-5]?\d)m)?(?:([0-5]?\d)s)?$/)
          if (val != null) {
            const [full, hours, minutes, seconds] = val;
            const numHrs = Number(hours)
            const numMin = Number(minutes)
            givenEta = hourAndMinToDateTime(Number.isNaN(numHrs) ? 0 : numHrs, Number.isNaN(numMin) ? 0 : numMin).toSeconds();
          }

        }

        this.emit('queueUpdate', this._lastPos, position, this._eta, givenEta)
        this._lastPos = position
      }
    }
  }
}
