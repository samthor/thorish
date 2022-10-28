import { structuredIshClone } from "./object-structured-clone.js";


/**
 * Pass to {@link matchPartial} to match any value at a given node. This is {@link Symbol}, but
 * returned as `any` for convenience.
 */
export const matchAny = Symbol('matchAny') as any;


/**
 * Deep partial type. Does not support {@link Function} or similar.
 */
export type DeepObjectPartial<T> = T extends object ? { [P in keyof T]?: DeepObjectPartial<T[P]>; } : T;


/**
 * Match the passed object against the filter. This just checks for strict equality.
 */
export function matchPartial<T>(filter: DeepObjectPartial<T>, object: T): boolean {
  if (object === undefined) {
    return false;  // can never match
  } else if (object === filter || filter === matchAny) {
    return true;  // allow match/any
  } else if (typeof object === 'object' && object) {
    for (const key in filter) {
      if (!matchPartial(filter[key], object[key as any])) {
        return false;  // part of filter did not match
      }
    }
    return true;  // passed all object checks
  } else {
    return false;  // not equal
  }
}


/**
 * Returns an {@link Array} of all values targeted by {@link matchAny} in a filter. Returns
 * `undefined` if there are no {@link matchAny} values in the filter.
 *
 * This can be used to compare against matches, as the array will always have the same shape for
 * the same filter.
 */
export function readMatchAny<T>(filter: DeepObjectPartial<T>, object: T): any[] | void {
  // don't filter for undefined, we need to traverse filter
  if (filter === matchAny) {
    return [object];  // found an "any" node, return object here
  } else if (typeof filter === 'object' && filter) {
    // only traverse when filter is non-null object, and object is object OR undefined
    let agg: any[] | undefined;

    const traverseInto = (typeof object === 'object' || object === undefined) ? object : undefined;
    for (const key in filter) {
      const out = readMatchAny(filter[key], traverseInto?.[key as any]);
      if (out) {
        if (agg === undefined) {
          agg = out;
        } else {
          agg.push(...out);
        }
      }
    }

    return agg;
  }
}


/**
 * Return the parts of a/b that are the same. Otherwise, returns `undefined`.
 */
export function intersectObjects<T>(a: T | DeepObjectPartial<T> | undefined, b: T | DeepObjectPartial<T> | undefined): DeepObjectPartial<T> | undefined {
  if (a === b) {
    return a as DeepObjectPartial<T>;
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const unionObject: Record<string, any> = {};
    for (const key in a) {
      const out = intersectObjects(a[key], b[key]);
      if (out !== undefined) {
        unionObject[key] = out;
      }
    }
    return unionObject as DeepObjectPartial<T>;  // this will be {} if no keys match - fine
  }
}


/**
 * Intersect many objects together (0-n objects). May return `undefined`.
 */
export function intersectManyObjects<T>(of: Iterable<T>): DeepObjectPartial<T> | undefined {
  const iter = of[Symbol.iterator]();
  const first = iter.next();
  if (first.done) {
    return;
  }

  let out = first.value as DeepObjectPartial<T> | undefined;
  if (typeof out !== 'object') {
    return out;
  }

  let ir = iter.next();
  if (ir.done) {
    return structuredIshClone(out);  // only had 1 value, return clone
  }

  for (; ;) {
    out = intersectObjects(out as DeepObjectPartial<T>, ir.value);
    if (typeof out !== 'object') {
      return out;
    }

    for (const _ in out) {
      // hooray, we have at least one key!
      ir = iter.next();
      if (ir.done) {
        return out;  // no more data
      }
      break;  // continue next loop
    }
  }
}


/**
 * Call {@link Object.freeze} on this object as well as any of its child objects.
 */
export function deepFreeze(object: any): void {
  if (object && typeof object === 'object') {
    const propNames = Object.getOwnPropertyNames(object);

    for (const name of propNames) {
      const value = object[name];
      deepFreeze(value);
    }

    return Object.freeze(object);
  }

  return object;
}
