import test from 'node:test';
import * as assert from 'node:assert';
import * as array from '../src/array.js';

test('findAllIndex', () => {
  const arr = [1, 2, 3, 4, 2];
  const index = array.findAllIndex(arr, (x) => x === 2);
  assert.deepStrictEqual(index, [1, 4]);
});

test('sub', () => {
  const arr = ['a', 'b', 'c', 'b', 'c'];
  assert.strictEqual(array.findSubArray(arr, ['b', 'c']), 1);
  assert.strictEqual(array.findSubArray(arr, ['b', 'c', 'a']), -1);
  assert.strictEqual(array.arrayContainsSub(arr, ['b', 'c']), true);
});
