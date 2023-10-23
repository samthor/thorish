/**
 * Ensures that a passed {@link Function} is called when the given {@link AbortSignal} is aborted.
 *
 * This may call inline if the signal is _already_ aborted.
 */
export function handleAbortSignalAbort(signal: AbortSignal | undefined, fn: () => any): void {
  if (signal?.aborted) {
    fn();
  } else {
    signal?.addEventListener('abort', fn);
  }
}

/**
 * Returns a {@link Promise} for the abort of the passed {@link AbortSignal}. This may be
 * resolved immediately.
 */
export function promiseForSignal<T = never>(
  signal: AbortSignal,
  resolveWith: Promise<T> | T = Promise.reject<T>(new Error('aborted')),
): Promise<T> {
  if (signal.aborted) {
    return Promise.resolve(resolveWith);
  } else {
    return new Promise((resolve) => {
      signal.addEventListener('abort', () => resolve(resolveWith));
    });
  }
}

/**
 * Returns a new {@link AbortSignal} that can be individually aborted, but which is also tied to
 * the lifetimes of the passed signals. If any passed signals are aborted, the derived symbol also
 * aborts.
 *
 * If any passed signal is already aborted, returns one of them directly (not derived).
 */
export function derivedSignal(...previous: AbortSignal[]) {
  const previouslyAborted = previous.find((x) => x.aborted);
  if (previouslyAborted !== undefined) {
    return { signal: previouslyAborted, abort: () => {} };
  }

  const c = new AbortController();
  const abort = () => c.abort();
  previous.forEach((p) => p.addEventListener('abort', abort));
  return { signal: c.signal, abort };
}
