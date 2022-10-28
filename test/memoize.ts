
import test from 'node:test';
import * as assert from 'node:assert';
import { memoize } from '../src/memoize.js';

test('memoize', async () => {
  let local = 0;
  const helper = (offset = 0) => {
    return ++local + offset;
  };

  const m1 = memoize(helper);
  const m2_100 = memoize(helper, 100);
  const m3 = memoize(helper);
  const m4 = memoize(helper);
  const m5_100 = memoize(helper, 100);
  const m6_200 = memoize(helper, 200);

  assert.strictEqual(m1, 1);
  assert.strictEqual(m2_100, 102);
  assert.strictEqual(m3, 1);
  assert.strictEqual(m4, 1);
  assert.strictEqual(m5_100, 102);
  assert.strictEqual(m6_200, 203);
});
