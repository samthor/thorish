import test from 'node:test';
import * as assert from 'node:assert';
import { channelForGenerator, channelForSignal, newChannel, select } from '../src/select.ts';
import { timeout } from '../src/promise.ts';

test('select', async () => {
  const results: string[] = [];

  const ch1 = newChannel<string>();
  ch1.push('abc');

  const task = async () => {
    const out = await select({ ch1: ch1 });
    results.push(out.m);
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
  Promise.resolve().then(() => a.push('lol'));

  const b = newChannel<number>();

  const out = await select({
    a,
    b,
  });
  assert.deepStrictEqual(out, { key: 'a', ch: a, m: 'lol' });

  Promise.resolve().then(() => b.push(123));

  const out2 = await select({
    a,
    b,
  });
  assert.deepStrictEqual(out2, { key: 'b', ch: b, m: 123 });
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
  const ch = channelForSignal(c.signal, 1 as const);

  const abortSymbol = Symbol('abort');

  const out = await select({ [abortSymbol]: ch });
  assert.deepStrictEqual(out, { key: abortSymbol, ch, m: 1 });

  switch (out.key) {
    case abortSymbol:
      break;
    default:
      throw new Error(`blah`);
  }

  const v = ch.next();
  const v2 = ch.next();
  assert.strictEqual(v, 1);
  assert.strictEqual(v2, 1);
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

  const expectedStringKeys = ['0', '1', 'b', 'a', '-1', '1.0'];

  assert.deepStrictEqual(Object.keys(o), expectedStringKeys);
  assert.deepStrictEqual(Reflect.ownKeys(o), [...expectedStringKeys, testSymbol2, testSymbol]);
});

test('gen', async () => {
  const g1 = (async function* () {
    yield 1;
    yield 2;
    return 3;
  })();

  const g2 = (async function* () {
    yield 'a';
    yield 'b';
    return 'c';
  })();

  const c1 = channelForGenerator(g1);
  const c2 = channelForGenerator(g2);

  const values: any[] = [];

  for (;;) {
    const c = await select({ c1, c2 });
    values.push(c.m);

    if (c.ch.closed) {
      break;
    }
  }

  assert.deepStrictEqual(values, [
    { done: false, value: 1 },
    { done: false, value: 2 },
    { done: true, value: 3 },
  ]);
});

test('signal', async () => {
  const a = newChannel<string>();
  const c = new AbortController();
  c.abort();

  const out = await select({ a }, c.signal);
  switch (out?.key) {
    case undefined:
      break;
    case 'a':
      out.m satisfies string;
    // shouldn't run, fall-through
    default:
      assert.fail('bad');
  }
});
