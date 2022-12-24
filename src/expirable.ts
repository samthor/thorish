
export interface ExpirableResult<R> {
  signal: AbortSignal;
  result: R;
}


/**
 * Caches the call to an async {@link Function}, which returns a result and a {@link AbortSignal}.
 *
 * When the signal is aborted, the result is cleared and new calls trigger the underlying function
 * again.
 */
export function buildAsyncExpirable<R>(fn: () => Promise<ExpirableResult<R>>): () => Promise<ExpirableResult<R>> {
  let activePromise: Promise<ExpirableResult<R>> | undefined;

  return () => {
    if (activePromise !== undefined) {
      return activePromise;
    }

    activePromise = fn().then((ret) => {
      if (ret.signal.aborted) {
        activePromise = undefined;
      } else {
        ret.signal.addEventListener('abort', () => activePromise = undefined);
      }
      return ret;
    });

    return activePromise;
  };
}


export function buildExpirable<R>(fn: () => ExpirableResult<R>): () => ExpirableResult<R> {
  let active: ExpirableResult<R> | undefined;

  return (): ExpirableResult<R> => {
    if (active !== undefined) {
      return active;
    }

    const localActive = fn();
    if (!localActive.signal.aborted) {
      active = localActive;
      localActive.signal.addEventListener('abort', () => active = undefined);
    }
    return localActive;
  };
}