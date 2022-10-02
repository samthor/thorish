
import test from 'node:test';
import * as assert from 'node:assert';
import * as promise from '../src/promise';

test('setTimeout', async () => {
  const t = promise.wrapTrigger(setTimeout, 10);
  await t;
  assert.ok(true);
});
