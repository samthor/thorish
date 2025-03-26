import { derivedSignal, neverAbortedSignal } from './signal.ts';

export type NamedListeners<T extends Record<string, any>> = {
  addListener<K extends keyof T>(
    name: K,
    listener: (data: T[K]) => void,
    signal: AbortSignal,
  ): void;
  dispatch<K extends keyof T>(name: K, arg: T[K]): boolean;
};

export type SoloListener<V> = {
  addListener(listener: (data: V) => void, signal: AbortSignal): void;
  dispatch(data: V): boolean;
};

/**
 * Creates a typed, simple named listeners helper.
 *
 * This is a simpler version of something with {@link EventTarget}-like semantics.
 */
export function namedListeners<T extends Record<string, any>>(): NamedListeners<T> {
  const listeners = new Map<keyof T, Set<(data: any) => void>>();

  return {
    addListener(name, listener, signal) {
      if (signal.aborted) {
        return;
      }

      let s = listeners.get(name);
      if (s === undefined) {
        s = new Set();
        listeners.set(name, s);
      }

      if (s.has(listener)) {
        const original = listener;
        listener = (arg) => original(arg);
      }

      signal.addEventListener('abort', () => s.delete(listener));
      s.add(listener);
    },

    dispatch(name, arg) {
      const s = listeners.get(name);
      s?.forEach((l) => l(arg));
      return Boolean(s?.size);
    },
  };
}

/**
 * Wraps a provided {@link NamedListeners} to target a specific one of its events.
 */
export function soloListenerFrom<T extends Record<string, any>, K extends keyof T>(
  name: K,
  nl: NamedListeners<T>,
): SoloListener<T[K]> {
  return {
    addListener(listener: (data: T[K]) => void, signal: AbortSignal): void {
      nl.addListener(name, listener, signal);
    },
    dispatch(v: T[K]) {
      return nl.dispatch(name, v);
    },
  };
}

/**
 * Creates a {@link SoloListener} for dispatching events.
 */
export function soloListener<V>(): SoloListener<V> {
  const nl = namedListeners<{ '': V }>();
  return soloListenerFrom('', nl);
}

function coeerceOptions(options?: AddEventListenerOptions | boolean) {
  if (typeof options === 'object') {
    return { once: options.once, signal: options.signal };
  }
  return { once: false, signal: undefined };
}

function buildForRef(
  overallSignal: AbortSignal | undefined,
  callback: EventListenerOrEventListenerObject,
  options?: AddEventListenerOptions | boolean,
) {
  let { once, signal } = coeerceOptions(options);
  let fn: (e: Event) => void;
  if ('handleEvent' in callback) {
    fn = (e) => callback.handleEvent(e);
  } else {
    fn = callback;
  }

  let abort: () => void;

  if (once) {
    const c = new AbortController();

    const originalFn = fn;
    fn = (e) => {
      c.abort();
      originalFn(e);
    };

    ({ signal, abort } = derivedSignal(c.signal, overallSignal, signal));
  } else if (!signal && !overallSignal) {
    // short-circuit for no way to be removed
    signal = neverAbortedSignal;
    abort = () => {};
  } else {
    // if signal/overallSignal are undefined, never aborts
    ({ signal, abort } = derivedSignal(signal, overallSignal));
  }

  return { ref: callback, signal, fn, abort };
}

/**
 * Wraps {@link NamedListeners} into a normal {@link EventTarget}.
 *
 * This object cannot be used to dispatch events, only {@link EventTarget#addEventListener} and {@link EventTarget#removeEventListener}.
 */
export function namedListenersToEventTarget<T extends Record<string, any>>(
  nl: NamedListeners<T>,
  opts?: {
    signal?: AbortSignal;
    buildEvent?: <K extends keyof T>(type: K, arg: T[K]) => Event | undefined;
  },
): EventTarget {
  const addedByRef = new Map<string, Map<any, () => void>>();
  const addByRef = (type: string, ref: any, signal: AbortSignal, abort: () => void): boolean => {
    if (signal.aborted) {
      return false;
    }

    let forType = addedByRef.get(type);
    if (forType === undefined) {
      forType = new Map();
      addedByRef.set(type, forType);
    }
    if (forType.has(ref)) {
      return false;
    }
    forType.set(ref, abort);
    signal.addEventListener('abort', () => forType.delete(ref));
    return true;
  };

  const { signal: overallSignal, buildEvent } = opts ?? {};

  return {
    addEventListener(
      type: string,
      callback: EventListenerOrEventListenerObject | null,
      options?: AddEventListenerOptions | boolean,
    ): void {
      if (!callback) {
        return;
      }
      const { ref, signal, abort, fn } = buildForRef(overallSignal, callback, options);
      if (!addByRef(type, ref, signal, abort)) {
        return;
      }

      const boundFn = (raw: any) => {
        // call the addEventListener with an actual Event
        const e = buildEvent?.(type, raw) || new CustomEvent(type, { detail: raw });
        if (!(e instanceof Event) || e.type !== type) {
          throw new Error(
            `buildEvent must return Event with type=${type}, ${e instanceof Event ? e.type : '?'}`,
          );
        }
        fn.call(this, e);
      };
      nl.addListener(type, boundFn, signal);
    },

    dispatchEvent(event: Event): boolean {
      throw new Error('dispatchEvent unsupported');
    },

    removeEventListener(
      type: string,
      callback: EventListenerOrEventListenerObject | null,
      options?: EventListenerOptions | boolean,
    ): void {
      if (!callback) {
        return;
      }
      const prev = addedByRef.get(type)?.get(callback);
      prev?.();
    },
  };
}
