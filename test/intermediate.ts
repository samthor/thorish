import test from 'node:test';
import * as assert from 'node:assert';
import { buildAsyncIntermediate } from '../src/intermediate.js';

test('buildAsyncIntermediate', async () => {
  const i = buildAsyncIntermediate<number, string>();
  const actualValues: number[] = [];

  let consumed = 0;

  const p1 = i.send(123);
  const p2 = i.send(256);
  const p3 = i.stop('hello');

  const task = (async () => {
    for (;;) {
      const next = await i.gen.next();
      if (next.done) {
        assert.strictEqual(next.value, 'hello');
        break;
      }
      const { value } = next;
      ++consumed;
      actualValues.push(value);
    }
  })();

  await p1;
  assert.strictEqual(consumed, 1);

  await p2;
  assert.strictEqual(consumed, 2);

  await p3;
  assert.strictEqual(consumed, 2);

  await task;
  assert.strictEqual(consumed, 2);

  assert.deepStrictEqual(actualValues, [123, 256]);
});

test('buildAsyncIntermediate void', async () => {
  const i = buildAsyncIntermediate<void>();
  const sendPromise = i.send();

  const next = await i.gen.next();
  assert.deepStrictEqual(next, { value: undefined, done: false });

  const donePromise = i.gen.next();

  await sendPromise;

  await i.stop();
  await donePromise;
});
