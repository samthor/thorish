
import { DeepObjectPartial, readMatchAny, matchPartial } from './object-utils';
import { isDeepStrictEqual } from './support/index';
export { matchAny } from './object-utils';


/**
 * Used to express a filter for {@link Matcher}.
 */
export type Filter<T> = DeepObjectPartial<T>;


/**
 * Internal key to the groups inside {@link Matcher}.
 */
type GroupKey<T> = { hasAny: boolean, filter: Filter<T> };


/**
 * This can be added to a {@link Matcher} to recieve updates based on a filter.
 */
export interface MatcherSub<K> {
  add(k: K): any;
  delete(k: K): any;
}


/**
 * Matcher that allows us to observe groups of keyed objects as they transition through state.
 *
 * These objects must be cloneable via {@link structuredClone}.
 *
 * An `undefined` state is equivalent to blank/deleted: it does not exist.
 */
export class Matcher<K, T> {
  #objects = new Map<K, T>();
  #groups = new Map<GroupKey<T>, MatcherSub<K>>();

  get(id: K): T | undefined {
    return structuredClone(this.#objects.get(id));
  }

  /**
   * Sets this value into the {@link Matcher}. This will trigger group state changes.
   */
  set(id: K, value: T | undefined): void {
    const prev = this.#objects.get(id);
    const beforeGroups = prev === undefined
      ? []
      : [...this.#groups.keys()].filter(({ filter }) => matchPartial(filter, prev));

    // Set or clear the value, then check groups again.
    if (value === undefined) {
      this.#objects.delete(id);
    } else {
      this.#objects.set(id, structuredClone(value));
    }

    const afterGroupsSet: Set<GroupKey<T>> = value === undefined
      ? new Set()
      : new Set([...this.#groups.keys()].filter(({ filter }) => matchPartial(filter, value)));

    beforeGroups.forEach((g) => {
      let triggerChange = false;

      // Check for "any" filters, which cause state to transition end => begin.
      if (g.hasAny) {
        const anyValues = readMatchAny(g.filter, prev);
        const updatedAnyValues = readMatchAny(g.filter, value);
        triggerChange = !isDeepStrictEqual(anyValues, updatedAnyValues);
      }

      if (triggerChange || !afterGroupsSet.delete(g)) {
        // This was removed from a group, it wasn't in the new set.
        // If it's a trigger, always remove so we can fire again.
        this.#groups.get(g)!.delete(id);
      }
    });
    afterGroupsSet.forEach((g) => {
      // The remaining groups are new.
      this.#groups.get(g)!.add(id);
    });
  }

  delete(id: K) {
    if (this.#objects.has(id)) {
      this.set(id, undefined);
      return true;
    }
    return false;
  }

  /**
   * Does any object match this filter?
   */
  matchAny(filter: Filter<T>): boolean {
    for (const o of this.#objects.values()) {
      if (matchPartial(filter, o)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Matches objects immediately, without grouping.
   */
  *matchAll(filter: Filter<T>): Generator<K, void, void> {
    for (const [id, o] of this.#objects.entries()) {
      if (matchPartial(filter, o)) {
        yield id;
      }
    }
  }

  /**
   * Attaches a subscripton to this {@link Matcher} based on the given {@link Filter}.
   *
   * This will add all initially matching objects to the {@link MatcherSub}. However, the current
   * matching set will not be cleared when the passed signal is aborted.
   */
  sub(filter: Filter<T>, g: MatcherSub<K>, { signal }: { signal?: AbortSignal } = {}): void {
    if (signal?.aborted) {
      return;
    }

    const hasAny = readMatchAny(filter, undefined) !== undefined;
    const key: GroupKey<T> = { hasAny, filter };
    this.#groups.set(key, g);

    for (const id of this.matchAll(filter)) {
      g.add(id);
    }

    signal?.addEventListener('abort', () => {
      // TODO: remove matches?
      this.#groups.delete(key);
    });
  }

}
