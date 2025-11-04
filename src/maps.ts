/**
 * A set which allows the same value to be added many times.
 */
export class CountSet<T> {
  private readonly m = new Map<T, number>();
  private count = 0;

  /**
   * The total number of values (aka, the number of calls to {@link CountSetprivate add}).
   */
  total() {
    return this.count;
  }

  add(t: T): boolean {
    this.m.set(t, (this.m.get(t) ?? 0) + 1);
    ++this.count;
    return true;
  }

  entries() {
    return this.m.entries();
  }

  delete(t: T): boolean {
    const prev = this.m.get(t);
    if (prev === undefined) {
      return false;
    }

    if (prev === 1) {
      this.m.delete(t);
    } else {
      this.m.set(t, prev - 1);
    }
    --this.count;
    return true;
  }

  has(t: T): boolean {
    return this.m.has(t);
  }

  uniques() {
    return this.m.keys();
  }

  *keys(): IterableIterator<T> {
    for (const [t, count] of this.m.entries()) {
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
  private readonly m = new PairMap<K, boolean>();

  size(): number {
    return this.m.size();
  }

  add(a: K, b: K): boolean {
    return this.m.set(a, b, true);
  }

  delete(a: K, b: K): boolean {
    return this.m.delete(a, b);
  }

  has(a: K, b: K): boolean {
    return this.m.has(a, b);
  }

  hasAny(k: K): boolean {
    return this.m.hasAny(k);
  }

  otherKeys(k: K): IterableIterator<K> {
    return this.m.otherKeys(k);
  }

  pairsWith(k: K): number {
    return this.m.pairsWith(k);
  }

  keys(): IterableIterator<K> {
    return this.m.keys();
  }

  pairs(): IterableIterator<[K, K]> {
    return this.m.pairs();
  }

  clear() {
    this.m.clear();
  }
}

/**
 * A map with a pair of keys. Both sides are added at once.
 */
export class PairMap<K, V> {
  private readonly m = new Map<K, Map<K, V>>();

  private implicitGet(k: K) {
    const has = this.m.get(k);
    if (has !== undefined) {
      return has;
    }
    const update = new Map();
    this.m.set(k, update);
    return update;
  }

  set(a: K, b: K, v: V): boolean {
    const mapA = this.implicitGet(a);
    if (mapA.get(b) === v) {
      return false;
    }

    mapA.set(b, v);
    this.implicitGet(b).set(a, v);
    return true;
  }

  size(): number {
    return this.m.size;
  }

  pairsWith(k: K): number {
    return this.m.get(k)?.size ?? 0;
  }

  otherKeys(k: K): IterableIterator<K> {
    return this.m.get(k)?.keys() ?? [][Symbol.iterator]();
  }

  otherEntries(k: K): IterableIterator<[K, V]> {
    return this.m.get(k)?.entries() ?? [][Symbol.iterator]();
  }

  *pairs(): IterableIterator<[K, K]> {
    const seen = new Set<K>();

    for (const e of this.m.entries()) {
      const left = e[0];
      for (const right of e[1].keys()) {
        if (!seen.has(right)) {
          yield [left, right];
        }
      }

      seen.add(left);
    }
  }

  *pairsEntries(): IterableIterator<[K, K, V]> {
    const seen = new Set<K>();

    for (const e of this.m.entries()) {
      const left = e[0];
      for (const [right, value] of e[1].entries()) {
        if (!seen.has(right)) {
          yield [left, right, value];
        }
      }

      seen.add(left);
    }
  }

  delete(a: K, b: K): boolean {
    const mapA = this.m.get(a);
    if (!mapA?.has(b)) {
      return false;
    }

    mapA.delete(b);
    if (mapA.size === 0) {
      this.m.delete(a);
    }

    const mapB = this.m.get(b)!;
    mapB.delete(a);
    if (mapB.size === 0) {
      this.m.delete(b);
    }

    return true;
  }

  has(a: K, b: K): boolean {
    return this.m.get(a)?.has(b) ?? false;
  }

  hasAny(k: K): boolean {
    return this.m.has(k);
  }

  get(a: K, b: K): V | undefined {
    return this.m.get(a)?.get(b);
  }

  keys(): IterableIterator<K> {
    return this.m.keys();
  }

  clear() {
    this.m.clear();
  }
}

/**
 * A map which itself contains a set of items. Each key may have multiple items set.
 */
export class MultiMap<K, V> {
  private readonly m = new Map<K, Set<V>>();
  private _totalSize = 0;

  add(k: K, v: V): boolean {
    let set = this.m.get(k);
    if (set === undefined) {
      set = new Set();
      this.m.set(k, set);
    }
    if (set.has(v)) {
      return false;
    }
    set.add(v);
    this._totalSize++;
    return true;
  }

  /**
   * Clears all values for this key.
   */
  clearKey(k: K) {
    const had = this.m.get(k);
    if (had !== undefined) {
      this._totalSize -= had.size;
      this.m.delete(k);
      return true;
    }
    return false;
  }

  /**
   * Delete a specific key/value combination.
   */
  delete(k: K, v: V): boolean {
    const set = this.m.get(k);
    if (set === undefined) {
      return false;
    }
    const deleted = set.delete(v);
    if (deleted) {
      this._totalSize--;
      if (set.size === 0) {
        this.m.delete(k);
      }
    }
    return deleted;
  }

  has(k: K, v: V): boolean {
    return this.m.get(k)?.has(v) ?? false;
  }

  get(k: K): Iterable<V> {
    return this.m.get(k) ?? [];
  }

  /**
   * Returns the count of values for this key.
   */
  count(k: K): number {
    return this.m.get(k)?.size ?? 0;
  }

  /**
   * Returns the size of this map; the number of keys with valid values.
   *
   * This is not the total number of values.
   */
  get size() {
    return this.m.size;
  }

  /**
   * Returns the total number of values set for all keys.
   */
  get totalSize() {
    return this._totalSize;
  }

  /**
   * Iterates through all active keys (with any values).
   */
  keys(): Iterable<K> {
    return this.m.keys();
  }

  clear() {
    this.m.clear();
  }
}

export class BiMap<A, B> {
  private constructor(
    private readonly fwd: Map<A, B> = new Map(),
    private readonly rwd: Map<B, A> = new Map(),
  ) {}

  clear() {
    this.fwd.clear();
    this.rwd.clear();
  }

  keys() {
    return this.fwd.keys();
  }

  values() {
    return this.fwd.values();
  }

  entries() {
    return this.fwd.entries();
  }

  invert() {
    return new BiMap(this.rwd, this.fwd);
  }

  set(a: A, b: B) {
    const prevB = this.fwd.get(a);
    const prevA = this.rwd.get(b);

    // this keeps ordering

    if (prevB !== b) {
      this.rwd.delete(prevB as B);
    }
    this.rwd.set(b, a);

    if (prevA !== a) {
      this.fwd.delete(prevA as A);
    }
    this.fwd.set(a, b);

    return this;
  }

  has(a: A) {
    return this.fwd.has(a);
  }

  hasFar(b: B) {
    return this.rwd.has(b);
  }

  get(a: A) {
    return this.fwd.get(a);
  }

  getFar(b: B) {
    return this.rwd.get(b);
  }

  delete(a: A) {
    if (!this.fwd.has(a)) {
      return false;
    }
    const prevB = this.fwd.get(a);
    this.rwd.delete(prevB as B);
    this.fwd.delete(a);
    return true;
  }

  deleteFar(b: B) {
    if (!this.rwd.has(b)) {
      return false;
    }
    const prevA = this.rwd.get(b);
    this.fwd.delete(prevA as A);
    this.rwd.delete(b);
    return true;
  }

  static create<A, B>() {
    return new BiMap<A, B>();
  }
}

export class TransformMap<K, V, T = V> {
  private readonly data = new Map<K, V>();
  private readonly defaultValue: V;
  private readonly transform: (value: V, withValue: T) => V;

  constructor(defaultValue: V, transform: (value: V, withValue: T) => V) {
    this.defaultValue = defaultValue;
    this.transform = transform;
  }

  /**
   * Deletes the given key. Basically reverts it to its default value.
   */
  delete(k: K): boolean {
    return this.data.delete(k);
  }

  /**
   * Update the given key.
   */
  update(k: K, update: T): V {
    const prev = this.get(k);
    const result = this.transform(prev, update);
    if (result === this.defaultValue) {
      this.data.delete(k);
    } else {
      this.data.set(k, result);
    }
    return result;
  }

  /**
   * Return the current value for this key, or the default.
   */
  get(k: K): V {
    const prev = this.data.get(k);
    if (prev === undefined) {
      return this.defaultValue;
    }
    return prev;
  }

  /**
   * Return all keys for non-default values.
   */
  keys(): IterableIterator<K> {
    return this.data.keys();
  }

  /**
   * Whether this key has a non-default value.
   */
  has(k: K): boolean {
    return this.data.has(k);
  }

  clear() {
    this.data.clear();
  }
}
