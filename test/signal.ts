import test from 'node:test';
import * as assert from 'node:assert';
import { promiseForSignal } from '../src/signal.js';

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
