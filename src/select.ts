import { promiseWithResolvers } from './promise.ts';

/**
 * Channel is borrowed from Go.
 *
 * It's similar to but subtly different from a {@link AsyncGenerator}.
 * Whereas calling {@link AsyncGenerator.next} repeatedly creates a {@link Promise} of the next value, here, we instead wait for a value to be available before choosing to obtain it.
 * In this way it lends itself to "pull" semantics; the consumer of one or many {@link Channel} instances can decide how to proceed.
 */
export type Channel<T> = ReadChannel<T> & {
  /**
   * Push this value into the {@link Channel}.
   * Returns a {@link Promise} which resolves when it is consumed (optional).
   */
  push(t: T): Promise<void>;

  /**
   * Closes this channel.
   * No more values can be pushed, and the given value will be provided in perpetuity.
   */
  close(t: T): void;
};

export type ReadChannel<T> = {
  /**
   * Waits until a value from this channel is available.
   *
   * Repeated calls to `wait()` will delay a microtask before resolving.
   * This allows a resolved task to safely consume a value synchronously after this resolves.
   *
   * For no other reason than convenience, this resolves with itself.
   * This isn't the value itself, the assumption is you can then synchronously consume the next value with {@link Channel#next}.
   */
  wait(): Promise<Channel<T>>;

  /**
   * Returns whether {@link Channel#next} has an available value.
   */
  pending(): boolean;

  /**
   * Consumes a value from this {@link Channel}, if possible.
   * Otherwise, returns `undefined`.
   */
  next(): T | undefined;
};

/**
 * Waits for the first {@link Channel} that is ready.
 * This is a thinly veiled wrapper over {@link Promise.race}.
 */
export function select(...channels: Channel<any>[]): Promise<Channel<any>> {
  if (channels.length === 0) {
    throw new Error(`select must be called with at least one channel`);
  }
  const sync = selectDefault(...channels);
  if (sync !== undefined) {
    return sync.wait();
  }

  const o = channels.map((c) => c.wait());
  return Promise.race(o);
}

type SelectResult<TChannels extends Record<string, Channel<any>>> = {
  [TKey in keyof TChannels]: TKey;
}[keyof TChannels];

/**
 * Waits for the first {@link Channel} that is ready based on key.
 * Returns with the key for matching.
 *
 * This uses JS' default object ordering: integers >= 0 in order, all others, symbols.
 */
export async function keyedSelect<TChannels extends { [key: string | symbol]: Channel<any> }>(
  o: TChannels,
): Promise<SelectResult<TChannels>> {
  for (const key of Reflect.ownKeys(o)) {
    const ch = o[key];
    if (ch.pending()) {
      return (ch as any as ChannelImpl<any>).wait(key);
    }
  }

  const options = Object.entries(o).map(([key, ch]) => {
    return (ch as any as ChannelImpl<any>).wait(key);
  });
  return Promise.race(options) as any;
}

/**
 * Selects the first {@link Channel} that is ready, or `undefined` if none are ready.
 */
export function selectDefault(...channels: Channel<any>[]): Channel<any> | undefined {
  for (const ch of channels) {
    if (ch.pending()) {
      return ch;
    }
  }
  return undefined;
}

/**
 * Selects the first {@link Channel} that is ready, or `undefined` if none are ready.
 * Returns with the key for matching.
 *
 * This uses JS' default object ordering: integers >= 0 in order, all others, symbols.
 */
export function keyedSelectDefault<TChannels extends { [key: string | symbol]: Channel<any> }>(
  o: TChannels,
): SelectResult<TChannels> | undefined {
  for (const key of Reflect.ownKeys(o)) {
    const ch = o[key];
    if (ch.pending()) {
      return key;
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

  private head: ChannelItem<T> | null = null;
  private tail: ChannelItem<T> | null = null;

  private readonly waits: {
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
          this.waits.shift()!.resolve();
          await Promise.resolve();
        }
      } finally {
        this.resolveTaskActive = false;
      }
    });
  }

  wait<Q = Channel<T>>(value: Q = this as unknown as Q): Promise<Q> {
    const pr = promiseWithResolvers<Q>();
    this.waits.push({ resolve: () => pr.resolve(value) });

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
      // do nothing
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

export function channelForSignal(s: AbortSignal) {
  const c = newChannel<AbortSignal>();

  if (s.aborted) {
    c.close(s);
    return c;
  }

  s.addEventListener('abort', () => c.close(s));
  return c;
}
