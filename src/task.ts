import { promiseForSignal, symbolAbortSignal } from './internal.js';
import { timeout } from './promise.js';
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
};

export type TaskOptions = {
  signal: AbortSignal;

  /**
   * Whether only to pass unique items (as per {@link Set} equality) to the task runner.
   *
   * @default false
   */
  unique: boolean;

  /**
   * The minimum time to wait before running a task.
   *
   * @default 0
   */
  min: number;

  /**
   * The time to wait for items to run the task on, after the first is seen.
   *
   * @default 0
   */
  delay: number;
};

/**
 * Runs a task forever (unless it crashes). This enables a "single-threaded" task to run over items
 * pushed into it, possibly with some delaying/deduping. It aggregates the inputs and passes them
 * into the task runner to be handled all at once.
 *
 * Errors throws inside the task runner will result in the returned {@link Promise} rejecting.
 *
 * Returns a function which triggers the task for new items.
 */
export function workTask<T = void>(
  task: (...args: T[]) => void | Promise<void>,
  options: Partial<TaskOptions> = {},
): TaskType<T> {
  const wq = new WorkQueue<T>();

  const { min = 0, delay = 0, signal, unique = false } = options;
  const signalPromise = promiseForSignal(signal);

  const done = (async () => {
    for (;;) {
      try {
        await Promise.race([signalPromise, timeout(min)]);
        await Promise.race([signalPromise, wq.wait()]);
        await Promise.race([signalPromise, timeout(delay)]);
      } catch (e) {
        if (e === symbolAbortSignal) {
          return; // aborted, drop tasks
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
