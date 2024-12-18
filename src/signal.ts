/**
 * Ensures that a passed {@link Function} is called when the given {@link AbortSignal} is aborted.
 *
 * This calls inline if the signal is _already_ aborted.
 */
export function handleAbortSignalAbort(signal: AbortSignal | undefined, fn: () => any): void {
  if (signal?.aborted) {
    fn();
  } else {
    signal?.addEventListener('abort', fn);
  }
}

/**
 * Returns a {@link Promise} for the abort of the passed {@link AbortSignal}. Resolves with void/
 * `undefined` when done.
 */
export function promiseVoidForSignal(signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve());
  });
}

/**
 * Returns a {@link Promise} for the abort of the passed {@link AbortSignal}. This may be already
 * resolved/rejected if the signal is already aborted, rather than running in a microtask.
 *
 * By default, this rejects. Pass a second argument (even `null` or `undefined`) to resolve
 * 'safely'.
 */
export function promiseForSignal<T = never>(
  signal: AbortSignal,
  resolveWith?: Promise<T> | T,
): Promise<T> {
  if (resolveWith === undefined && arguments.length < 2) {
    // nb. we can't detect `undefined` otherwise, need to look at length
    resolveWith = Promise.reject<T>(new Error('aborted'));
  }
  if (signal.aborted) {
    return Promise.resolve(resolveWith!);
  }
  return new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve(resolveWith!));
  });
}

/**
 * Returns a new {@link AbortSignal} that can be individually aborted, but which is also tied to
 * the lifetimes of the passed signals. If any passed signals are aborted, the derived symbol also
 * aborts.
 *
 * If any passed signal is already aborted, returns one of them directly (not derived), with a no-op
 * abort function.
 */
export function derivedSignal(...raw: (AbortSignal | undefined)[]) {
  const previous = raw.filter(Boolean) as AbortSignal[];

  const previouslyAborted = previous.find((x) => x.aborted);
  if (previouslyAborted !== undefined) {
    return { signal: previouslyAborted, abort: () => {} };
  }

  const c = new AbortController();
  const abort = () => c.abort();
  previous.forEach((p) => p.addEventListener('abort', abort));
  return { signal: c.signal, abort };
}
