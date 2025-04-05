import test from 'node:test';
import * as assert from 'node:assert';
import * as support from '../src/support/index.js';
import { toBase64Url, base64UrlToString } from '#support';

import * as browser from '../src/support/browser.ts';

test('bytes', () => {
  const out = support.base64UrlToBytes('/x2KiKopmY9lQLirC8boas1sjXI=');

  const values = [...out];

  assert.deepStrictEqual(
    values,
    [
      255, 29, 138, 136, 170, 41, 153, 143, 101, 64, 184, 171, 11, 198, 232, 106, 205, 108, 141,
      114,
    ],
  );
});

test('enc', () => {
  const strings = [
    'Hello',
    'There.bob',
    '/asdfsad/1+_-1/4~~~111',
    'hello⛳❤️🧀',
    '',
    'q',
    'ab',
    'abc',
    'abcd',
    'abcde',
    'abcdef',
  ];

  for (const s of strings) {
    const enc = toBase64Url(s);
    const dec = base64UrlToString(enc);

    assert.strictEqual(dec, s);
  }

  // check browser behavior (using atob/btoa and friends)
  for (const s of strings) {
    const enc = browser.toBase64Url(s);
    const dec = browser.base64UrlToString(enc);

    assert.strictEqual(dec, s);
  }
});

test('concat', () => {
  const a = new Uint8Array([1]);
  const b = new Uint8Array([2]);

  const c = support.concatBytes([a, b, a]);
  assert.deepStrictEqual([...c], [1, 2, 1]);
});
