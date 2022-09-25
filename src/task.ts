import { promiseForSignal } from './promise';
import { WorkQueue } from './queue';


export type TaskType<T> = {
  done: Promise<void>;
  queue: (arg: T) => void;
}


export type TaskOptions = {
  signal: AbortSignal;
  delay: number;
}


/**
 * Dedups and runs a task forever (unless it crashes).
 *
 * Returns a function which triggers the task.
 */
export function dedupTask<T = void>(task: (...args: T[]) => void | Promise<void>, options: Partial<TaskOptions> = {}): TaskType<T> {
  const wq = new WorkQueue<T>();

  const delay = options.delay ?? 0;
  const signal = options.signal;

  const abortPromise = options.signal ? promiseForSignal(options.signal) : Promise.resolve();

  const done = (async () => {
    for (;;) {
      try {
        await Promise.race([wq.wait(), abortPromise]);
      } catch (e) {
        if (e instanceof DOMException && signal?.aborted) {
          return;  // aborted
        }
        throw e;
      }

      await new Promise((r) => setTimeout(r, delay));

      // We can just check this here before doing work.
      if (signal?.aborted) {
        return;
      }

      const all = [...wq];
      if (all.length) {
        await task(...all);
      }
    }
  })();

  return {
    done,
    queue: (arg) => wq.push(arg),
  };
}
