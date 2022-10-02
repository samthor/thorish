

/**
 * A set which allows the same value to be added many times.
 */
export class CountSet<T> {
  #m = new Map<T, number>();
  #count = 0;

  /**
   * The total number of values (aka, the number of calls to {@link CountSet#add}).
   */
  total() {
    return this.#count;
  }

  add(t: T): boolean {
    this.#m.set(t, (this.#m.get(t) ?? 0) + 1);
    ++this.#count;
    return true;
  }

  entries() {
    return this.#m.entries();
  }

  delete(t: T): boolean {
    const prev = this.#m.get(t);
    if (prev === undefined) {
      return false;
    }

    if (prev === 1) {
      this.#m.delete(t);
    } else {
      this.#m.set(t, prev - 1);
    }
    --this.#count;
    return true;
  }

  has(t: T): boolean {
    return this.#m.has(t);
  }

  uniques() {
    return this.#m.keys();
  }

  *keys(): IterableIterator<T> {
    for (const [t, count] of this.#m.entries()) {
      for (let i = 0; i < count; ++i) {
        yield t;
      }
    }
  }

}


/**
 * A set of pairs. Adding one side (e.g., `.add(a, b)`) is the same as adding the other (e.g.,
 * `.add(b, a)`).
 */
export class PairSet<K> {
  #m = new PairMap<K, boolean>();

  add(a: K, b: K): boolean {
    return this.#m.set(a, b, true);
  }

  delete(a: K, b: K): boolean {
    return this.#m.delete(a, b);
  }

  has(a: K, b: K): boolean {
    return this.#m.has(a, b);
  }

  hasAny(k: K): boolean {
    return this.#m.hasAny(k);
  }

  otherKeys(k: K): IterableIterator<K> {
    return this.#m.otherKeys(k);
  }

  pairsWith(k: K): number {
    return this.#m.pairsWith(k);
  }

}


/**
 * A map with a pair of keys. Both sides are added at once.
 */
export class PairMap<K, V> {
  #m = new Map<K, Map<K, V>>();

  #implicitGet(k: K) {
    const has = this.#m.get(k);
    if (has !== undefined) {
      return has;
    }
    const update = new Map();
    this.#m.set(k, update);
    return update;
  }

  set(a: K, b: K, v: V): boolean {
    const mapA = this.#implicitGet(a);
    if (mapA.get(b) === v) {
      return false;
    }

    mapA.set(b, v);
    this.#implicitGet(b).set(a, v);
    return true;
  }

  pairsWith(k: K): number {
    return this.#m.get(k)?.size ?? 0;
  }

  otherKeys(k: K): IterableIterator<K> {
    return this.#m.get(k)?.keys() ?? [][Symbol.iterator]();
  }

  otherEntries(k: K): IterableIterator<[K, V]> {
    return this.#m.get(k)?.entries() ?? [][Symbol.iterator]();
  }

  delete(a: K, b: K): boolean {
    const mapA = this.#m.get(a);
    if (!mapA?.has(b)) {
      return false;
    }

    mapA.delete(b);
    if (mapA.size === 0) {
      this.#m.delete(a);
    }

    const mapB = this.#m.get(b)!;
    mapB.delete(a);
    if (mapB.size === 0) {
      this.#m.delete(b);
    }

    return true;
  }

  has(a: K, b: K): boolean {
    return this.#m.get(a)?.has(b) ?? false;
  }

  hasAny(k: K): boolean {
    return this.#m.has(k);
  }

  get(a: K, b: K): V | undefined {
    return this.#m.get(a)?.get(b);
  }
}


/**
 * A map which itself contains a set of items.
 */
export class MultiMap<K, V> {
  #m = new Map<K, Set<V>>();

  add(k: K, v: V): boolean {
    let set = this.#m.get(k);
    if (set === undefined) {
      set = new Set();
      this.#m.set(k, set);
    }
    if (set.has(v)) {
      return false;
    }
    set.add(v);
    return true;
  }

  delete(k: K, v: V): boolean {
    const set = this.#m.get(k);
    return set?.delete(v) ?? false;
  }

  has(k: K, v: V): boolean {
    return this.#m.get(k)?.has(v) ?? false;
  }

  count(k: K): number {
    return this.#m.get(k)?.size ?? 0;
  }

  get(k: K): Iterable<V> {
    return this.#m.get(k) ?? [];
  }

}
