import { AbortSignalArgs } from "./types";


/**
 * TODO: controls a boolean which fires begin/end listeners.
 */
export class Condition {
  #listeners = new Set<() => any>();
  #signal: AbortSignal | undefined;
  #state = false;

  constructor(options?: AbortSignalArgs) {
    options?.signal?.addEventListener('abort', () => {
      this.#listeners.clear();
    });
    this.#signal = options?.signal;
  }

  set state(v) {
    if (this.#state === v) {
      return;
    }
    this.#state = v;
    if (v) {
      this.#listeners.forEach((fn) => fn());
    }
  }

  observed() {
    return this.#listeners.size !== 0;
  }

  addListener(fn: () => any, options?: AbortSignalArgs & { setup(): any }): boolean {
    if (this.#signal?.aborted || options?.signal?.aborted) {
      return false;
    }
    const first = this.#listeners.size === 0;
    this.#listeners.add(fn);
    options?.signal?.addEventListener('abort', () => this.#listeners.delete(fn));
    return first;
  }

  removeListener(fn: () => any): boolean {
    if (this.#listeners.size === 0) {
      return false;
    }
    this.#listeners.delete(fn);
    return this.#listeners.size === 0;
  }

}
