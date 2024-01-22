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
  let out: number[]

  // just picks the total possible
  out = primitives.randomPickN([1, 2, 3], 4);
  assert.deepStrictEqual(out, [1, 2, 3]);

  // picks none
  out = primitives.randomPickN([1, 2, 3], -1);
  assert.deepStrictEqual(out, []);
});