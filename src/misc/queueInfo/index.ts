import { QueuePlugin } from "./queueFollower.js";

declare module "mineflayer" {
    interface Bot {
      queuePlugin: QueuePlugin;
    }
  }
  


export interface QueueResult {
    startingPosition: number;
    currentPosition: number;
    queueStartTime: number;
    minutesInQueue: number;
    averagePositionsPerMinute: number;
    averageMinutesPerPosition: number;
    predictedETA: number;
  }
  
export type QueueLength = {
    main: { normal: number; priority: number };
    test: { normal: number; priority: number };
  };

  export type PositionHistory = {
    time: Date;
    position: number;
    currentQueueLength: number;
  };
  
  export interface IQueuePluginOpts {
    startTime: Date | null;
    endTime: Date | null;
    inQueue: boolean;
    currentPosition: number;
    lastPosition: number;
    positionHistory: PositionHistory[];
    sawQueuePosition: boolean;
  }