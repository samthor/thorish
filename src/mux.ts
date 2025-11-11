import { CGroup } from './cgroup.ts';
import { createBackoff } from './limit.ts';
import { objectNotifyAll, objectWait } from './notify.ts';

export type MuxCall<P> = (signal: AbortSignal, p: P) => void;

export type MuxTrainArg<T, P> = {
  /**
   * Wired to the internal group's halt handler.
   * Can prevent shutdown of an unused train, just delay.
   */
  halt?: (groupSignal: AbortSignal, resumeSignal: AbortSignal) => Promise<void>;

  /**
   * Called if an error occured trying to set up the train.
   */
  error?: (error: Error) => void;

  /**
   * Builds the train that passengers are connecting to.
   *
   * It is valid/encouraged for this to throw, or the `done` return to throw.
   */
  build(signal: AbortSignal): Promise<{ target: T; done: Promise<any> }>;

  /**
   * Connects this passenger to the current train.
   *
   * If this throws, the whole train will crash.
   * If the connection is dangerous, wrap in something that informs the {@link P}.
   */
  connect(signal: AbortSignal, t: T, p: P): void;
};

export function buildMuxTrain<T, P>(arg: MuxTrainArg<T, P>): MuxCall<P> {
  let active: { task: Promise<void>; group: CGroup } | undefined;
  const pending = new Set<{ signal: AbortSignal; p: P }>();

  // share backoffs between trains in case we restart hard
  const backoff = createBackoff();

  return (signal: AbortSignal, p: P) => {
    signal.throwIfAborted();
    pending.add({ p, signal });

    if (active !== undefined) {
      // active valid train, push and resume
      active.group.add(signal);
      objectNotifyAll(pending);
      return;
    }

    // kick off new train
    const group = new CGroup();
    if (arg.halt) {
      group.halt(arg.halt);
    }
    group.add(signal);
    const groupSignal = group.start();

    const run = async () => {
      const status = await arg.build(groupSignal);
      backoff.success();

      while (!groupSignal.aborted) {
        for (const { p, signal } of pending) {
          arg.connect(signal, status.target, p);
        }
        pending.clear();

        const w = objectWait(pending, groupSignal);
        await Promise.race([w, status.done]);
      }
    };

    const task = (async () => {
      while (!groupSignal.aborted) {
        await backoff.timeout();
        try {
          await run();
        } catch (e: any) {
          arg.error?.(e instanceof Error ? e : new Error(e));
          backoff.error();
        }
      }
      active = undefined;
    })();

    active = { group, task };
  };
}
