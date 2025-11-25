import test from 'node:test';
import * as assert from 'node:assert';
import { WeakIdentityCache } from '../src/memory.ts';
import { timeout } from '../src/promise.ts';
import { checkGC, forceNodeGC } from './support/node.ts';

class Blah {}

test('memory', async () => {
  const cleanups: { n: number; s: string }[] = [];

  const c = new WeakIdentityCache<[number, string], Blah>(
    () => new Blah(),
    (n, s) => {
      cleanups.push({ n, s });
    },
  );

  let out = c.get(123, 'blah') as Blah | undefined;
  assert.notStrictEqual(out, undefined);
  assert.strictEqual(c.size as any, 1);
  out = undefined;

  c.get(123, 'blah');
  c.get(1000, '');
  c.get(0, '');
  c.get(-0, '');
  c.get(-0.5, 'x');
  assert.strictEqual(c.get(0, ''), c.get(-0, ''));
  assert.strictEqual(c.size, 4);

  c.delete(-0.5, 'x');
  assert.strictEqual(c.size, 3);

  await checkGC(() => assert.strictEqual(c.size, 0));

  cleanups.sort(({ n: a }, { n: b }) => a - b);

  assert.deepStrictEqual(cleanups, [
    { n: 0, s: '' },
    { n: 123, s: 'blah' },
    { n: 1000, s: '' },
  ]);
});

test('memory void', async () => {
  const c = new WeakIdentityCache<[], Blah>(() => new Blah());

  c.get();
  c.get();
  c.get();
  assert.strictEqual(c.size, 1);
  await checkGC(() => assert.strictEqual(c.size, 0));
});
