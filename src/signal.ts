/**
 * Configures a function to run after this signal is aborted. This always run in its own microtask
 * (either as an event handler, or immediately via {@link Promise.resolve}).
 *
 * Returns a method which can be used to remove this handler. Returns `true` if it had not yet been
 * run.
 */
export function afterSignal(signal: AbortSignal, fn: () => any): () => boolean {
  let shouldRun = true;

  if (signal.aborted) {
    Promise.resolve().then(() => {
      if (!shouldRun) {
        return;
      }
      shouldRun = false;
      fn();
    });

    return () => {
      try {
        return shouldRun;
      } finally {
        shouldRun = false;
      }
    };
  }

  const wrap = () => {
    shouldRun = false;
    fn();
  };
  signal.addEventListener('abort', wrap);
  return () => {
    if (shouldRun) {
      signal.removeEventListener('abort', wrap); // irony of not using abortsignal is high
      shouldRun = false;
      return true;
    }
    return false;
  };
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
 *
 * If no signals are passed, acts as a pure convenience over creating a proper
 * {@link AbortController}, and the result can be destructured.
 */
export function derivedSignal(...raw: (AbortSignal | undefined)[]): {
  signal: AbortSignal;
  abort: () => void;
} {
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

/**
 * An already aborted signal.
 */
export const abortedSignal = /* @__PURE__ */ (() => {
  const c = new AbortController();
  c.abort();
  return c.signal;
})();

/**
 * A never aborted signal.
 */
export const neverAbortedSignal = /* @__PURE__ */ new AbortController().signal;
