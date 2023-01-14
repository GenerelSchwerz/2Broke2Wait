/////////////////////////////////////////////
//               Imports                   //
/////////////////////////////////////////////

import { sleep } from "./index";
import * as everpolate from "everpolate";
import * as mc from "minecraft-protocol";
import { DateTime } from "ts-luxon";
import { Task } from "./index";
import * as fetch from "node-fetch";

/////////////////////////////////////////////
//            Local Variables              //
/////////////////////////////////////////////

const c = 300;
const queueData = {
  place: [257, 789, 93, 418, 666, 826, 231, 506, 550, 207, 586, 486, 412, 758],
  factor: [
    0.9999291667668093, 0.9999337457796981, 0.9998618838664679,
    0.9999168965649361, 0.9999219189483673, 0.9999279556964097,
    0.9999234240704379, 0.9999262577896301, 0.9999462301738332,
    0.9999220416881794, 0.999938895110192, 0.9999440195022513,
    0.9999410569845172, 0.9999473463335498,
  ],
};

let queueTask: Task = Task.createDoneTask();

/////////////////////////////////////////////
//                Types                    //
/////////////////////////////////////////////

export type QueueLength = {
  main: { normal: number; priority: number };
  test: { normal: number; priority: number };
};

export type PositionHistory = {
  time: number; // unix timestamp
  position: number;
  currentQueueLength: number;
};

/////////////////////////////////////////////
//             Interfaces                  //
/////////////////////////////////////////////

export interface QueueResult {
  startingPosition: number;
  currentPosition: number;
  queueStartTime: number;
  minutesInQueue: number;
  averagePositionsPerMinute: number;
  averageMinutesPerPosition: number;
  predictedETA: number;
}

export interface IQueuePluginOpts {
  startTime: Date | null;
  endTime: Date | null;
  inQueue: boolean;
  currentPosition: number;
  lastPosition: number;
  positionHistory: PositionHistory[];
  sawQueuePosition: boolean;
}

/////////////////////////////////////////////
//         Standalone Functions            //
/////////////////////////////////////////////

export function getWaitTime(queueLength: number, queuePos: number) {
  let b = everpolate.linear(queueLength, queueData.place, queueData.factor)[0];
  return Math.log((queuePos + c) / (queueLength + c)) / Math.log(b); // see issue 141
}

/**
 * Convert hh:mm to usable datetime based on local timezone.
 * @param time
 * @returns
 */
export function hourAndMinToDateTime(hour: number, minute: number): DateTime {
  let startdt = DateTime.local().set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });
  if (startdt.toMillis() < DateTime.local().toMillis())
    startdt = startdt.plus({
      days: 1,
    });
  return startdt;
}

/**
 * Return tentative start time in seconds.
 * @param hour hour to start at (wraps around).
 * @param minute minute to start at.
 * @returns seconds to start.
 */
export async function tentativeStartTime(
  hour: number,
  minute: number
): Promise<number> {
  try {
    const res = await fetch("https://2b2t.io/api/queue");
    if (!res.ok) {
      return NaN;
    }
    const playTime = hourAndMinToDateTime(hour, minute);
    const data = await res.json();
    const queueLength = data[0][1];
    const waitTime = Math.ceil(getWaitTime(queueLength, 0));
    return Math.ceil(
      playTime.toSeconds() - waitTime - DateTime.local().toSeconds()
    );
  } catch (e) {
    return NaN;
  }
}

/**
 * Halts program until certain time.
 * @param {string} startTime when to start the server (hh:mm) 24h.
 * @returns {Promise<boolean>} Whether or not to start the server.
 */
export async function waitUntilStartingTime(
  hour: number,
  minute: number
): Promise<boolean> {
  if (queueTask.done) {
    return await queueTask.promise;
  }

  queueTask = Task.createTask();

  try {
    const res = await fetch("https://2b2t.io/api/queue");
    if (!res.ok) {
      return queueTask.finish(false);
    }
  } catch (e) {
    return queueTask.finish(false);
  }

  const playTime = hourAndMinToDateTime(hour, minute);

  while (true) {
    try {
      const res = await fetch("https://2b2t.io/api/queue");
      const data = await res.json();
      const queueLength = data[0][1];
      const waitTime = getWaitTime(queueLength, 0);

      if (playTime.toSeconds() - DateTime.local().toSeconds() < waitTime) {
        return queueTask.finish(true);
      }
    } catch (e) {
      return queueTask.finish(false);
    }
    await sleep(60000); // wait 10 minutes to check again.
  }
}

export async function pingTime(host: string, port: number): Promise<number> {
  const start = Date.now();

  try {
    await mc.ping({ host, port });
    return Date.now() - start;
  } catch (e) {
    return NaN;
  }
}

/////////////////////////////////////////////
//               Classes                   //
/////////////////////////////////////////////

export class QueueLookup {
  private lastQueueLookup: number;
  private lastQueueLength: QueueLength | null = null;

  public constructor() {
    this.lastQueueLookup = Date.now();
  }

  /**
   * Return tentative start time in seconds.
   * @param hour hour to start at (wraps around).
   * @param minute minute to start at.
   * @returns seconds to start.
   */
  public async tentativeStartTime(
    hour: number,
    minute: number
  ): Promise<number> {
    try {
      const res = await fetch("https://2b2t.io/api/queue");
      if (!res.ok) {
        return NaN;
      }
      const playTime = hourAndMinToDateTime(hour, minute);
      const data = await res.json();
      const queueLength = data[0][1];
      const waitTime = Math.ceil(getWaitTime(queueLength, 0));
      return Math.ceil(
        playTime.toSeconds() - waitTime - DateTime.local().toSeconds()
      );
    } catch (e) {
      return NaN;
    }
  }

  public async getQueueLength(): Promise<QueueLength | null> {
    if (this.lastQueueLength && Date.now() - this.lastQueueLookup < 2000) {
      return this.lastQueueLength;
    }

    this.lastQueueLength = null;

    try {
      const r = (await mc.ping({
        host: "connect.2b2t.org",
        version: "1.12.2",
      })) as mc.NewPingResult;
      const parsedData = QueueLookup.parseQueueLength(r);
      this.lastQueueLength = parsedData;
      return parsedData;
    } catch (e) {
      this.lastQueueLength = null;
      return null;
    } finally {
      this.lastQueueLookup = Date.now();
    }
  }

  private static parseQueueLength(motd: mc.NewPingResult): QueueLength | null {
    if (!motd) return null;

    const returnValue = {};
    for (const server of motd.players.sample) {
      const serverName = server.name.split(":")[0].replace(/§./g, "");
      const matches = server.name.match(/normal: (\d+), priority: (\d+)/);

      if (!matches) throw new Error("Could not parse queue length");

      const normal = parseInt(matches[1]);
      const priority = parseInt(matches[2]);

      if (isNaN(normal) || isNaN(priority)) {
        throw new Error("Could not parse queue length got " + server.name);
      }

      if (!["main", "test"].includes(serverName)) {
        throw new Error("Invalid server name " + serverName);
      }

      returnValue[serverName] = {
        normal,
        priority,
      };
    }
    return returnValue as QueueLength;
  }
}

/////////////////////////////////////////////
//          Exported Constants             //
/////////////////////////////////////////////

export const GQueueLookup = new QueueLookup();
