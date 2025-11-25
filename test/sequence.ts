import test from 'node:test';
import * as assert from 'node:assert';
import { buildSequencer } from '../src/sequence.ts';
import { timeout } from '../src/promise.ts';

test('buildSequenceListener', async () => {
  const c = new AbortController();
  const { addListener, notify } = buildSequencer<number>();

  const values: number[][] = [];

  addListener(
    async (value, next) => {
      const out: number[] = [];
      values.push(out);

      out.push(value);
      for (;;) {
        const v2 = await next();
        out.push(v2);
      }
    },
    { signal: c.signal },
  );

  notify(1);
  notify(2);
  await timeout(1);

  assert.deepStrictEqual(values, [[1, 2], [2]]);

  // first two runs will still be active - won't have 3rd
  c.abort();
  notify(3);
  await timeout(1);
  assert.deepStrictEqual(values, [
    [1, 2, 3],
    [2, 3],
  ]);
});
