
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
 * Returns a {@link Promise} that resolves after a the first event of the given name is fired.
 *
 * This doesn't correctly infer the type of the {@link Event}, but you can specify it via template.
 *
 * If the {@link AbortSignal} is aborted, this will reject with an unspecified {@link Error}.
 */
export function promiseForEvent<X extends Event = Event>(target: EventTarget, eventName: string, options: Partial<{ passive: boolean, signal: AbortSignal }> = {}): Promise<X> {
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

  const internal = arr.map((x, i) => x.then((ret) => ({ret, i})));
  const next = await Promise.race(internal);

  arr.splice(next.i, 1);

  return next.ret;
}
