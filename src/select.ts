import { promiseWithResolvers } from './promise.ts';

const signalCache = new WeakMap<AbortSignal, Promise<void>>();

/**
 * Channel is borrowed from Go.
 *
 * It doesn't have a notion of buffered; it's not for communication, just for scheduling.
 * Channels have infinite buffer space, however, you can use {@link Channel.push} to wait for a pushed value to be consumed.
 *
 * It's similar to but subtly different from a {@link AsyncGenerator}.
 * Whereas calling {@link AsyncGenerator.next} repeatedly creates a {@link Promise} of the next value, here, we instead wait for a value to be available before choosing to obtain it.
 * In this way it lends itself to "pull" semantics; the consumer of one or many {@link Channel} instances can decide how to proceed.
 */
export type Channel<T> = {
  /**
   * Push this value into the {@link Channel}.
   * Returns a {@link Promise} which resolves when it is consumed (optional).
   */
  push(t: T): Promise<void>;

  /**
   * Closes this channel.
   * No more values can be pushed, and the given value will be provided in perpetuity (i.e., will always be available).
   *
   * You must disambiguate T yourself to identify a closed channel.
   */
  close(t: T): void;

  /**
   * Waits until a value from this channel is available.
   *
   * This is as {@link ReadChannel.wait}, but with a wider type.
   */
  wait<V = Channel<T>>(value?: V): Promise<V>;
} & ReadChannel<T>;

export type ReadChannel<T> = {
  /**
   * Returns whether this channel is closed _and_ the close value has been provided via {@link ReadChannel.next}.
   *
   * This can be used to e.g., prematurely exit a loop or check what value was just retrieved.
   */
  readonly closed: boolean;

  /**
   * Waits until a value from this channel is available.
   *
   * Repeated calls to `wait()` will delay a microtask before resolving.
   * This allows a resolved task to safely consume a value synchronously after this resolves.
   *
   * For no other reason than convenience, this resolves with itself, unless you include another value as an argument.
   * The assumption is you can then synchronously consume the next value with {@link ReadChannel#next}.
   */
  wait<V = ReadChannel<T>>(value?: V): Promise<V>;

  /**
   * Returns whether {@link ReadChannel#next} has an available value.
   */
  pending(): boolean;

  /**
   * Consumes a value from this {@link ReadChannel}, if possible.
   * Otherwise, returns `undefined`.
   */
  next(): T | undefined;
};

type MessageType<Q> = Q extends ReadChannel<infer X> ? X : never;

export type SelectRequest = { [key: string | symbol]: ReadChannel<any> | undefined };

export type SelectResult<TChannels extends SelectRequest> = {
  [TKey in keyof TChannels]: Readonly<{
    key: TKey;
    ch: NonNullable<TChannels[TKey]>;
    m: MessageType<TChannels[TKey]>;
    closed: boolean;
  }>;
}[keyof TChannels];

/**
 * Waits for the first {@link Channel} that is ready based on key.
 * Returns with the key for matching.
 *
 * For safety, throws if no valid channels are passed (zero channels or all `undefined`).
 *
 * This uses JS' default object ordering for what is "first" when many are ready: integers >= 0 in order, all others, symbols.
 */
export function select<TChannels extends SelectRequest>(
  o: TChannels,
): Promise<SelectResult<TChannels>>;

/**
 * Waits for the first {@link Channel} that is ready based on key.
 * Returns with the key for matching.
 * Prefers the passed {@link AbortSignal}, which if aborted, returns `undefined`.
 *
 * Does not throw if missing channels, as the {@link AbortSignal} is an implied 'channel'.
 *
 * This uses JS' default object ordering for what is "first" when many are ready: integers >= 0 in order, all others, symbols.
 */
export function select<TChannels extends SelectRequest>(
  o: TChannels,
  signal: AbortSignal,
): Promise<SelectResult<TChannels> | undefined>;

export function select<TChannels extends SelectRequest>(
  o: TChannels,
): Promise<SelectResult<TChannels>>;

export function select<TChannels extends SelectRequest>(
  o: TChannels,
  signal?: AbortSignal,
): Promise<SelectResult<TChannels> | undefined> {
  if (signal?.aborted) {
    return Promise.resolve().then(() => undefined);
  }

  const sync = selectDefault(o);
  if (sync !== undefined) {
    // nb. load-bearing extra Promise.resolve()
    return Promise.resolve().then(() => sync);
  }

  // basically the key type of SelectResult
  const options: Promise<void | { key: any; ch: ReadChannel<any>; m: any; closed: boolean }>[] = [];

  let signalPromise: Promise<void> | undefined;
  if (signal !== undefined) {
    signalPromise = signalCache.get(signal);
    if (signalPromise === undefined) {
      signalPromise = new Promise((r) =>
        signal.addEventListener('abort', () => r(), { once: true }),
      );
      signalCache.set(signal, signalPromise);
    }
    options.push(signalPromise);
  }

  Object.entries(o).forEach(([key, ch]) => {
    if (ch) {
      options.push(ch.wait({ key, ch, m: undefined, closed: false }));
    }
  });
  if (!options.length) {
    throw new Error(`select() without any valid channels`);
  }

  const out = Promise.race(options)
    .then((choice) => {
      if (choice) {
        choice.m = choice.ch.next();
        choice.closed = choice.ch.closed;
      }
      return choice;
    })
    // nb. load-bearing
    .then((x) => x);
  return out as any;
}

