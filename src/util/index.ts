export async function sleep (ms: number) {
  return await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function sleepCancel (ms: number) {
  return await new Promise((res, rej) => setTimeout(rej, ms))
}

// stolen task from mineflayer, just strongly typed now.
export class Task<Finish = void, Cancel = void> {
  public done: boolean

  public promise: Promise<any>

  public cancel!: (error: Cancel) => Cancel

  public finish!: (result: Finish) => Finish

  constructor () {
    this.done = false
    this.promise = new Promise((resolve, reject) => {
      this.cancel = (err) => {
        if (!this.done) {
          this.done = true
          reject(err)
        }
        throw err
      }
      this.finish = (result) => {
        if (!this.done) {
          this.done = true
          resolve(result)
        }
        return result
      }
    })
  }

  static createTask<Finish = void, Cancel = void>(): Task<Finish, Cancel> {
    return new Task()
  }

  static createDoneTask (): Task<any, any> {
    return {
      done: true,
      promise: Promise.resolve(),
      cancel: () => {},
      finish: () => {}
    }
  }
}

// let runningFunc: Task<boolean, Error> = {done: true, promise: Promise.resolve()} as any;

// async function shit(iters: number) {
//   if (!runningFunc.done) {
//     return await runningFunc.promise
//   }
//   runningFunc = new Task();

//   for (let i = 0; i < iters; i++) {
//     await sleep(1000);

//     return runningFunc.cancel(new Error("Bad"));
//   }

//   return runningFunc.finish(true);
// }

// (async () => {
//   shit(2).then((res) => console.log("shit 1 done", res)).catch(e => console.log("shit 1 canceled", e));

//   shit(2).then((res) => console.log("shit 2 done", res)).catch(e => console.log("shit 2 canceled", e));

//   shit(3).then((res) => console.log("shit 3 done", res)).catch(e => console.log("shit 3 canceled", e));
// })();
