import test from 'node:test';
import * as assert from 'node:assert';
import { abortSignalTimeout, afterSignal, derivedSignal, promiseForSignal } from '../src/signal.js';
import { timeout } from '../src/promise.ts';

test('promiseFor', async () => {
  const c = new AbortController();
  const { signal } = c;

  const p = promiseForSignal(signal, undefined);
  c.abort();
  const out = await p;
  assert.strictEqual(out, undefined);

  const p2 = promiseForSignal(signal);
  try {
    await p2;
    assert.fail('should have thrown exception');
  } catch (e) {
    // ok
  }
});

test('afterSignal', async () => {
  let { abort, signal } = derivedSignal();
  abort();

  let stop: () => boolean;
  let invoked: number = 0;

  // immediate stop
  stop = afterSignal(signal, () => {
    ++invoked;
  });
  assert.strictEqual(stop(), true);
  assert.strictEqual(invoked, 0);

  // can't stop (already aborted, wait microtask)
  stop = afterSignal(signal, () => {
    ++invoked;
  });
  await Promise.resolve();
  assert.strictEqual(stop(), false);
  assert.strictEqual(invoked, 1);

  // won't stop (don't abort so won't be run)
  invoked = 0;
  ({ abort, signal } = derivedSignal());
  stop = afterSignal(signal, () => {
    ++invoked;
  });
  await Promise.resolve();
  assert.strictEqual(stop(), true);
  assert.strictEqual(invoked, 0);

  assert.strictEqual(stop(), false);
  await Promise.resolve();
  assert.strictEqual(invoked, 0);
});

test('timeout', async () => {
  const s = abortSignalTimeout(0);
  assert.strictEqual(s.aborted, false);

  // nb. zero doesn't resolve after a microtask; it resolves after timeout
  await timeout(0);

  assert.strictEqual(s.aborted, true);

  const { reason } = s;
  if (!(reason instanceof DOMException) || reason.name !== 'TimeoutError') {
    assert.fail('Invalid exception type: ' + reason);
  }
});
