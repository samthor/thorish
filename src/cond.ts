import type { AbortSignalArgs } from './types.js';


/**
 * The options passed to {@link Condition} when adding a listener.
 */
export type ConditionOptions = AbortSignalArgs & {

  /**
   * Whether to call the listener for both state begin and state end, as opposed to just begin.
   *
   * @default false
   */
  both?: boolean;

};


/**
 * A listener added to {@link Condition}.
 */
export type ConditionListener<T> = (state: T) => any;


/**
 * Controls a value which fires begin/end listeners on its state change.
 */
export class Condition<T> {
  #listeners = new Map<ConditionListener<T>, boolean>();
  #signal: AbortSignal | undefined;
  #state: T;

  constructor(defaultValue: T, options?: AbortSignalArgs) {
    options?.signal?.addEventListener('abort', () => {
      this.#listeners.clear();
    });
    this.#state = defaultValue;
    this.#signal = options?.signal;
  }

  get state(): T {
    return this.#state;
  }

  set state(v: T) {
    if (this.#state === v) {
      return;
    }
    this.#state = v;

    for (const [fn, both] of this.#listeners.entries()) {
      if (both || v) {
        fn(v);
      }
    }
  }

  /**
   * Does this {@link Condition} currently have any listeners.
   */
  observed() {
    return this.#listeners.size !== 0;
  }

  /**
   * For subclasses to override. The actions to take when the first listener is added.
   */
  protected setup() {
  }

  /**
   * For subclasses to override. The actions to take when the last listener is removed, or this
   * {@link Condition} is aborted.
   */
  protected teardown() {
  }

  /**
   * Adds a listener to this {@link Condition}.
   */
  addListener(fn: ConditionListener<T>, options?: ConditionOptions): boolean {
    if (this.#signal?.aborted || options?.signal?.aborted || this.#listeners.has(fn)) {
      return false;
    }
    const first = this.#listeners.size === 0;
    this.#listeners.set(fn, options?.both ?? false);

    // nb. If the same function is added and removed many times, many signals may point to its
    // removal! This is no different then EventTarget though, which has the same problem.
    options?.signal?.addEventListener('abort', () => this.removeListener(fn));

    if (first) {
      this.setup();
    }
    return true;
  }

  /**
   * Removes a listener from this {@link Condition}.
   */
  removeListener(fn: ConditionListener<T>): boolean {
    if (this.#listeners.size === 0) {
      return false;
    }
    if (!this.#listeners.delete(fn)) {
      return false;
    }

    if (this.#listeners.size === 0) {
      this.teardown();
    }
    return true;
  }

}
