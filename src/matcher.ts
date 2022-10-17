
import { Condition, ConditionListener, ConditionOptions } from './cond';
import { DeepObjectPartial, readMatchAny, matchPartial, intersectManyObjects, deepFreeze } from './object-utils';
import { isDeepStrictEqual } from './support/index';
import type { AbortSignalArgs } from './types';
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
        console.info('triggerChange because hasAny', { triggerChange });
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
   * Returns the intersection of reading the given keys.
   */
  read(keys: Iterable<K>): DeepObjectPartial<T> | undefined {
    const o = this.#objects;
    const gen: Generator<T | undefined, void, void> = (function* () {
      for (const key of keys) {
        yield o.get(key);
      }
    })();

    return intersectManyObjects(gen);
  }

  /**
   * Attaches a subscripton to this {@link Matcher} based on the given {@link Filter}. The filter
   * will be frozen before use, so you cannot change it later.
   *
   * This will add all initially matching objects to the {@link MatcherSub}. However, the current
   * matching set will not be cleared when the passed signal is aborted.
   */
  sub(filter: Filter<T>, g: MatcherSub<K>, options?: AbortSignalArgs): void {
    deepFreeze(filter);

    if (options?.signal?.aborted) {
      return;
    }

    const hasAny = readMatchAny(filter, undefined) !== undefined;
    const key: GroupKey<T> = { hasAny, filter };
    this.#groups.set(key, g);

    for (const id of this.matchAll(filter)) {
      g.add(id);
    }

    options?.signal?.addEventListener('abort', () => {
      // TODO: remove matches?
      this.#groups.delete(key);
    });
  }

}


export interface Group {
  active(): boolean;
  addListener(fn: (state: boolean) => any, options?: ConditionOptions): boolean;
  removeListener(fn: (state: boolean) => any): boolean;
}


/**
 * Provides a wrapper for a number of {@link Group} instances. By default, this is active when
 * all of the passed groups (including zero) are active, an AND filter.
 */
export class CombineGroup implements Group {
  #groups: Group[];
  #cond: Condition;
  #isActive: (groups: Group[]) => boolean;

  static create(groups: Group[], isActive?: (groups: Group[]) => boolean) {
    return new this(groups, isActive);
  }

  constructor(groups: Group[], isActive?: (groups: Group[]) => boolean) {
    groups = groups.slice();
    this.#groups = groups;

    this.#isActive = isActive ?? (() => {
      for (const g of groups) {
        if (!g.active()) {
          return false;
        }
      }
      return true;
    });

    const listener = () => {
      this.#cond.state = this.#isActive(groups);
    };

    this.#cond = new class extends Condition {

      setup() {
        listener();  // might not be called otherwise
        groups.forEach((g) => g.addListener(listener, { both: true }));
      }

      teardown() {
        groups.forEach((g) => g.removeListener(listener));
      }

    };
  }

  active(): boolean {
    if (this.#cond.observed()) {
      return this.#cond.state;
    }
    return this.#isActive(this.#groups);
  }

  addListener(fn: ConditionListener, options?: ConditionOptions): boolean {
    return this.#cond.addListener(fn, options);
  }

  removeListener(fn: ConditionListener): boolean {
    return this.#cond.removeListener(fn);
  }
}


/**
 * Provides a wrapper to manage a {@link Filter} over a {@link Matcher}, both with matched keys
 * as well as a derived "active" state.
 *
 * By default, the group is active if any item matches the filter, however subclasses can change
 * this behavior by overriding {@link MatcherGroup#isActive}.
 */
export class MatcherGroup<K, T> implements Group {
  #filter: Filter<T>;
  #matcher: Matcher<K, T>;
  #signal: AbortSignal | undefined;

  #matchingSet = new Set<K>();
  #cond: Condition;

  static create<K, T>(filter: Filter<T>, matcher: Matcher<K, T>, options?: AbortSignalArgs) {
    return new this(filter, matcher, options);
  }

  constructor(filter: Filter<T>, matcher: Matcher<K, T>, options?: AbortSignalArgs) {
    this.#filter = filter;
    this.#matcher = matcher;
    this.#signal = options?.signal;

    let abortCurrentSubscription = () => { };

    // if this is fired, abort the current sub and clear listeners
    this.#signal?.addEventListener('abort', () => abortCurrentSubscription());

    const outer = this;
    this.#cond = new class extends Condition {

      setup() {
        const c = new AbortController();
        c.signal.addEventListener('abort', () => outer.#matchingSet.clear());
        abortCurrentSubscription = () => c.abort();

        if (outer.#matchingSet.size) {
          throw new Error(`should not have anything in set on setup: ${outer.#matchingSet}`);
        }
        this.state = outer.isActive(outer.#matchingSet);  // nothing to start with

        const cond = this;
        const sub = {
          add(id: K) {
            outer.#matchingSet.add(id);
            cond.state = outer.isActive(outer.#matchingSet);
          },
          delete(id: K) {
            outer.#matchingSet.delete(id);
            cond.state = outer.isActive(outer.#matchingSet);
          },
        };
        matcher.sub(filter, sub, { signal: c.signal });
      }

      teardown() {
        abortCurrentSubscription();
      }

    }(options);
  }

  protected isActive(matchingKeys: ReadonlySet<K>) {
    return matchingKeys.size !== 0;
  }

  active() {
    if (this.#cond.observed()) {
      // there's listeners, so we're maintaining this boolean
      return this.#cond.state;
    }
    return this.#matcher.matchAny(this.#filter);
  }

  matching(): Iterable<K> {
    if (this.#cond.observed()) {
      // we're maintaining this
      return this.#matchingSet.keys();
    }
    return this.#matcher.matchAll(this.#filter);
  }

  addListener(fn: ConditionListener, options?: AbortSignalArgs): boolean {
    return this.#cond.addListener(fn, options);
  }

  removeListener(fn: ConditionListener): boolean {
    return this.#cond.removeListener(fn);
  }

}