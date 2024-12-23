import { promiseWithResolvers, unresolvedPromise } from './promise.js';
import { AbortSignalArgs } from './types.js';
import type { WorkQueue } from './queue.js';
import { promiseForSignal, symbolAbortSignal } from './internal.js';

/**
 * Combines the N passed async generators into a single generator which yields items in order,
 * including the index of the generator that emitted it. If no generators are passed, returns
 * immediately.
 *
 * This also supports merging synchronous generators, but always returns a {@link AsyncGenerator}.
 *
 * This returns all return values of the passed generators only once all are done. This does not
 * support the `TNext` template.
 */
export async function* combineAsyncGenerators<T, Y = void>(
  gen: (AsyncGenerator<T, Y, void> | Generator<T, Y, void>)[],
): AsyncGenerator<{ index: number; value: T }, Y[], void> {
  gen = gen.slice(); // copy

  const buildNext = async (index: number) => {
    const p = gen[index].next();
    const res = await p;
    return { index, res };
  };

  const nexts = gen.map((_, index) => buildNext(index));
  let doneCount = 0;
  const doneValues: Y[] = new Array(gen.length);

  while (doneCount !== gen.length) {
    const next = await Promise.race(nexts);

    if (next.res.done) {
      // Put an unresolvable promise here so it'll never resolve again and `Promise.race` will
      // ignore it.
      nexts[next.index] = unresolvedPromise;
      doneValues[next.index] = next.res.value;
      ++doneCount;
    } else {
      // We got a value on this generator! Reset it for next time.
      nexts[next.index] = buildNext(next.index);
      yield { index: next.index, value: next.res.value };
    }
  }

  return doneValues;
}

/**
 * Builds a {@link AsyncGenerator} which is the result of repeatedly calling the passed handler
 * function.
 *
 * Returns if a rejected {@link AbortSignal} promise is yielded, as generated by
 * {@link promiseForSignal} or {@link AbortSignal.prototype.throwIfAborted}.
 */
export async function* asyncGeneratorForHandler<T>(
  handler: () => Promise<T>,
  args?: AbortSignalArgs,
): AsyncGenerator<T, void, void> {
  const signalPromise = promiseForSignal(args?.signal);

  for (;;) {
    let v: T;
    try {
      const p = handler();
      v = await Promise.race([signalPromise, p]);
    } catch (e) {
      if (e === symbolAbortSignal) {
        return;
      }
      throw e;
    }
    yield v;
  }
}

/**
 * The return type of {@link asyncGeneratorQueue}.
 */
export type AsyncGeneratorQueueReturn<T, Y> = {
  generator: AsyncGenerator<T, Y, void>;

  /**
   * Push a value into the generator.
   */
  push: (arg: T | Promise<T>) => void;

  /**
   * Mark the generator as done, optionally providing a return value.
   */
  done: (arg: Y | Promise<Y>) => void;
};

const doneSymbol = /* @__PURE__ */ Symbol('done');

/**
 * Creates an async generator which emits values pushed into it.
 *
 * This a much simpler version of {@link WorkQueue}.
 */
export function asyncGeneratorQueue<T, Y = void>(): AsyncGeneratorQueueReturn<T, Y> {
  let { promise, resolve } = promiseWithResolvers<void>();
  let isDone = false;

  const pending: (Promise<T> | T | typeof doneSymbol)[] = [];
  const push = (t: Promise<T> | T): void => {
    if (isDone) {
      throw new Error("Can't push into completed asyncGeneratorQueue");
    }

    pending.push(t);
    resolve();
  };

  let doneValue: Promise<Y> | Y | undefined;
  const done = (y: Promise<Y> | Y): void => {
    if (isDone) {
      throw new Error("Can't complete already completed asyncGeneratorQueue");
    }

    pending.push(doneSymbol);
    isDone = true;
    doneValue = y;
    resolve();
  };

  const generator = (async function* (): AsyncGenerator<T, Y, void> {
    for (;;) {
      await promise;

      while (pending.length) {
        const next = pending.shift()!;
        if (next === doneSymbol) {
          return doneValue!;
        }

        yield next;
      }

      ({ promise, resolve } = promiseWithResolvers<void>());
    }
  })();

  return {
    generator,
    push,
    done,
  };
}

const doneAsyncGenerator = /* @__PURE__ */ (async function* () {})() as AsyncGenerator<any>;

/**
 * Given a {@link AsyncGenerator}, provides a helper which returns 'clones' that will eventually
 * consume the underlying generator and cache the entire result.
 *
 * This should not be used for generators which never complete as every value will be cached here.
 */
export class AsyncGeneratorCache<T, Y> {
  #knownValues: T[] = [];
  #done = false;
  #doneValue: Y | undefined;
  #pendingPromise: Promise<void> | undefined;
  #gen: AsyncGenerator<T, Y, void>;

  constructor(gen: AsyncGenerator<T, Y, void>) {
    this.#gen = gen;
  }

  #waitFor() {
    if (this.#pendingPromise) {
      return this.#pendingPromise;
    }
    return (this.#pendingPromise = this.#gen.next().then((res) => {
      if (res.done) {
        this.#done = true;
        this.#doneValue = res.value;
        this.#gen = doneAsyncGenerator; // let go of original 'gen'
      } else {
        this.#knownValues.push(res.value as T);
        this.#pendingPromise = undefined;
      }
    }));
  }

  async *read() {
    let at = 0;

    for (;;) {
      while (at < this.#knownValues.length) {
        yield this.#knownValues[at];
        ++at;
      }
      if (this.#done) {
        return this.#doneValue;
      }

      // We're now waiting for another item, so force calling `gen.next()`.
      await this.#waitFor();
    }
  }

  get done() {
    return this.#done;
  }

  knownValues(): Readonly<T[]> {
    return this.#knownValues;
  }
}
