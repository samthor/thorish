import { CGroup } from './cgroup.ts';
import { objectNotify, objectWait } from './notify.ts';
import { abortedSignal } from './signal.ts';

export type WaitNextTaskFn<T> = () => Promise<() => T>;

export type AggregateRunnerTask<T> = (signal: AbortSignal, nextTask: WaitNextTaskFn<T>) => any;

export type AggregateRunner<T> = {
  /**
   * Enqueue this data for the runner.
   *
   * This does not start the task automatically.
   */
  enqueue(signal: AbortSignal, data: T): void;

  /**
   * Is the aggregate runner active?
   */
  active(): boolean;

  /**
   * Are there any pending items to work on?
   * The runner might still be processing something.
   */
  hasPending(): boolean;

  /**
   * Starts the runner, or returns the result of an already active runner.
   */
  start(): Promise<void>;

  /**
   * Returns all pending items here.
   */
  pending(): Iterable<T>;
};

/**
 * Runs an aggregate task based on other signal-bound tasks passed in here.
 */
export function buildAggregateRunner<T>(runner: AggregateRunnerTask<T>): AggregateRunner<T> {
  const pending = new Set<{ signal: AbortSignal; data: T }>();

  let group: CGroup = new CGroup();
  let groupSignal: AbortSignal = abortedSignal;
  let startTask: Promise<void> | undefined;

  const nextTask = async (): Promise<() => T> => {
    for (;;) {
      for (const x of pending) {
        return () => {
          pending.delete(x);
          return x.data;
        };
      }
      await objectWait(pending, groupSignal);
    }
  };

  return {
    enqueue(signal: AbortSignal, data: T): void {
      if (signal.aborted) {
        return;
      }
      const o = { signal, data };
      pending.add(o);
      signal.addEventListener('abort', () => pending.delete(o));
      objectNotify(pending);
    },

    active(): boolean {
      return startTask !== undefined;
    },

    hasPending(): boolean {
      return pending.size !== 0;
    },

    start() {
      if (startTask !== undefined) {
        return startTask;
      }

      // the runner keeps itself alive
      const c = new AbortController();
      group.add(c.signal);

      groupSignal = group.start();

      startTask = (async () => {
        try {
          await runner(groupSignal, nextTask);
        } finally {
          // reset when runner stops/crashes
          c.abort('runner stop');
          groupSignal = abortedSignal;
        }
      })();

      return startTask;
    },

    *pending(): Iterable<T> {
      for (const x of pending) {
        yield x.data;
      }
    },
  };
}
