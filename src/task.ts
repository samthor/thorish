import { isSignalAbortException, timeout, withSignal } from './promise.js';
import { WorkQueue } from './queue.js';


export type TaskType<T> = {

  /**
   * Resolves when the passed {@link AbortSignal} is aborted, or rejects if the task runner throws.
   */
  done: Promise<void>;

  /**
   * Helper to queue items into the {@link workTask}.
   */
  queue: (arg: T, ...rest: T[]) => void;

}


export type TaskOptions = {
  signal: AbortSignal;

  /**
   * Whether only to pass unique items (as per {@link Set} equality) to the task runner.
   */
  unique: boolean;

  /**
   * The minimum time to wait before running a task.
   */
  min: number;

  /**
   * The time to wait for items to run the task on, after the first is seen.
   */
  delay: number;
}


/**
 * Runs a task forever (unless it crashes). This enables a "single-threaded" task to run over items
 * pushed into it, possibly with some delaying/deduping.
 *
 * Errors throws inside the task runner will result in the returned {@link Promise} rejecting.
 *
 * Returns a function which triggers the task for new items.
 */
export function workTask<T = void>(task: (...args: T[]) => void | Promise<void>, options: Partial<TaskOptions> = {}): TaskType<T> {
  const wq = new WorkQueue<T>();

  const {
    min = 0,
    delay = 0,
    signal,
    unique = false,
  } = options;

  const done = (async () => {
    for (; ;) {
      try {
        await withSignal(signal, timeout(min));
        await withSignal(signal, wq.wait());
        await withSignal(signal, timeout(delay));
      } catch (e) {
        if (isSignalAbortException(e)) {
          return;  // aborted, drop tasks
        }
        throw e;
      }

      let all: Iterable<T>;
      if (unique) {
        all = new Set(wq);
      } else {
        all = [...wq];
      }

      await task(...all);
    }
  })();

  return {
    done,
    queue: (arg, ...rest) => wq.push(arg, ...rest),
  };
}
