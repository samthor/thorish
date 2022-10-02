import test from 'node:test';
import * as assert from 'node:assert';
import { workTask } from '../src';

test('task', async () => {
  const c = new AbortController();
  const signal = c.signal;

  const t = workTask<number>((...args) => {
    assert.deepStrictEqual(args, [1, 2, 3]);
  }, { signal });

  t.queue(1);
  t.queue(2);
  t.queue(3);

  await new Promise((r) => setTimeout(r, 20));

  c.abort();
  await t.done;
});
