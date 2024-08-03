import test from 'node:test';
import * as assert from 'node:assert';
import { readableToJson } from '../src/stream.js';

const te = new TextEncoder();

test('json', async () => {
  const r = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(te.encode('{"x"'));

      setTimeout(() => {
        c.enqueue(te.encode(':123}'));
        c.close();
      }, 2);
    },
  });

  const json = await readableToJson(r);
  assert.deepStrictEqual(json, { x: 123 });
});

test('json bad', async () => {
  const r = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(te.encode('{"x"}'));
      c.close();
    },
  });

  try {
    await readableToJson(r);
    assert.fail('should have thrown');
  } catch {
    // ok
  }
});
