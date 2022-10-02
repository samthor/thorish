

/**
 * Pass to {@link matchPartial} to match any value at a given node.
 */
export const matchAny = Symbol('matchAny');


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
  } else if (object && filter && typeof object === 'object' && typeof filter === 'object') {
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
  if (filter === matchAny) {
    return [object];  // found an "any" node, return object here
  } else if (filter && typeof filter === 'object') {
    let agg: any[] | undefined = undefined;

    for (const key in filter) {
      const out = readMatchAny(filter[key], object?.[key as any]);
      if (out) {
        if (agg) {
          agg.push(...out);
        } else {
          agg = out;
        }
      }
    }

    return agg;
  }
}
