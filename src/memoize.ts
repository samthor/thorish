

let memoizeMap: WeakMap<Function, MemoizeState>;


class MemoizeState {
  // TODO: this is O(n) with calls. Maybe a tree structure?
  previousCalls: { args: any[], result: any }[] = [];

  findIndex(query: any[]): number {
    const toRemove: number[] = [];

    let index = this.previousCalls.findIndex(({ args }, index) => {
      if (query.length !== args.length) {
        return false;
      }

      for (let i = 0; i < args.length; ++i) {
        let check = args[i];
        if (check instanceof WeakRef) {
          check = check.deref();
          if (check === undefined) {
            toRemove.unshift(index);
            return false;
          }
        }
        if (check !== query[i]) {
          return false;
        }
      }
      return true;
    });

    toRemove.forEach((toRemoveIndex) => {
      if (toRemoveIndex < index) {
        --index;
      }
      // this is safe (wrt. toRemoveIndex) because it's high=>low
      this.previousCalls.splice(toRemoveIndex, 1);
    });

    return index;
  }

  remove(args: any[]): boolean {
    const index = this.findIndex(args);
    if (index === -1) {
      return false;
    }
    this.previousCalls.splice(index, 1);
    return true;
  }

  get(args: any[]): { result: any } | undefined {
    const index = this.findIndex(args);
    if (index === -1) {
      return;
    }
    const found = this.previousCalls[index];
    return { result: found.result };
  }

  /**
   * Stores a previous call.
   */
  store(args: any[], result: any) {
    this.previousCalls.push({
      args: args.map((arg) => {
        if (typeof arg === 'object' && arg !== null) {
          // technically this will wrap weakRef in weakRef
          // TODO: Could happily use WeakSet/WeakMap, as `.get()` knows what to ask for
          return new WeakRef(arg);
        }
        return arg;
      }),
      result,
    });
  }
}


/**
 * Purge any previously memoized calls for a function passed to {@link memoize} or
 * {@link memoizeWeak}.
 */
export function purgeMemoize(fn: Function) {
  memoizeMap.delete(fn);
}


/**
 * Clears a specific memoized call.
 *
 * @returns `true` if it was cleared, `false` if not found
 */
export function clearMemoize<T, R>(fn: (...args: T[]) => R, ...args: T[]) {
  const state = memoizeMap?.get(fn);
  if (state === undefined) {
    return false;
  }

  return false;
}


/**
 * Calls the passed {@link Function} but memoize the result based on the function arguments.
 * The memoize state is stored globally based on the function ref.
 *
 * Matching calls to this helper will return the same result.
 * Holds the object parameters (i.e., non-nullable typeof 'object') weakly.
 */
export function callMemoize<T, R>(fn: (...args: T[]) => R, ...args: T[]): R {
  if (memoizeMap === undefined) {
    memoizeMap = new WeakMap();
  }

  let s = memoizeMap.get(fn);
  if (s === undefined) {
    s = new MemoizeState();
    memoizeMap.set(fn, s);
  }

  const maybeResult = s.get(args);
  if (maybeResult !== undefined) {
    return maybeResult.result;
  }

  const newResult = fn(...args);
  s.store(args, newResult);

  return newResult;
}


/**
 * Build a memoized version of the passed function.
 */
export function memoize<T, R>(fn: (...args: T[]) => R): (...args: T[]) => R {
  return (...args: T[]) => callMemoize(fn, ...args);
}
