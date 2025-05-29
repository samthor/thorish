/**
 * Finds all indexes of a given iterable which match the given predicate.
 */
export function findAllIndex<X>(arr: Iterable<X>, predicate: (x: X) => boolean): number[] {
  const out: number[] = [];

  let index = 0;
  for (const check of arr) {
    if (predicate(check)) {
      out.push(index);
    }
    ++index;
  }

  return out;
}

/**
 * Checks whether the larger array contains the passed sub-array at any index. O(n*m).
 */
export function arrayContainsSub<X>(arr: X[], sub: X[]): boolean {
  return findSubArray(arr, sub) !== -1;
}

/**
 * Finds the first index of the subarray in the larger array. This is O(n*m).
 *
 * Returns `-1` if not found.
 */
export function findSubArray<X>(arr: X[], sub: X[]): number {
  outer: for (let i = 0; i <= arr.length - sub.length; ++i) {
    for (let j = 0; j < sub.length; ++j) {
      if (arr[i + j] !== sub[j]) {
        continue outer;
      }
    }
    return i;
  }

  return -1;
}

/**
 * Removes the given index from the array, returning it if the index is valid.
 *
 * Swaps the last value of the array into the new position.
 *
 * Has {@link Array.at}-like semantics, supporting negative addressing.
 */
export function arraySwapRemoveAt<X>(arr: X[], at: number): X | undefined {
  if (at < 0) {
    at = arr.length + at;
  }
  if (at < 0 || at >= arr.length) {
    return undefined;
  }

  const last = arr.pop()!;
  if (arr.length === at) {
    return last; // chose last
  }

  // swap last into value we're returning
  const out = arr[at];
  arr[at] = last;
  return out;
}

/**
 * Inserts a value at the given index in the array by swapping any previous value to the end.
 *
 * This 'always works' because indexes <=0 are treated as zero, and indexes >=length are treated as a push.
 *
 * Has {@link Array.at}-like semantics, supporting negative addressing.
 */
export function arraySwapInsertAt<X>(arr: X[], at: number, value: X) {
  if (at < 0) {
    at = arr.length + at;
  }

  if (at >= arr.length) {
    arr.push(value);
  } else {
    at = Math.max(at, 0);
    const prev = arr[at];
    arr[at] = value;
    arr.push(prev);
  }
}
