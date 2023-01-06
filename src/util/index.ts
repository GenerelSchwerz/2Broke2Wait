export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Task {
  public done: boolean;

  public promise: Promise<any>;

  public cancel: <T extends any>(error?: T) => T;

  public finish: <T extends any>(result?: T) => T;

  constructor() {
    this.done = false;
    this.promise = new Promise((resolve, reject) => {
      this.cancel = (err) => {
        if (!this.done) {
          this.done = true;
          reject(err);
          return err;
        }
      };
      this.finish = (result) => {
        if (!this.done) {
          this.done = true;
          resolve(result);
          return result;
        }
      };
    });
  }

  static createTask(): Task {
    return new Task();
  }

  static createDoneTask(): Task {
    return {
      done: true,
      promise: Promise.resolve(),
      cancel: () => { return undefined; },
      finish: () => { return undefined; },
    };
  }
}

//   let runningFunc = Task.createDoneTask();

//   async function shit(iters) {
//     if (!runningFunc.done) {
//       return await runningFunc.promise
//     }
//     runningFunc = Task.createTask();

//     for (let i = 0; i < iters; i++) {
//       await sleep(1000);

//       return runningFunc.cancel(new Error("Bad"));
//     }

//     return runningFunc.finish(true);
//   }

//   (async () => {
//     shit(2).then((res) => console.log("shit 1 done", res)).catch(e => console.log("shit 1 canceled", e));

//     shit(2).then((res) => console.log("shit 2 done", res)).catch(e => console.log("shit 2 canceled", e));

//     shit(3).then((res) => console.log("shit 2 done", res)).catch(e => console.log("shit 3 canceled", e));
//   })();
