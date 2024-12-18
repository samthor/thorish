import { promiseWithResolvers, unresolvedPromise } from './promise.js';
import { promiseForSignal } from './signal.js';

export class WorkQueue<T> {
  #pending: T[] = [];
  #queue: (() => void)[] = [];

  #releaseActive = false;
  #releaseTask = Promise.resolve();

  /**
   * The {@link WorkQueue} releases waiting tasks one-per-microtask. This maintains the invariant
   * that every time `wait` returns or resolves, there's at least one item in the queue: otherwise,
   * resolving everything at once might allow other waiters to steal all items.
   */
  #releasePending() {
    if (this.#releaseActive) {
      return;
    }

    this.#releaseTask = this.#releaseTask.then(async () => {
      this.#releaseActive = true;
      try {
        while (this.#queue.length && this.#pending.length) {
          const resolve = this.#queue.shift()!;
          resolve();
          await new Promise<void>((r) => queueMicrotask(r));
        }
      } finally {
        this.#releaseActive = false;
      }
    });
  }

  /**
   * Iterates through the items in this queue _forever_, waiting for more items to appear.
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, void> {
    for (;;) {
      await this.wait();
      yield this.#pending.shift()!;
    }
  }

  asyncGenerator() {
    return this[Symbol.asyncIterator]();
  }

  /**
   * Iterates through the items in this queue, stopping when no more are available synchronously.
   */
  *[Symbol.iterator]() {
    while (this.#pending.length) {
      yield this.shift()!;
    }
  }

  /**
   * Waits until there is something in the queue that your task can process. This does _not_ return
   * the item itself. This returns `undefined` if no waiting is required.
   */
  wait(): void | Promise<void> {
    if (this.#pending.length === 0) {
      return new Promise<void>((r) => {
        this.#queue.push(r);
      });
    }
  }

  /**
   * Takes a token for the next item from the front of the queue. The returned {@link Promise} will
   * always receive the next item, so don't throw it away.
   */
  async next(): Promise<T> {
    await this.wait();
    return this.#pending.shift()!;
  }

  /**
   * Push items into the queue. Wakes up any pending requests.
   */
  push(...items: T[]) {
    try {
      return this.#pending.push(...items);
    } finally {
      if (items.length) {
        this.#releasePending();
      }
    }
  }

  pop(): T | undefined {
    return this.#pending.pop();
  }

  /**
   * Push items at the start of the queue. Wakes up any pending requests.
   */
  unshift(...items: T[]) {
    try {
      return this.#pending.unshift(...items);
    } finally {
      if (items.length) {
        this.#releasePending();
      }
    }
  }

  shift(): T | undefined {
    return this.#pending.shift();
  }

  get length() {
    return this.#pending.length;
  }
}

/**
 * Array-based queue. Faster thank {@link LinkQueue}, but cannot be garbage-collected.
 */
export interface Queue<X> {
  /**
   * Adds more events to the queue. Returns `true` if any listeners were directly woken up.
   */
  push(...all: X[]): boolean;

  /**
   * Returns a listener that provides all events passed with `push` after this call completes.
   *
   * If the signal is cancelled, the listener becomes invalid and returns undefined values.
   */
  join(signal: AbortSignal): Listener<X>;
}

/**
 * Linked-list based queue.
 */
export interface LinkQueue<X> extends Queue<X> {
  /**
   * Returns a listener that provides all events passed with `push` after this call completes.
   *
   * If the signal is cancelled, the listener becomes invalid and returns undefined values.
   *
   * If the listener is garbage collected, it will lose the reference to the back of the queue.
   */
  join(signal?: AbortSignal): Listener<X>;
}

/**
 * Listener for a queue.
 */
export interface Listener<X> {
  /**
   * Determines if there's a pending queue event, returning it if available.
   *
   * Returns `undefined` if there is no event or the listener was aborted. It does not consume the
   * event.
   */
  peek(): X | undefined;

  /**
   * Waits for and returns the next queue event.
   *
   * Returns `undefined` if this listener was aborted.
   */
  next(): Promise<X | undefined>;

  /**
   * Waits for and returns an array of all available queue events.
   *
   * If the array has zero length, the listener was aborted.
   */
  batch(): Promise<X[]>;

  /**
   * Waits for and returns only the last pending event. This can be useful if the event is purely a
   * "high water mark".
   */
  last(): Promise<X | undefined>;
}

/**
 * Builds an async generator over the given {@link Listener}.
 */
export function listenerToAsyncGenerator<X>(l: Listener<X>): AsyncGenerator<X, void, void> {
  const fn = async function* () {
    for (;;) {
      const value = await l.next();
      if (value === undefined) {
        return;
      }
      yield value;
    }
  };
  return fn();
}

type QueueRef<X> = {
  value?: X;
  next?: QueueRef<X>;
};
const emptyQueueRef: QueueRef<unknown> = {};

/**
 * Builds a listener that never has any values in it, and resolves immediately. For aborted signals.
 */
export function buildEmptyListener<X = any>(): Listener<X> {
  return new EmptyListenerImpl();
}

abstract class ListenerImpl<X> implements Listener<X> {
  abstract next();

