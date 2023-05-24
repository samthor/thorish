
/**
 * Helper to create implicit counts of things.
 */
export class StatsCount<K = string> {
  #data = new Map<K, number>();

  /**
   * Increment this key by a number. By default, this is one.
   */
  inc(k: K, by: number = 1) {
    if (!by) {
      return;
    }
    const prev = this.#data.get(k) ?? 0;
    const result = prev + by;

    if (result) {
      this.#data.set(k, result);
    } else {
      this.#data.delete(k);
    }
    return result;
  }

  /**
   * Return the count for this key, or zero.
   */
  get(k: K): number {
    return this.#data.get(k) ?? 0;
  }

  /**
   * Return all keys.
   */
  keys(): IterableIterator<K> {
    return this.#data.keys();
  }

}