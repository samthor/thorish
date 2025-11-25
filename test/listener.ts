import test from 'node:test';
import * as assert from 'node:assert';
import { namedListeners, soloListener } from '../src/listener.ts';
import { derivedSignal, neverAbortedSignal } from '../src/signal.ts';
import { timeout } from '../src/promise.ts';

test('void listener', () => {
  // n.b. isn't really a test but will annoy me if the TS compiler fails

  const l = namedListeners<{ void: void; undefined; null: null; number: number }>();
  l.dispatch('void');
  l.dispatch('undefined');
  l.dispatch('undefined', undefined);

  // @ts-expect-error
  l.dispatch('undefined', undefined, undefined);

  // @ts-expect-error
  l.dispatch('null');
  l.dispatch('null', null);

  // @ts-expect-error
  l.dispatch('null', null, null);

  // @ts-expect-error
  l.dispatch('number');
  l.dispatch('number', 123);
});

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
  assert.strictEqual(count, 2, 'should be called twice');
  c.abort();

  const typedTarget = nl.eventTarget<{
    y: Event; // y is a superclass of the default CustomEvent<...>
  }>();

  typedTarget.addEventListener('x', (e) => {
    assert.strictEqual(e.detail, 345);
    ++count;
  });
  assert.strictEqual(anySetupCalls, 2, 'setup should be called twice'); // called again
  nl.dispatch('x', 345);
  assert.strictEqual(count, 3);
});

test('hasAny', () => {
  const nl = namedListeners<{ foo: number }>();

  assert.strictEqual(nl.hasAny('foo'), false);
  assert.strictEqual(nl.hasAny('unrelated' as any), false);

  const { signal, abort } = derivedSignal();

  nl.addListener(
    'foo',
    () => {
      // whatever
    },
    signal,
  );

  assert.strictEqual(nl.hasAny('foo'), true);
  assert.strictEqual(nl.hasAny('unrelated' as any), false);

  abort();

  assert.strictEqual(nl.hasAny('foo'), false, 'should no longer have any for foo');
  assert.strictEqual(nl.hasAny('unrelated' as any), false);
});
