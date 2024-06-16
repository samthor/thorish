import test from 'node:test';
import * as assert from 'node:assert';
import * as primitives from '../src/primitives.js';

test('hashCode', async () => {
  assert.strictEqual(primitives.hashCode(''), 0);
  assert.strictEqual(primitives.hashCode('a'), 97);
  assert.strictEqual(primitives.hashCode('abcdef'), 1424385949);
  assert.strictEqual(primitives.hashCode(new Uint8Array([1, 2, 3])), 1026);
});

test('randomPick', async () => {
  let out: number[];

  // just picks the total possible
  out = primitives.randomPickN([1, 2, 3], 4);
  assert.deepStrictEqual(out, [1, 2, 3]);

  // picks none
  out = primitives.randomPickN([1, 2, 3], -1);
  assert.deepStrictEqual(out, []);
});

test('lerp', () => {
  assert.strictEqual(primitives.inverseLerp(0, 10, 5), 0.5);
  assert.strictEqual(primitives.inverseLerp(5, 10, 0), -1.0);
  assert.strictEqual(primitives.lerp(5, 10, 0.5), 7.5);
});

test('seed', () => {
  const s = primitives.seeded32(1234);
  assert.strictEqual(s(), -1182780713);
  assert.strictEqual(-1182780713 & 0xff, 215); // can mask
  assert.strictEqual(s(), -1646890852);
  assert.strictEqual(s(), 428646200);

  const s2 = primitives.seededRand(1000);
  assert.strictEqual(s2(), 0.7110681121703237);
  assert.strictEqual(s2(), 0.9401418915949762);
  assert.strictEqual(s2(), 0.6993810315616429);
  assert.strictEqual(s2(), 0.9919486327562481);
  assert.strictEqual(s2(), 0.24484887369908392);
  assert.strictEqual(s2(), 0.2944149309769273);

  // seed with actual rand
  const s3 = primitives.seededRand(primitives.randomRangeInt(0, 10_000));
  for (let i = 0; i < 10_000; ++i) {
    const v = s3();
    assert.ok(v >= 0.0);
    assert.ok(v < 1.0);
  }
});
