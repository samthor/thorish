class TupleNode {
  private hasValue = false;
  private value?: any | undefined;
  private contents?: Map<any, TupleNode> | undefined;

  set(parts: any[], v: any): void {
    if (parts.length === 0) {
      this.hasValue = true;
      this.value = v;
      return;
    }
    this.contents ??= new Map();

    let node = this.contents.get(parts[0]);
    if (node === undefined) {
      node = new TupleNode();
      this.contents.set(parts[0], node);
    }
    return node.set(parts.slice(1), v);
  }

  has(parts: any[]): boolean {
    if (parts.length === 0) {
      return this.hasValue;
    }
    return this.contents?.get(parts[0])?.get(parts.slice(1)) ?? false;
  }

  all(parts: any[], prefix: any[]): [any[], any][] {
    if (parts.length !== 0) {
      const t = this.contents?.get(parts[0]);
      return t?.all(parts.slice(1), prefix.concat(parts[0])) ?? [];
    }

    const out: [any[], any][] = [];

    if (this.hasValue) {
      out.push([prefix, this.value]);
    }

    for (const [k, t] of this.contents?.entries() ?? []) {
      const inner = t.all([], prefix.concat(k));
      out.push(...inner);
    }

    return out;
  }

  get(parts: any[]): any {
    if (parts.length === 0) {
      return this.value;
    }
    return this.contents?.get(parts[0])?.get(parts.slice(1));
  }

  delete(parts: any[]): boolean {
    if (parts.length === 0) {
      if (this.hasValue) {
        this.hasValue = false;
        this.value = undefined;
        return true;
      }
      return false;
    }

    const node = this.contents?.get(parts[0]);
    if (node === undefined) {
      return false;
    }
    const change = node.delete(parts.slice(1));
    if (!change) {
      return false;
    }

    if (node.isEmpty()) {
      this.contents!.delete(parts[0]);
    }
    return true;
  }

  isEmpty() {
    return !this.hasValue && this.contents === undefined;
  }
}

/**
 * Map-like structure which allows fetching of unique {@link V} for a tuple-type {@link K}.
 *
 * This unique {@link V} is garbage-collected when no longer referenced.
 *
 * Each part of {@link K} must be identity comparable, as they are stored in intermediate {@link Map} instances.
 * (There's probably a different class for where the key requires an e.g., `isEqual(...)` method or similar.)
 */
export class WeakIdentityCache<K extends [...any], V extends WeakKey> {
  readonly #build: (...k: K) => V;
  readonly #reg: FinalizationRegistry<K>;
  readonly #root = new TupleNode();
  #count = 0;

  constructor(
    /**
     * Builds a {@link V}.
     */
    build: (...k: K) => V,

    /**
     * Called on GC of the assoicated {@link V}.
     */
    cleanup: (...k: K) => void = () => {},
  ) {
    this.#build = build;
    this.#reg = new FinalizationRegistry((k) => {
      this.delete(...k);
      cleanup(...k);
    });
  }

  /**
   * Gets this {@link K} from the cache.
   *
   * Builds the underlying {@link V} if it does not exist.
   */
  get(...k: K): V {
    const wr = this.#root.get(k);
    let curr = wr?.deref();

    if (curr === undefined) {
      curr = this.#build(...k);
      const update = new WeakRef(curr);
      this.#root.set(k, update);
      this.#reg.register(curr, k, curr);
      this.#count++;
    }

    return curr;
  }

  /**
   * Retrieves all live {@link V} instances under the given {@link K} prefix.
   */
  all(...k: Partial<K>): [K, V][] {
    let unsafe = this.#root.all(k, []);

    unsafe = unsafe.filter((unsafeArr) => {
      const arr = unsafeArr as [K, WeakRef<V>];
      const actual = arr[1].deref();
      if (actual === undefined) {
        return false;
      }
      unsafeArr[1] = actual;
      return true;
    });

    return unsafe as [K, V][];
  }

  /**
   * Deletes this {@link K} from the cache.
   *
   * This will prevent it from being passed to the cleanup function.
   */
  delete(...k: K): boolean {
    const wr = this.#root.get(k);
    if (wr === undefined) {
      return false;
    }

    this.#root.delete(k);
    this.#count--;

    const curr = wr.deref();
    if (curr !== undefined) {
      this.#reg.unregister(curr);
      return true;
    }
    return false;
  }

  get size() {
    return this.#count;
  }
}
