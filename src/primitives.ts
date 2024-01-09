/**
 * Returns a basic hash of the given string based on its UTF-16 parts only. Empty string is zero.
 */
export function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Choose a random item from the array.
 */
export function randomArrayChoice<X>(arr: X[]): X | undefined {
  if (arr.length <= 1) {
    return arr[0];
  }
  const index = Math.floor(Math.random() * arr.length);
  return arr[index];
}

/**
 * Lerp between low/high at the given position.
 */
export function lerp(low: number, high: number, at: number) {
  const range = high - low;
  return low + at * range;
}

/**
 * Returns a random number in the given range.
 */
export function randomRange(a: number, b: number = 0) {
  return lerp(a, b, Math.random());
}

/**
 * Returns a random integer number in the given range.
 */
export function randomRangeInt(a: number, b: number = 0) {
  if (b < a) {
    // since we floor, ensure that a<b
    [a, b] = [b, a];
  }
  return Math.floor(randomRange(a, b));
}
