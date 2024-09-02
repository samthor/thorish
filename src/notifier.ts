/**
 * Notifier is a reduced form of an event listener, which simply allows listeners to be run
 * when a `notify()` call is made.
 *
 * It does not support `removeListener`, rather, pass a {@link AbortSignal}.
 */
export type Notifier<T> = {
  /**
   * Notifies all registered listeners. Takes a copy of the current listener array before running,
   * so changes to the notifier list within a notifier have no effect on the current run.
   */
  notify(value: T): void;
} & NotifierListener<T>;

export type NotifierListener<T> = {
  /**
   * Adds a listener to this notifier. Allows duplicates.
   */
  addListener(fn: (value: T) => void, args?: { signal?: AbortSignal; once?: boolean }): void;
};

export type BuildNotifierArgs = {
  /**
   * Called before the first listener is added.
   */
  setup: () => void;

  /**
   * Called after the last listener is removed.
   */
  teardown: () => void;
};

/**
 * Builds a notifier. This can be spread onto another object as it does not use `this`.
 */
export function buildNotifier<T>(args?: Partial<BuildNotifierArgs>): Notifier<T> {
  const listeners: ((value: T) => void)[] = [];
  const { setup, teardown } = args ?? {};

  return {
    notify(value) {
      const copy = listeners.slice(0, listeners.length);
      copy.forEach((listener) => listener(value));
    },

    addListener(fn, args) {
      const signal = args instanceof AbortSignal ? args : args?.signal;
      if (signal?.aborted) {
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
        if (listeners.length === 0) {
          // throw is fine, nothing else to do
          teardown?.();
        }
      };
      const once = Boolean(args?.once);

      // we explicitly allow duplicates, create a fake
      const exists = listeners.includes(fn);
      if (exists) {
        const realFn = fn;
        fn = (value) => realFn(value);
      }

      if (once) {
        const realFn = fn;
        fn = (value) => {
          try {
            realFn(value);
          } finally {
            remove();
          }
        };
      }

      // try/finally in case setup() throws
      try {
        if (listeners.length === 0) {
          setup?.();
        }
      } finally {
        signal?.addEventListener('abort', remove);
        listeners.push(fn);
      }
    },
  };
}