  abstract peek();

  async batch(): Promise<X[]> {
    const next = await this.next();
    if (next === undefined) {
      return [];
    }
    const out = [next];

    while (this.peek()) {
      const next = await this.next();
      if (next === undefined) {
        break;
      }
      out.push(next);
    }

    return out;
  }

  async last() {
    const out = await this.batch();
    return out.at(-1);
  }
}

class EmptyListenerImpl extends ListenerImpl<never> {
  next() {
    return Promise.resolve(undefined);
  }
  peek() {
    return undefined;
  }
}

class LinkQueueImpl<X> implements LinkQueue<X> {
  head: QueueRef<X> = {};
  p: ReturnType<typeof promiseWithResolvers<void>> | undefined;

  push(...all) {
    if (!all.length) {
      return false; // no events to broadcast
    }

    for (const each of all) {
      const prev = this.head;
      this.head = {};
      prev.value = each;
      prev.next = this.head;
    }

    // wake up listeners; we only have any if p exists
    if (!this.p) {
      return false;
    }
    const { resolve } = this.p;
    this.p = undefined;
    resolve();
    return true;
  }

  join(signal) {
    let waitNext: () => Promise<void>;
    let ref: QueueRef<X> = this.head;

    if (!signal) {
      // no signal, just wait normally
      waitNext = () => this.p!.promise;
    } else if (signal.aborted) {
      // aborted signal, fail immediately
      waitNext = () => Promise.resolve();
      ref = emptyQueueRef as QueueRef<X>;
    } else {
      // normal signal
      const signalPromise = promiseForSignal(signal, undefined);
      waitNext = () => Promise.race([signalPromise, this.p!.promise]);
    }

    const outer = this;

    return new (class extends ListenerImpl<X> {
      peek() {
        return ref.value;
      }
      async next() {
        if (signal.aborted) {
          return undefined;
        }

        let { value } = ref;
        if (value !== undefined) {
          ref = ref.next!;
          return value;
        }

        outer.p ??= promiseWithResolvers();
        await waitNext();
        return this.next();
      }
      async last() {
        let value = await this.next();
        if (value === undefined) {
          return undefined;
        }
        while (ref.value !== undefined) {
          value = ref.value;
          ref = ref.next!;
        }
        return value;
      }
    })();
  }
}

class ArrayQueueImpl<X> implements Queue<X> {
  head: number = 0;
  data: X[] = [];
  subs = new Map<Listener<X>, number>();
  p: ReturnType<typeof promiseWithResolvers<void>> | undefined;
  trimTask = false;

  push(...all: X[]): boolean {
    if (all.length === 0) {
      return false;
    }

    this.head += all.length;
    if (this.subs.size === 0) {
      this.data.splice(0, this.data.length);
      return false;
    }

    this.data.push(...all);

    // wake up listeners; we only have any if p exists
    if (!this.p) {
      return false;
    }
    const { resolve } = this.p;
    this.p = undefined;
    resolve();
    return true;
  }

  join(signal: AbortSignal): Listener<X> {
    const outer = this;
    const signalPromise = promiseForSignal(signal, undefined);

    const waitFor = async (cb: (avail: number) => number): Promise<X[]> => {
      for (;;) {
        const last = outer.subs.get(l);
        if (last === undefined) {
          return [];
        } else if (last < outer.head) {
          const start = outer.head - outer.data.length;
          const skip = last - start;

          const avail = outer.data.length - skip;
          const toReturn = cb(avail);

          const out = outer.data.slice(skip, skip + toReturn);

          outer.subs.set(l, last + out.length);
          outer.queueTrimEvents();
          return out;
        }

        outer.p ??= promiseWithResolvers();
        await Promise.race([signalPromise, outer.p!.promise]);
      }
    };

    const l = new (class extends ListenerImpl<X> {
      peek() {
        const last = outer.subs.get(l);
        if (last === undefined || last >= outer.head) {
          return undefined;
        }

        const start = outer.head - outer.data.length;
        const skip = last - start;
        return outer.data[skip];
      }

      async next() {
        const out = await waitFor(() => 1);
        return out[0]!;
      }

      async batch() {
        return waitFor((avail) => avail);
      }
    })();

    if (!signal.aborted) {
      this.subs.set(l, this.head);
      signal.addEventListener('abort', () => {
        this.subs.delete(l);
        this.queueTrimEvents();
      });
    }

    return l;
  }

  queueTrimEvents() {
    if (this.trimTask) {
      return;
    }
    this.trimTask = true;
    setTimeout(() => {
      this.trimTask = false;

      const min = Math.min(...this.subs.values());
      if (min === this.head) {
        if (this.data.length) {
          this.data.splice(0, this.data.length);
        }
        return;
      }

      const start = this.head - this.data.length;
      const strip = min - start;
      this.data.splice(0, strip);
    }, 250);
  }
}

/**
 * Builds a {@link LinkQueue}.
 */
export function buildLinkQueue<X>(): LinkQueue<X> {
  return new LinkQueueImpl();
}

/**
 * Builds a {@link Queue}.
 */
export function buildArrayQueue<X>(): Queue<X> {
  return new ArrayQueueImpl();
}
