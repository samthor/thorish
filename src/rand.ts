import { lerp } from './primitives.js';

export class Rand {
  private readonly source: typeof Math.random;
  private readonly s32: typeof Math.random;

  constructor(source?: typeof Math.random | number) {
    if (typeof source === 'number') {
      const s32 = seeded32(source);
      this.s32 = s32;
      this.source = () => (s32() / 2147483648 + 1.0) / 2.0;
    } else {
      const constSource = source ?? Math.random;
      this.source = constSource;
      this.s32 = () => {
        // cooerces back from Math.random => s32
        const r = constSource();
        return Math.floor((r - 0.5) * 2.0 * 2147483648.0);
      };
    }
  }

  random() {
    return this.source();
  }

  /**
   * Returns a random number in the range `[a,b)`.
   */
  randomRange(a: number, b: number = 0) {
    return lerp(a, b, Math.random());
  }

  /**
   * Returns a random integer number in the given range.
   */
  randomRangeInt(a: number, b: number = 0) {
    if (b < a) {
      // since we floor, ensure that a<b
      [a, b] = [b, a];
    }
    return Math.floor(this.randomRange(a, b));
  }
}

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
