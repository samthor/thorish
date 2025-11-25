import { promiseWithResolvers, unresolvedPromise } from './promise.ts';
import { promiseForSignal } from './signal.ts';

export type SequenceListener<T> = (
  value: T,
  next: (args?: { signal?: AbortSignal }) => Promise<T>,
) => any;

/**
 * Sequencer is a reduced form of an event listener, which allows listeners to be run
 * when a `notify()` call is made, but which provides a way for those listeners to internally get
 * future events.
 *
 * It does not support `removeListener`, rather, pass a {@link AbortSignal}.
 */
export type Sequencer<T> = {
  addListener: (fn: SequenceListener<T>, args?: { signal?: AbortSignal; once?: boolean }) => void;
  notify(value: T): void;
};

type Node<T> = {
  next?: Node<T>;
  p: Promise<T>;
};

/**
 * Builds a sequencer. This can be spread onto another object as it does not use `this`.
 */
export function buildSequencer<T>(): Sequencer<T> {
  let { promise: p, resolve } = promiseWithResolvers<T>();
  let head: Node<T> & { p: Promise<T> } = { p };

  const listeners: SequenceListener<T>[] = [];

  return {
    notify: (value: T) => {
      // #1: resolve head (release prior listeners)
      resolve(value);
      const oldHead: Node<T> = head;

      ({ promise: p, resolve } = promiseWithResolvers<T>());
      head = { p };
      oldHead.next = head;

      // #2: fire all listeners
      for (const listener of listeners) {
        let target: Node<T> = head;

        const next = async (args?: { signal?: AbortSignal }): Promise<T> => {
          const ps = args?.signal ? promiseForSignal(args?.signal) : unresolvedPromise;
          const out = await Promise.race([ps, target.p]);
          target = target.next!;
          return out;
        };
        listener(value, next);
      }
    },

    addListener: (fn, args) => {
      if (args?.signal?.aborted) {
        return;
      }

      let removed = false;
      const remove = () => {
        if (removed) {
          return;
        }
        removed = true;

        const index = listeners.indexOf(fn);
        if (index === -1) {
          return;
        }
        listeners.splice(index, 1);
        // nb. we don't check for listeners.length === 0; we might have some in-flight
      };

      // allow duplicates
      if (args?.once) {
        const realFn = fn;
        fn = (value, next) => {
          remove();
          realFn(value, next);
        };
      } else if (listeners.includes(fn)) {
        const realFn = fn;
        fn = (value, next) => realFn(value, next);
      }

      args?.signal?.addEventListener('abort', remove);
      listeners.push(fn);
    },
  };
}
