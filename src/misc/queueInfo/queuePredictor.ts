import * as linear from "everpolate/lib/linear.js";

import { sleep } from "../constants.js";
import * as tslux from "ts-luxon";
const { DateTime } = tslux;
import fetch from "node-fetch";
// from somewhere else (queueFollower.ts)

const c = 150;
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

export function getWaitTime(queueLength: number, queuePos: number) {
  let b = linear(queueLength, queueData.place, queueData.factor)[0];
  return Math.log((queuePos + c) / (queueLength + c)) / Math.log(b); // see issue 141
}

/**
 * Convert hh:mm to usable datetime based on local timezone.
 * @param time
 * @returns
 */
export function hourAndMinToDateTime(hour: number, minute: number): tslux.DateTime {
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
    return Math.ceil(playTime.toSeconds() - waitTime - DateTime.local().toSeconds());
  } catch (e) {
    return NaN;
  }
}

/**
 * Halts program until certain time.
 * @param {string} startTime when to start the server (hh:mm) 24h.
 * @returns {Promise<boolean>} Whether or not to start the server.
 */
export async function waitUntilTimeToStart(
  hour: number,
  minute: number
): Promise<boolean> {
  try {
    const res = await fetch("https://2b2t.io/api/queue");
    if (!res.ok) return false;
  } catch (e) {
    return false;
  }

  const playTime = hourAndMinToDateTime(hour, minute);

  while (true) {
    try {
      const res = await fetch("https://2b2t.io/api/queue");
      const data = await res.json();
      const queueLength = data[0][1];
      const waitTime = getWaitTime(queueLength, 0);

      if (playTime.toSeconds() - DateTime.local().toSeconds() < waitTime) {
        return true;
      }
    } catch (e) {
      return false;
    }

    await sleep(60000); // wait 10 minutes to check again.
  }
}
