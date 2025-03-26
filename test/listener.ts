import test from 'node:test';
import * as assert from 'node:assert';
import { namedListeners, soloListener } from '../src/listener.ts';
import { neverAbortedSignal } from '../src/signal.ts';
import { timeout } from '../src/promise.ts';

test('always unique', () => {
  const l = soloListener<void>();
  const c = new AbortController();
  const signal = c.signal;
  let count = 0;

  const method = () => {
    count++;
  };

  l.addListener(method, signal);
  l.addListener(method, signal);

  l.dispatch();

  assert.strictEqual(count, 2);
});

test('et behavior', () => {
  const e = new EventTarget();
  let count = 0;

  const method = () => count++;

  // initial config per ref wins
  count = 0;
  e.addEventListener('whatever1', method, { once: true });
  e.addEventListener('whatever1', method);
  e.addEventListener('whatever1', method);
  e.dispatchEvent(new CustomEvent('whatever1'));
  e.dispatchEvent(new CustomEvent('whatever1'));
  e.dispatchEvent(new CustomEvent('whatever1'));
  assert.strictEqual(count, 1);

  // initial config per ref wins
  count = 0;
  e.addEventListener('whatever2', method);
  e.addEventListener('whatever2', method, { once: true });
  e.addEventListener('whatever2', method);
  e.dispatchEvent(new CustomEvent('whatever2'));
  e.dispatchEvent(new CustomEvent('whatever2'));
  e.dispatchEvent(new CustomEvent('whatever2'));
  assert.strictEqual(count, 3);

  // same but for signal
  count = 0;
  const c = new AbortController();
  const signal = c.signal;
  e.addEventListener('whatever3', method, { signal });
  e.addEventListener('whatever3', method);
  e.addEventListener('whatever3', method);
  c.abort();
  e.dispatchEvent(new CustomEvent('whatever3'));
  e.dispatchEvent(new CustomEvent('whatever3'));
  e.dispatchEvent(new CustomEvent('whatever3'));
  assert.strictEqual(count, 0);

  // once aborted, can happily re-add
  e.addEventListener('whatever3', method);
  e.dispatchEvent(new CustomEvent('whatever3'));
  assert.strictEqual(count, 1);
});

test('wrap et', () => {
  const nl = namedListeners<{ x: number; y: boolean }>();
  const et = nl.eventTarget();

  let anySetupCalls = 0;
  nl.any(
    'x',
    (signal) => {
      ++anySetupCalls;
    },
    neverAbortedSignal,
  );

  let count = 0;

  const c = new AbortController();
  et.addEventListener(
    'x',
    (raw) => {
      const ce = raw as CustomEvent<number>;
      assert.strictEqual(ce.detail, 123);
      ++count;
    },
    { signal: c.signal },
  );
  assert.strictEqual(anySetupCalls, 1);

  nl.dispatch('x', 123);
  nl.dispatch('x', 123);
  assert.strictEqual(count, 2);
  c.abort();

  const typedTarget = nl.eventTarget<{
    y: Event; // y is a superclass of the default CustomEvent<...>
  }>();

  typedTarget.addEventListener('x', (e) => {
    assert.strictEqual(e.detail, 345);
    ++count;
  });
  assert.strictEqual(anySetupCalls, 2); // called again
  nl.dispatch('x', 345);
  assert.strictEqual(count, 3);
});
