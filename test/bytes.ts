import test from 'node:test';
import * as assert from 'node:assert';
import * as bytes from '../src/bytes.js';

test('bytes', () => {
  const out = bytes.base64ToBytes('/x2KiKopmY9lQLirC8boas1sjXI=');

  const values = [...out];

  assert.deepStrictEqual(
    values,
    [
      255, 29, 138, 136, 170, 41, 153, 143, 101, 64, 184, 171, 11, 198, 232, 106, 205, 108, 141,
      114,
    ],
  );
});
