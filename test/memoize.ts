
import test from 'node:test';
import * as assert from 'node:assert';
import { callMemoize, purgeMemoize } from '../src/memoize.js';

test('callMemoize', async () => {
  let local = 0;
  const helper = (offset = 0) => {
    return ++local + offset;
  };

  const m1 = callMemoize(helper);
  const m2_100 = callMemoize(helper, 100);
  const m3 = callMemoize(helper);
  const m4 = callMemoize(helper);
  const m5_100 = callMemoize(helper, 100);
  const m6_200 = callMemoize(helper, 200);

  assert.strictEqual(m1, 1);
  assert.strictEqual(m2_100, 102);
  assert.strictEqual(m3, 1);
  assert.strictEqual(m4, 1);
  assert.strictEqual(m5_100, 102);
  assert.strictEqual(m6_200, 203);

  assert.strictEqual(callMemoize(helper, 100), 102);
  purgeMemoize(helper);
  assert.strictEqual(callMemoize(helper, 100), 104);
});
