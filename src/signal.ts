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
 * `undefined` when done, rather than the `reason` property.
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
 * By default, this rejects with the signal's `reason`. Pass a second argument (even `null` or
 * `undefined`) to resolve with this value, instead (e.g., `Promise.reject(...)`).
 */
export function promiseForSignal<T = never>(
  signal: AbortSignal,
  resolveWith?: Promise<T> | T,
): Promise<T> {
  if (resolveWith === undefined && arguments.length < 2) {
    // nb. we can't detect `undefined` otherwise, need to look at length
    if (signal.aborted) {
      return Promise.reject(signal.reason);
    }
    return new Promise((reject) => signal.addEventListener('abort', () => reject(signal.reason)));
  }

  if (signal.aborted) {
    return Promise.resolve(resolveWith!);
  }
  return new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve(resolveWith!));
  });
}

/**
 * Polyfilled version of link {@link AbortSignal.any}.
 */
const abortSignalAny = /* @__PURE__ */ (() =>
  AbortSignal.any
    ? AbortSignal.any
    : (all: AbortSignal[]) => {
        const previouslyAborted = all.find((x) => x.aborted);
        if (previouslyAborted !== undefined) {
          return previouslyAborted;
        }

        const c = new AbortController();
        all.forEach((p) => p.addEventListener('abort', () => c.abort(p.reason)));
        return c.signal;
      })();

const buildTimeout = () =>
  new DOMException('The operation was aborted due to timeout', 'TimeoutError');

/**
 * Wraps {@link AbortSignal.timeout} to deal with Chrome's "TimeoutError" issue (before Chrome 123, it reported "AbortError").
 */
export function abortSignalTimeout(timeout: number) {
  const c = new AbortController();

  const s = AbortSignal.timeout(timeout);
  s.addEventListener('abort', () => {
    if (s.reason instanceof DOMException && s.reason.name === 'TimeoutError') {
      c.abort(s.reason);
    } else {
      // Chrome briefly emitted AbortError [103,123]
      c.abort(buildTimeout());
    }
  });

  return c.signal;
}

/**
 * Returns a new {@link AbortSignal} which aborts on the next tick.
 *
 * Aborts with "TimeoutError", just like {@link AbortSignal.timeout}.
 */
export function tickAbortSignal() {
  const c = new AbortController();

  Promise.resolve().then(() => c.abort(buildTimeout()));

  return c.signal;
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
  abort: (reason?: any) => void;
} {
  const previous = raw.filter(Boolean) as AbortSignal[];

  const c = new AbortController();
  previous.push(c.signal);

  const signal = abortSignalAny(previous);
  const abort = (reason?: any) => c.abort(reason ?? 'aborted');

  return { signal, abort };
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
export const neverAbortedSignal = /* @__PURE__ */ (() => new AbortController().signal)();

/**
 * A TODO signal, used as a placeholder until you can find a better one.
 *
 * This is the same as {@link neverAbortedSignal}.
 */
export const todoSignal = neverAbortedSignal;
