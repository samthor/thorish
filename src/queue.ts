

export class WorkQueue<T> {
  #promise: Promise<void>;
  #ready = () => { };
  #pending: T[] = [];

  constructor() {
    this.#promise = new Promise((r) => {
      this.#ready = r;
    });
  }

  #maybeReset() {
    if (this.#pending.length === 0) {
      this.#promise = new Promise((r) => {
        this.#ready = r;
      });
    }
  }

  /**
   * Iterates through the items in this queue _forever_, waiting for more items to appear.
   */
  async *[Symbol.asyncIterator]() {
    for (; ;) {
      do {
        await this.wait();
      } while (this.#pending.length === 0);

      yield this.shift()!;
    }
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
   *
   * Due to the way JS' async code works, the caller still must check if there's an item available.
   */
  wait(): void | Promise<void> {
    if (this.#pending.length === 0) {
      return this.#promise.then(() => this.wait());
    }
  }

  /**
   * This is like {@link WorkQueue#wait}, but always returns a {@link Promise}.
   */
  async alwaysWait() {
    await this.wait();
  }

  /**
   * Takes a token for the next item from the front of the queue. The returned {@link Promise} will
   * always receive the next item, so don't throw it away.
   */
  async next(): Promise<T> {
    do {
      await this.wait();
    } while (this.#pending.length === 0);

    return this.shift()!;
  }

  /**
   * Push items into the queue. Wakes up any pending requests.
   */
  push(...items: T[]) {
    try {
      return this.#pending.push(...items);
    } finally {
      if (this.#pending.length) {
        this.#ready();
      }
    }
  }

  pop(): T | undefined {
    try {
      return this.#pending.pop();
    } finally {
      this.#maybeReset();
    }
  }

  /**
   * Push items at the start of the queue. Wakes up any pending requests.
   */
  unshift(...items: T[]) {
    try {
      return this.#pending.unshift(...items);
    } finally {
      if (this.#pending.length) {
        this.#ready();
      }
    }
  }

  shift(): T | undefined {
    try {
      return this.#pending.shift();
    } finally {
      this.#maybeReset();
    }
  }

  get length() {
    return this.#pending.length;
  }
}