/**
 * Selects the first {@link ReadChannel} that is ready, or `undefined` if none are ready.
 * Returns with the key for matching.
 *
 * This uses JS' default object ordering for what is "first" when many are ready: integers >= 0 in order, all others, symbols.
 */
export function selectDefault<
  TChannels extends { [key: string | symbol]: ReadChannel<any> | undefined },
>(o: TChannels): SelectResult<TChannels> | undefined {
  for (const key of Reflect.ownKeys(o)) {
    const ch = o[key];
    if (ch?.pending()) {
      return { key, ch: ch as any, m: ch.next(), closed: ch.closed };
    }
  }
  return undefined;
}

/**
 * Builds a new {@link Channel}.
 */
export function newChannel<T>(): Channel<T> {
  return new ChannelImpl<T>();
}

type ChannelItem<T> = {
  entry: T;
  next: ChannelItem<T> | null;
  consume: () => void;
};

class ChannelImpl<T> implements Channel<T> {
  private _closed = false;
  private closeFinalized = false;

  get closed() {
    return this.closeFinalized;
  }

  private head: ChannelItem<T> | null = null;
  private tail: ChannelItem<T> | null = null;

  private readonly waits: {
    promise: Promise<any>;
    resolve: () => void;
  }[] = [];

  private resolveTask = Promise.resolve();
  private resolveTaskActive = false;

  private kickoffResolveTask() {
    if (this.resolveTaskActive) {
      return;
    }
    this.resolveTaskActive = true;
    this.resolveTask = this.resolveTask.then(async () => {
      try {
        while (this.tail !== null && this.waits.length) {
          const w = this.waits.shift()!;
          w.resolve();
          await Promise.resolve();
        }
      } finally {
        this.resolveTaskActive = false;
      }
    });
  }

  // awkward typing to allow automatic resolution with any other value
  wait<V = Channel<T>>(value: V = this as any): Promise<V> {
    const pr = promiseWithResolvers<V>();
    this.waits.push({ promise: pr.promise, resolve: () => pr.resolve(value) });

    this.kickoffResolveTask();

    return pr.promise;
  }

  pending(): boolean {
    return this.tail !== null;
  }

  next(): T | undefined {
    if (this.tail === null) {
      return undefined;
    }

    const item = this.tail;

    if (item.next === null && this._closed) {
      this.closeFinalized = true;
    } else {
      this.tail = item.next;
      if (this.tail === null) {
        this.head = null;
      }
    }

    item.consume();
    return item.entry;
  }

  push(entry: T): Promise<void> {
    if (this._closed) {
      return Promise.resolve();
    }

    const p = promiseWithResolvers<void>();
    const item: ChannelItem<T> = { entry, next: null, consume: p.resolve };

    if (this.head === null) {
      this.head = item;
      this.tail = item;
    } else {
      this.head.next = item;
      this.head = item;
    }

    this.kickoffResolveTask();

    return p.promise;
  }

  close(entry: T): void {
    if (this._closed) {
      throw new Error(`already closed`);
    }

    this.push(entry);
    this._closed = true;
  }
}

/**
 * Converts a {@link AbortSignal} into a channel which is closed when it aborts.
 */
export function channelForSignal<T = AbortSignal>(s: AbortSignal, v: T = s as any): ReadChannel<T> {
  const o = {
    closed: false,

    async wait<V = ReadChannel<T>>(value: V = o as any): Promise<V> {
      if (s.aborted) {
        return value;
      }
      return new Promise((r) => s.addEventListener('abort', () => r(value)));
    },

    pending(): boolean {
      return s.aborted;
    },

    next(): T | undefined {
      if (s.aborted) {
        o.closed = true;
        return v;
      }
      return undefined;
    },
  };

  return o;
}

/**
 * Converts a {@link AsyncGenerator} to a channel which contains {@link IteratorResult}.
 */
export function channelForGenerator<T, TReturn>(
  g: AsyncGenerator<T, TReturn, void>,
): ReadChannel<IteratorResult<T, TReturn>> {
  const c = newChannel<IteratorResult<T, TReturn>>();

  (async function () {
    let nextPromise = g.next();
    for (;;) {
      const next = await nextPromise;
      if (next.done) {
        c.close(next);
        return;
      }

      // queue for next before we push and wait for consume
      nextPromise = g.next();
      await c.push(next);
    }
  })();

  return c;
}
