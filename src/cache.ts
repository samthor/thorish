
/**
 * A dead-simple cache helper.
 */
export class SimpleCache<K, V> {
  #m = new Map<K, V>();
  #gen: (k: K) => V;

  constructor(gen: (k: K) => V) {
    this.#gen = gen;
  }

  get(k: K) {
    const prev = this.#m.get(k);
    if (prev !== undefined) {
      return prev;
    }

    const value = this.#gen(k);
    if (value !== undefined) {
      this.#m.set(k, value);
    }
    return value;
  }

  get size() {
    return this.#m.size;
  }

  clear() {
    this.#m.clear();
  }

}
