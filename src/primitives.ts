/**
 * Returns a basic hash of the string or {@link ArrayLike}.
 */
export function hashCode(s: string | ArrayLike<number>) {
  if (typeof s === 'string') {
    return hashCodeString(s);
  }
  return hashCodeArray(s);
}

/**
 * Returns a basic hash of the given string based on its UTF-16 parts only. Empty string is zero.
 */
export function hashCodeString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Returns a basic hash of the given array-like. Empty is zero.
 */
export function hashCodeArray(s: ArrayLike<number>) {
  let h = 0;
  for (let i = 0; i < s.length; ++i) {
    h = (Math.imul(31, h) + s[i]) | 0;
  }
  return Math.abs(h);
}

/**
 * Choose a random item from the {@link ArrayLike}.
 */
export function randomArrayChoice<X>(arr: ArrayLike<X>): X | undefined {
  const index = arr.length <= 1 ? 0 : Math.floor(Math.random() * arr.length);
  return arr[index];
}

/**
 * Pick a random item from the passed {@link Iterable}. Consumes the entire iterable.
 */
export function randomPick<X>(iter: Iterable<X>): X | undefined {
  if (Array.isArray(iter)) {
    return randomArrayChoice(iter);
  }
  return randomPickN(iter, 1)[0];
}

/**
 * Picks a random N items from the passed {@link Iterable}. Consumes the entire iterable.
 */
export function randomPickN<X>(iter: Iterable<X>, count: number): X[] {
  const out: X[] = [];
  if (count < 1) {
    return out;
  }

  const it = iter[Symbol.iterator]();

  // create reservoir
  while (out.length < count) {
    const next = it.next();
    if (next.done) {
      return out;
    }
    out.push(next.value);
  }

  // replace as needed
  let i = out.length;
  for (;;) {
    const next = it.next();
    if (next.done) {
      return out;
    }
    ++i;

    const r = randomRangeInt(0, i + 1);
    if (r <= out.length) {
      out[r] = next.value;
    }
  }
}

/**
 * Lerp between low/high at the given position.
 */
export function lerp(low: number, high: number, at: number) {
  const range = high - low;
  return low + at * range;
}

/**
 * Finds the position (normally 0-1) between low-high.
 *
 * Will return `Infinity` if low and high are the same.
 */
export function inverseLerp(low: number, high: number, value: number) {
  const range = high - low;
  return (value - low) / range;
}

/**
 * Returns a random number in the given range. This is the same semantics as {@link Math.random()}.
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

/**
 * Generates seeded, random 32-bit numbers between `[-2147483648,2147483647]` (i.e., `[-2^31,(2^31)-1]`).
 *
 * The best use is to clip these numbers with a mask, e.g., `gen() & 0xffff` for 16-bit.
 */
export function seeded32(s: number): () => number {
  // nb. t is used as a local var declaration only
  return (t: number = 0) => (
    (s = (s + 0x9e3779b9) | 0),
    (t = Math.imul(s ^ (s >>> 16), 0x21f0aaad)),
    (t = Math.imul(t ^ (t >>> 15), 0x735a2d97)),
    (t = t ^ (t >>> 15))
  );
}
