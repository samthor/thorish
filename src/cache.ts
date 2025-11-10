/**
 * A dead-simple cache helper.
 */
export class SimpleCache<K, V> {
  private readonly m = new Map<K, V>();
  constructor(private readonly gen: (k: K) => V) {}

  /**
   * Copies this as a regular {@link Map}.
   */
  copy(): Map<K, V> {
    return new Map(this.m);
  }

  has(k: K): boolean {
    return this.m.has(k);
  }

  get(k: K) {
    const prev = this.m.get(k);
    if (prev !== undefined) {
      return prev;
    }

    const value = this.gen(k);
    if (value !== undefined) {
      this.m.set(k, value);
    }
    return value;
  }

  get size() {
    return this.m.size;
  }

  clear() {
    this.m.clear();
  }

  keys() {
    return this.m.keys();
  }

  entries() {
    return this.m.entries();
  }

  values() {
    return this.m.values();
  }

  delete(k: K): boolean {
    return this.m.delete(k);
  }
}

/**
 * Return a helper which runs the passed function at most once.
 */
export function once<T = void>(fn: () => T) {
  let run = false;
  let result: T;
  return () => {
    if (!run) {
      run = true;
      result = fn();
    }
    return result;
  };
}

/**
 * Lazy {@link WeakMap} factory.
 */
export function lazyWeak<W extends Object, V>(fn: (w: W) => V): (w: W) => V {
  const wm = new WeakMap<W, V>();

  return (w: W): V => {
    let value = wm.get(w);
    if (value === undefined) {
      value = fn(w);
      wm.set(w, value);
    }
    return value;
  };
}
