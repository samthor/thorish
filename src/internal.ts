import { unresolvedPromise } from './promise.js';


/**
 * Returns a {@link Promise} that rejects with {@link symbolAbortSignal} when aborted.
 */
export async function promiseForSignal(signal?: AbortSignal): Promise<never> {
  if (signal === undefined) {
    return unresolvedPromise;
  } else if (!signal.aborted) {
    await new Promise((resolve) => signal.addEventListener('abort', resolve));
  }
  throw symbolAbortSignal;
}


/**
 * Symbol used in throw/catch blocks.
 */
export const symbolAbortSignal = Symbol('known');
