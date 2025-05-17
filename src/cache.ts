/**
 * A dead-simple cache helper.
 */
export class SimpleCache<K, V> {
  private m = new Map<K, V>();
  private gen: (k: K) => V;

  constructor(gen: (k: K) => V) {
    this.gen = gen;
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
