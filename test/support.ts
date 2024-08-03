import test from 'node:test';
import * as assert from 'node:assert';
import * as support from '../src/support/index.js';

test('bytes', () => {
  const out = support.base64ToBytes('/x2KiKopmY9lQLirC8boas1sjXI=');

  const values = [...out];

  assert.deepStrictEqual(
    values,
    [
      255, 29, 138, 136, 170, 41, 153, 143, 101, 64, 184, 171, 11, 198, 232, 106, 205, 108, 141,
      114,
    ],
  );
});

test('concat', () => {
  const a = new Uint8Array([1]);
  const b = new Uint8Array([2]);

  const c = support.concatBytes([a, b, a]);
  assert.deepStrictEqual([...c], [1, 2, 1]);
});
