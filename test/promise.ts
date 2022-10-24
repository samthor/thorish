
import test from 'node:test';
import * as assert from 'node:assert';
import * as promise from '../src/promise';

test('setTimeout', async () => {
  const t = promise.wrapTrigger(setTimeout, 10);
  await t;
  assert.ok(true);
});

test('spliceNextPromise', async () => {
  const unresolvedPromise = Promise.race([]);
  const arr = [unresolvedPromise, unresolvedPromise, Promise.resolve('this_one'), unresolvedPromise];
  assert.strictEqual(arr.length, 4);

  const out = await promise.spliceNextPromise(arr);
  assert.strictEqual(out, 'this_one');
  assert.strictEqual(arr.length, 3);
});
