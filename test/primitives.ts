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
});
