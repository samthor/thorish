
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
