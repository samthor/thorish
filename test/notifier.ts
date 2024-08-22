import test from 'node:test';
import * as assert from 'node:assert';
import { buildNotifier } from '../src/notifier.js';

test('notifier', async () => {
  const n = buildNotifier<void>();

  let called = 0;
  const fn = () => {
    ++called;
  };
  n.addListener(fn);
  n.addListener(fn);

  n.notify();

  assert.strictEqual(called, 2);
});
