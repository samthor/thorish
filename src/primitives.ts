const u = /* @__PURE__ */ (() => new Int32Array(16384))();
let ui = u.length;

/**
 * Returns a random signed int32, from the crypto lib via a pool.
 *
 * This is on par with {@link Math.random} rather than being significantly faster.
 * It has a 'startup cost' which makes benchmarking hard, and seems to get faster the more numbers you request.
 */
export function randInt32(): number {
  if (ui === u.length) {
    crypto.getRandomValues(u);
    ui = 0;
  }
  return u[ui++];
}

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
 * Returns a random number in the given range.
 * This is the same semantics as {@link Math.random()}.
 */
export function randomRange(a: number, b: number = 0) {
  return lerp(a, b, Math.random());
}

/**
 * Returns a random integer number in the given range.
 * If only a single number is given, treated as `[0,n)`.
 * If two numbers are given, treated as `[a,b)`, regardless of relative order.
 *
 * For example:
 *  - `(10)` can give values 0 through 9.
 *  - `(1, 6)` can give values 1 through 5.
 *  - `(0, -4)` can give values 0 through -3.
 *  - `(-4, 0)` can give values -4 through -1.
 *
 * Same values always return that value.
 *
 */
export function randomRangeInt(a: number, b?: number) {
  if (b === undefined) {
    b = a;
    a = 0;
  }

  const o = randomRange(a, b);

  if (a <= b) {
    // normal
    return Math.floor(o);
  } else {
    // inverted
    return Math.ceil(o);
  }
}

/**
 * Clamps a number between low and high.
 */
export const clamp = (low: number, high: number, number: number): number =>
  Math.max(Math.min(high, number), low);

/**
 * Skews a value from a prior range to a new range.
 */
export const skew = (
  from: { low: number; high: number },
  to: { low: number; high: number },
  value: number,
) => {
  const at = inverseLerp(from.low, from.high, value);
  return lerp(to.low, to.high, at);
};

/**
 * Generates seeded, random 32-bit numbers between `[-2147483648,2147483647]` (i.e., `[-2^31,(2^31)-1]`).
 *
 * The seed must be an integer, if a float is passed, only the integer part is used (e.g., `0.5`
 * becomes `0`).
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

/**
 * Generates seeded `Math.random()` behavior (i.e., >=0 and <1). Requires integer seed, just like
 * {@link seeded32}.
 */
export function seededRand(s: number): () => number {
  const actual = seeded32(s);
  return () => (actual() / 2147483648 + 1.0) / 2.0;
}

/**
 * Returns a random 36-alphabet string (0-9, a-z) for use as a random identifier.
 *
 * By default, generates a 6-character long ID, which is ~31 bits. The bits are linear with length;
 * each character is ~5.15 bits worth.
 */
export function randomId(length = 6) {
  const r = Math.floor(Math.random() * 36 ** length);
  return r.toString(36).padStart(length, '0').substring(0, length);
}
