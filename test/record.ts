import test from 'node:test';
import * as assert from 'node:assert';
import { filterRecord, mapRecord, mapRecordAsync } from '../src/record.js';

test('filter creates new object', () => {
  const input = { abc: 1, def: 2 };
  const output = filterRecord(input);
  assert.notStrictEqual(output, input);
  assert.deepStrictEqual(output, input);
});

test('filter works', () => {
  const input = { abc: 1, def: 2 };
  const output = filterRecord(input, (_, value) => value === 1);
  assert.deepStrictEqual(output, { abc: 1 });
});

test('map', () => {
  const input = { a: 1, bc: 2, def: 3 };
  const output = mapRecord(input, (key, value) => (value += key.length));
  assert.deepStrictEqual(output, { a: 2, bc: 4, def: 6 });
});

test('async map', async () => {
  const input = { abc: 1, def: 2 };
  const output = await mapRecordAsync(input, async (_, value) => {
    await Promise.resolve();
    return value === 2;
  });
  assert.deepStrictEqual(output, { abc: false, def: true });
});
