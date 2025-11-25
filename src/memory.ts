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

export class WeakIdentityCache<K extends [...any], V extends WeakKey> {
  readonly #build: (...k: K) => V;
  readonly #reg: FinalizationRegistry<K>;
  readonly #root = new TupleNode();
  #count = 0;

  constructor(
    build: (...k: K) => V,

    /**
     * Called on GC of the assoicated value.
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
