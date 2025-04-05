/**
 * A {@link Promise} that will never resolve.
 */
export const unresolvedPromise = /* @__PURE__ */ new Promise<never>(() => {});

/**
 * A {@link Promise} that is already resolved.
 */
export const resolvedPromise = /* @__PURE__ */ Promise.resolve<void>(undefined);

/**
 * Wraps a trigger function (e.g., {@link setTimeout} or {@link requestAnimationFrame}) and returns
 * a {@link Promise} that resolves when it is fired.
 *
 * Using {@link setInterval} is _not_ a good candidate for this function.
 */
export function wrapTrigger<TCallbackParam = void, TArgs extends any[] = []>(
  trigger: (callback: (arg: TCallbackParam) => any, ...moreArgs: TArgs) => any,
  ...moreArgs: TArgs
): Promise<TCallbackParam> {
  return new Promise((resolve) => {
    trigger(resolve, ...moreArgs);
  });
}

/**
 * Sets a timeout via {@link Promise}.
 */
export const timeout = (duration: number) => wrapTrigger(setTimeout, duration);

/**
 * Wraps {@link Promise.withResolvers} with a polyfill.
 */
export const promiseWithResolvers = /* @__PURE__ */ (() =>
  // nb. needs fn call as esbuild doesn't understand @__PURE__ otherwise
  Promise.withResolvers
    ? (Promise.withResolvers.bind(Promise) as <T>() => PromiseWithResolvers<T>)
    : function localResolvable<T = void>(): PromiseWithResolvers<T> {
        let resolve, reject;
        const promise = new Promise<T>((localResolve, localReject) => {
          resolve = localResolve;
          reject = localReject;
        });
        return { resolve, reject, promise };
      })();

export const resolvable = promiseWithResolvers;

/**
 * Returns a {@link Promise} that resolves after a the first event of the given name is fired.
 *
 * This doesn't correctly infer the type of the {@link Event}, but you can specify it via template.
 *
 * If the {@link AbortSignal} is aborted, this will reject with an unspecified {@link Error}.
 */
export function promiseForEvent<X extends Event = Event>(
  target: EventTarget,
  eventName: string,
  options: Partial<{ passive: boolean; signal: AbortSignal }> = {},
): Promise<X> {
  if (options.signal?.aborted) {
    return Promise.reject();
  }
  return new Promise<X>((resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject());
    target.addEventListener(eventName, (e) => resolve(e as X), { ...options, once: true });
  });
}

/**
 * Helper which finds the next completed promise (using {@link Promise.race}) from the given array,
 * removing it from the passed array in-place. This is O(n) with the number of elements, as each
 * element must be wrapped in an additional {@link Promise} that includes the index.
 *
 * Returns `undefined` if the array was empty. This is unlike {@link Promise.race}, which will wait
 * forever.
 */
export async function spliceNextPromise<T>(arr: Promise<T>[]): Promise<T | undefined> {
  if (!arr.length) {
    return undefined;
  }

  const internal = arr.map((x, i) => x.then((ret) => ({ ret, i })));
  const next = await Promise.race(internal);

  arr.splice(next.i, 1);

  return next.ret;
}

/**
 * Wrap a simple {@link Function} that returns a {@link Promise} such that, if many calls are made
 * while it is resolving, the next callers "join" the train and get the same result.
 *
 * This is a simple memoize implementation.
 */
export function buildCallTrain<R>(fn: () => Promise<R>): () => Promise<R> {
  let activePromise: Promise<R> | undefined;

  return () => {
    if (!activePromise) {
      activePromise = fn().then((ret) => {
        activePromise = undefined;
        return ret;
      });
    }
    return activePromise;
  };
}

export type RunnerOptions = {
  immediate?: boolean;

  /**
   * Prevent the final callback from running if this {@link AbortSignal} is aborted.
   */
  signal?: AbortSignal;
};

/**
 * Builds a {@link requestAnimationFrame} runner, which runs the callback at most once per frame.
 *
 * Accepts options: `immediate` to queue immediately, and `signal` which is checked before the callback is finally run.
 * If the passed {@link AbortSignal} is aborted, the returned `Promise` is rejected with its `reason`, but is internally read to prevent unhandled exceptions.
 */
export function rafRunner<T = void>(callback: () => T, options?: RunnerOptions): () => Promise<T> {
  return internalBuildRunner(requestAnimationFrame, callback, options);
}

/**
 * Builds a next-tick runner, which runs the callback at most once per tick.
 *
 * Accepts options: `immediate` to queue immediately, and `signal` which is checked before the callback is finally run.
 * If the passed {@link AbortSignal} is aborted, the returned `Promise` is rejected with its `reason`, but is internally read to prevent unhandled exceptions.
 */
export function tickRunner<T = void>(callback: () => T, options?: RunnerOptions): () => Promise<T> {
  return internalBuildRunner((m) => Promise.resolve().then(m), callback, options);
}

function internalBuildRunner<T = void>(
  runner: (cb: () => void) => any,
  callback: () => T,
  options?: RunnerOptions,
): () => Promise<T> {
  const { immediate, signal } = options ?? {};

  let activePromise: Promise<T> | undefined;

  const o = () => {
    if (activePromise === undefined) {
      activePromise = new Promise((resolve, reject) => {
        runner(() => {
          activePromise = undefined;
          if (signal?.aborted) {
            reject(signal.reason);
          } else {
            resolve(callback());
          }
        });
      });
      // prevent nodeJS or friends from exploding
      activePromise.catch(() => {});
    }

    return activePromise;
  };

  immediate && o();

  return o;
}
