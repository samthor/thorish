import { lazyWeak } from './cache.ts';
import { promiseWithResolvers } from './promise.ts';

const notifyMap = /* @__PURE__ */ lazyWeak((host) => new Set<(arg: boolean) => void>());

/**
 * Wait for a later {@link objectNotify} or {@link objectNotifyAll} call on this {@link Object}.
 *
 * This will resolve with `true` if notified.
 *
 * The returned {@link Promise} here represents a token that is triggered with {@link objectNotify}.
 * You should abort the passed signal if you are no longer interested, in which case it will be resolved with `false` (rather than rejecting).
 */
export function objectWait(host: Object, signal?: AbortSignal): Promise<boolean> {
  signal?.throwIfAborted();

  const { promise, resolve } = promiseWithResolvers<boolean>();
  const s = notifyMap(host);
  s.add(resolve);

  signal?.addEventListener('abort', () => {
    s.delete(resolve);
    resolve(false);
  });

  return promise;
}

/**
 * Notifies a waiter on this {@link Object} in a microtask.
 *
 * Returns `true` if one was woken up, `false` otherwise.
 */
export function objectNotify(host: Object): boolean {
  const all = notifyMap(host);
  for (const cb of all) {
    all.delete(cb);
    Promise.resolve().then(() => cb(true));
    return true;
  }
  return false;
}

/**
 * Notifies all waiters for this {@link Object} in independent microtasks.
 *
 * Returns the count of waiters woken up.
 */
export function objectNotifyAll(host: Object): number {
  const all = notifyMap(host);
  const targets = [...all];
  all.clear();

  for (const cb of targets) {
    Promise.resolve().then(() => cb(true));
  }

  return targets.length;
}
