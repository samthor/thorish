import test from 'node:test';
import * as assert from 'node:assert';
import { channelForSignal, keyedSelect, newChannel, select } from '../src/select.ts';
import { timeout } from '../src/promise.ts';

test('select', async () => {
  const results: string[] = [];

  const ch1 = newChannel<string>();
  ch1.push('abc');

  const task = async () => {
    await select(ch1);

    const v = ch1.next();
    if (v === undefined) {
      throw new Error(`no value available on next()`);
    }
    results.push(v);
  };

  const p1 = task();
  const p2 = task();

  await timeout(1);
  await Promise.race([p1, p2]);
  assert.deepStrictEqual(results, ['abc']);

  ch1.push('lol');
  await Promise.all([p1, p2]);
  assert.deepStrictEqual(results, ['abc', 'lol']);
});

const testSymbol = Symbol('whatever');
const testSymbol2 = Symbol('aaaa');

test('keyed', async () => {
  const a = newChannel<string>();
  a.push('lol');

  const out = await keyedSelect({
    a,
    [testSymbol]: newChannel<number>(),
  });

  assert.strictEqual(out, 'a');
});

test('consume', async () => {
  const a = newChannel<string>();
  const p = a.push('lol');

  let consumed = 0;
  p.then(() => {
    consumed++;
  });

  const ready = await a.wait();
  assert.strictEqual(consumed, 0);

  const out = a.next();
  assert.strictEqual(out, 'lol');
  await Promise.resolve();

  assert.strictEqual(consumed, 1);
});

test('close', async () => {
  const c = new AbortController();
  c.abort();
  const ch = channelForSignal(c.signal);

  const abortSymbol = Symbol('abort');

  const out = await keyedSelect({ [abortSymbol]: ch });
  assert.strictEqual(out, abortSymbol);

  switch (out) {
    case abortSymbol:
      break;
    default:
      throw new Error(`blah`);
  }

  const v = ch.next();
  const v2 = ch.next();
  assert.strictEqual(v, c.signal);
  assert.strictEqual(v2, c.signal);
});

test('order', () => {
  const o = {
    [testSymbol2]: true,
    [testSymbol]: true,
    b: true,
    a: true,
    [-1]: true,
    '1': true,
    [0]: true,
    '1.0': true,
  };

  console.info(Reflect.ownKeys(o), Object.keys(o));
});
