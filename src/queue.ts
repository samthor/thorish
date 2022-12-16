

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
    for (; ;) {
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

