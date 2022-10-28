

let memoizeMap: WeakMap<Function, MemoizeState>;


class MemoizeState {
  // TODO: this is O(n) with calls. Maybe a tree structure?
  previousCalls: { args: any, result: any, weak: boolean }[] = [];

  get(query: any[]): { result: any } | undefined {
    const toRemove: number[] = [];

    const found = this.previousCalls.find(({ args, weak }, index) => {
      if (query.length !== args.length) {
        return false;
      }

      for (let i = 0; i < args.length; ++i) {
        let check = args[i];
        if (weak && check instanceof WeakRef) {
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

    // nb. this was inserted backwards, so we can splice
    for (let i = 0; i < toRemove.length; ++i) {
      this.previousCalls.splice(toRemove[i], 1);
    }

    if (found) {
      return { result: found.result };
    }
  }

  store(args: any[], result: any) {
    this.previousCalls.push({ args, result, weak: false });
  }

  /**
   * Stores a previous call, but uses {@link WeakRef} to refer to passed objects. If these are
   */
  storeWeak(args: any, result: any) {
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
      weak: true,
    });
  }

}


function internalMemoize<T, R>(weak: boolean, fn: (...args: T[]) => R, args: T[]): R {
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

  if (weak) {
    s.storeWeak(args, newResult);
  } else {
    s.store(args, newResult);
  }

  return newResult;
}


/**
 * Purge any previously memoized calls for a function passed to {@link memoize} or
 * {@link memoizeWeak}.
 */
export function purgeMemoize(fn: Function) {
  memoizeMap.delete(fn);
}


/**
 * Memoize a call to the passed {@link Function}. Matching calls to this helper will return the
 * same result.
 */
export function memoize<T, R>(fn: (...args: T[]) => R, ...args: T[]): R {
  return internalMemoize(false, fn, args);
}


/**
 * Memoize a call to the passed {@link Function}. Matching calls to this helper will return the
 * same result, however, object arguments are held weakly. If any object argument is released,
 * then that specific call will be forgotten.
 */
export function memoizeWeak<T, R>(fn: (...args: T[]) => R, ...args: T[]): R {
  return internalMemoize(true, fn, args);
}

