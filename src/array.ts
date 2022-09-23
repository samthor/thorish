
/**
 * Finds all indexes of a given array which match the given predicate.
 */
export function findAllIndex<X>(arr: X[], predicate: (x: X) => boolean): number[] {
  const out: number[] = [];

  for (let i = 0; i < arr.length; ++i) {
    if (predicate(arr[i])) {
      out.push(i);
    }
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
  outer:
  for (let i = 0; i <= arr.length - sub.length; ++i) {
    for (let j = 0; j < sub.length; ++j) {
      if (arr[i + j] !== sub[j]) {
        continue outer;
      }
    }
    return i;
  }

  return -1;
}
