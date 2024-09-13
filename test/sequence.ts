import test from 'node:test';
import * as assert from 'node:assert';
import { buildSequencer } from '../src/sequence.js';

test('buildSequenceListener', () => {
  const { addListener, notify } = buildSequencer<number>();

  const values: number[] = [];

  addListener(async (value, next) => {
    values.push(value);
    const v2 = await next();
    values.push(v2);
  });

  notify(1);
  notify(2);

  assert.deepStrictEqual(values, [1, 2]);
});
