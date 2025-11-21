import { abortedSignal, derivedSignal, neverAbortedSignal } from './signal.ts';

export type NamedListeners<T extends Record<string, any>> = {
  /**
   * Adds a listener for the given event. You must provide a {@link AbortSignal}.
   */
  addListener<K extends keyof T>(
    name: K,
    listener: (data: T[K]) => void,
    signal: AbortSignal,
  ): void;

  /**
   * Dispatches an event to listeners.
   *
   * Returns `true` if any listeners were invoked.
   */
  dispatch<K extends keyof T>(name: K, ...a: T[K] extends void ? [undefined?] : [T[K]]): boolean;

  /**
   * Runs a handler when any listeners are defined for the given name.
   */
  any<K extends keyof T>(name: K, handler: (signal: AbortSignal) => void, signal?: AbortSignal);

  /**
   * Synchronous check to see if anyone is listening to the given event.
   */
  hasAny<K extends keyof T>(name: K): boolean;

  /**
   * Converts this {@link NamedListeners} to an {@link EventTarget}.
   *
   * The types here a bit funky.
   * You need to specify the types as a template parameter and ALSO provide a builder in the argument.
   */
  eventTarget<X extends Partial<Record<keyof T, Event>>>(arg?: {
    signal?: AbortSignal;
    buildEvent?: <T extends keyof X>(type: T, arg: X[T]) => Event | undefined; // TODO: not inferred as well as we'd like
  }): InstanceType<
    AddEvents<typeof EventTarget, { [Q in keyof T]: Q extends keyof X ? X[Q] : CustomEvent<T[Q]> }>
  >;
};

export type SoloListener<V> = {
  addListener(listener: (data: V) => void, signal: AbortSignal): void;
  dispatch(data: V): boolean;
  any(handler: (signal: AbortSignal) => void, signal?: AbortSignal);
  hasAny(): boolean;
};

type InternalListener = {
  listeners: Set<(data: any) => void>;
  any: Set<(signal: AbortSignal) => void>;
  activeSignal: AbortSignal;
  abort: (reason: any) => void;
};

/**
 * Creates a typed, simple named listeners helper.
 *
 * This is a simpler version of something with {@link EventTarget}-like semantics.
 */
export function namedListeners<T extends Record<string, any>>(): NamedListeners<T> {
  const listeners = new Map<keyof T, InternalListener>();

  const ensureListener = <K extends keyof T>(type: K) => {
    let s = listeners.get(type);
    if (s === undefined) {
      s = {
        listeners: new Set(),
        any: new Set(),
        activeSignal: abortedSignal,
        abort: () => {},
      };
      listeners.set(type, s);
    }
    return s;
  };

  return {
    addListener(name, listener, signal) {
      if (signal.aborted) {
        return;
      }

      const state = ensureListener(name);

      if (state.listeners.has(listener)) {
        const original = listener;
        listener = (arg) => original(arg);
      } else if (state.listeners.size === 0) {
        const c = new AbortController();
        state.activeSignal = c.signal;
        state.abort = (reason: any) => c.abort(reason);
        state.any.forEach((l) => l(state.activeSignal));
      }

      signal.addEventListener('abort', () => {
        state.listeners.delete(listener);
        if (state.listeners.size === 0) {
          state.abort(`no more listeners for: ${String(name)}`);
        }
      });
      state.listeners.add(listener);
    },

    any(name, callback, signal) {
      if (signal?.aborted) {
        return;
      }

      const state = ensureListener(name);

      if (state.any.has(callback)) {
        const original = callback;
        callback = (arg) => original(arg);
      }
      state.any.add(callback);

      signal?.addEventListener('abort', () => state.any.delete(callback));

      if (state.listeners.size) {
        // trigger immediately if active
        callback(derivedSignal(state.activeSignal, signal).signal);
      }
    },

    hasAny(name): boolean {
      return listeners.has(name);
    },

    // @ts-expect-error TS is confused because it thinks we should use `...arg`
    dispatch(name, arg) {
      const s = listeners.get(name);
      s?.listeners.forEach((l) => l(arg));
      return Boolean(s?.listeners.size);
    },

    eventTarget(arg) {
      return namedListenersToEventTarget(this as any, arg) as any;
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
    any(callback, signal) {
      nl.any(name, callback, signal);
    },
    hasAny() {
      return nl.hasAny(name);
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

  let abort: (reason: any) => void;

  if (once) {
    const c = new AbortController();

    const originalFn = fn;
    fn = (e) => {
      c.abort('once');
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
function namedListenersToEventTarget<T extends Record<string, any>>(
  nl: NamedListeners<T>,
  opts?: {
    signal?: AbortSignal;
    buildEvent?: <K extends keyof T>(type: K, arg: T[K]) => Event | undefined;
  },
): EventTarget {
  const addedByRef = new Map<string, Map<any, (reason: any) => void>>();
  const addByRef = (
    type: string,
    ref: any,
    signal: AbortSignal,
    abort: (reason: any) => void,
  ): boolean => {
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
      prev?.('removed');
    },
  };
}

//// --- type stuff ----

// From here:
// https://fettblog.eu/typescript-union-to-intersection/
type UnionToIntersection<T> = (T extends any ? (x: T) => any : never) extends (x: infer R) => any
  ? R
  : never;

/**
 * Generates a type which provides a highly specific addEventListener/removeEventListener. This is
 * required due to TS' resolution rules which place string literals first.
 */
type ExpandEventsInternal<K extends keyof T, T, This> = K extends string
  ? {
      addEventListener(
        type: K,
        listener: (this: EventTarget, ev: T[K]) => any,
        options?: boolean | AddEventListenerOptions,
      ): void;
      removeEventListener(
        type: K,
        listener: (this: EventTarget, ev: T[K]) => any,
        options?: boolean | AddEventListenerOptions,
      ): void;
    }
  : never;

/**
 * This expands the events specified in the template type map.
 */
type ExpandEvents<T, This> = UnionToIntersection<ExpandEventsInternal<keyof T, T, This>>;

/**
 * Creates a constructor which includes expanded events as well as the original type.
 */
type AddEvents<
  X extends abstract new (...args: any[]) => InstanceType<X> extends EventTarget ? any : never,
  T,
> = new (...args: ConstructorParameters<X>) => ExpandEvents<T, X> & InstanceType<X>;
