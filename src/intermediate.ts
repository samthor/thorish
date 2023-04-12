const stopSymbol = Symbol('stop');
const name = 'AsyncIntermediate';

export type AsyncIntermediateReturn<T, Y = void> = {
  /**
   * Generator which yields values sent into it as a queue.
   */
  gen: AsyncGenerator<Awaited<T>, Y, void>;

  /**
   * Sends a value into the generator, returning a {@link Promise} that resolves when the generator
   * resumes after the corresponding yield.
   *
   * Users of the generator must be careful to always ask for a further value, e.g., via a
   * `for await` loop.
   */
  send: (update: T | PromiseLike<T>) => Promise<void>;

  /**
   * Stops the generator, causing the user of it to recieve the passed return value. All previous
   * sends are allowed to complete first. Unlike {@link AsyncIntermediateReturn#send}, this
   * resolves before the generator "yields" the return value.
   */
  stop: (final: Y | PromiseLike<Y>) => Promise<void>;
};

/**
 * Builds a {@link AsyncGenerator} which only allows one value to be queued at a time.
 */
export function buildAsyncIntermediate<T, Y = void>(): AsyncIntermediateReturn<T, Y> {
  let wakeup = () => {};
  const pending: (
    | { value: T | PromiseLike<T>; resolve: () => void; done: false }
    | { value: Y | PromiseLike<Y>; resolve: () => void; done: true }
  )[] = [];

  const gen: AsyncGenerator<Awaited<T>, Y, void> = (async function* () {
    for (;;) {
      const next = pending.shift();
      if (next === undefined) {
        await new Promise<void>((r) => (wakeup = r));
        continue;
      }

      if (next.done) {
        next.resolve(); // resolve before return
        return next.value;
      }

      yield next.value;
      next.resolve(); // resolve after processed
    }
  })();

  const send = (value: T | PromiseLike<T>) => {
    return new Promise<void>((resolve) => {
      pending.push({ done: false, value, resolve });
      wakeup();
    });
  };

  const stop = (value: Y | PromiseLike<Y>) => {
    return new Promise<void>((resolve) => {
      pending.push({ done: true, value, resolve });
      wakeup();
    });
  };

  return { gen, send, stop };
}
