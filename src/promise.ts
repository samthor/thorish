
/**
 * Wraps a trigger function (e.g., {@link setTimeout} or {@link requestAnimationFrame}) and returns
 * a {@link Promise} that resolves when it is fired.
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
export function promiseForSignal(signal: AbortSignal) {
  if (signal.aborted) {
    return Promise.reject(new DOMException('AbortError'));
  }
  return new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () =>
      reject(new DOMException('AbortError')),
    );
  });
}
