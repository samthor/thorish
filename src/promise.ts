
import { DOMException } from './support/index.js';


/**
 * A {@link Promise} that will never resolve.
 */
export const unresolvedPromise = new Promise<never>(() => {});


/**
 * Wraps a trigger function (e.g., {@link setTimeout} or {@link requestAnimationFrame}) and returns
 * a {@link Promise} that resolves when it is fired.
 *
 * Using {@link setInterval} is _not_ a good candidate for this function.
 */
export function wrapTrigger<TCallbackParam = void, TArgs extends any[] = []>(trigger: (callback: (arg: TCallbackParam) => any, ...moreArgs: TArgs) => any, ...moreArgs: TArgs): Promise<TCallbackParam> {
  return new Promise((resolve) => {
    trigger(resolve, ...moreArgs);
  });
}


/**
 * Sets a timeout via {@link Promise}.
 */
export const timeout = (duration: number) => wrapTrigger(setTimeout, duration);


/**
 * Builds a resolvable object.
 */
export function resolvable<T = void>(): {
  resolve: (value: T) => void;
  reject: (value: any) => void;
  promise: Promise<T>;
} {
  let resolve, reject;
  const promise = new Promise<T>((localResolve, localReject) => {
    resolve = localResolve;
    reject = localReject;
  });

  return { resolve, reject, promise };
}


/**
 * Returns a {@link Promise} that rejects with a {@link DOMException} when the passed
 * {@link AbortSignal} aborts (or rejected immediately, if already aborted).
 */
export async function promiseForSignal(signal?: AbortSignal): Promise<never> {
  if (signal === undefined) {
    return unresolvedPromise;
  } else if (signal.throwIfAborted) {
    // only exists in fairly recent DOM
    signal.throwIfAborted();
  } else if (signal.aborted) {
    if (signal.reason === undefined) {
      throw new DOMException('AbortError', 'This operation was aborted');
    }
    // This matches `throwIfAborted`.
    throw signal.reason;
  }
  return new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () =>
      reject(new DOMException('AbortError')),
    );
  });
}


/**
 * Checks if the passed var is a {@link DOMException} of message `"AbortError"`.
 *
 * TODO(samthor): This is used a bit but isn't that useful as a signal can just throw its random
 * `.reason` prop, which can literally be a string or whatever.
 */
export function isSignalAbortException(e: any): e is DOMException {
  return e instanceof DOMException && e.message === 'AbortError';
}


/**
 * Returns a {@link Promise} that resolves after a the first event of the given name is fired.
 *
 * This doesn't correctly infer the type of the {@link Event}, but you can specify it via template.
 */
export function promiseForEvent<X extends Event = Event>(target: EventTarget, eventName: string, options: Partial<{ passive: boolean, signal: AbortSignal }> = {}): Promise<X> {
  if (options.signal?.aborted) {
    return Promise.reject(new DOMException('AbortError'));
  }
  return new Promise<X>((resolve, reject) => {
    options.signal?.addEventListener('abort', () =>
      reject(new DOMException('AbortError')),
    );
    target.addEventListener(eventName, (e) => resolve(e as X), { ...options, once: true });
  });
}


/**
 * Helper which finds the next completed promise (using {@link Promise.race}) from the given array,
 * removing it from the passed array. This is O(n) with the number of elements, as each element
 * must be wrapped in an additional {@link Promise} that includes the index.
 *
 * Returns `undefined` if the array was empty. This is unlike {@link Promise.race}, which will wait
 * forever.
 */
export async function spliceNextPromise<T>(arr: Promise<T>[]): Promise<T | undefined> {
  if (!arr.length) {
    return undefined;
  }

  const internal = arr.map((x, i) => x.then((ret) => ({ret, i})));
  const next = await Promise.race(internal);

  arr.splice(next.i, 1);

  return next.ret;
}
