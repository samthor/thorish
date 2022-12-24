
import test from 'node:test';
import * as assert from 'node:assert';
import * as expirable from '../src/expirable.js';

test('buildExpirable', () => {
  let count = 0;
  const c = new AbortController();
  const getter = () => {
    const localCount = ++count;
    return {
      result: localCount,
      signal: c.signal,
    };
  };

  const expirableGetter = expirable.buildExpirable(getter);
  const { result } = expirableGetter();
  c.abort();

  const { result: result2 } = expirableGetter();
  const { result: result3 } = expirableGetter();

  assert.strictEqual(result, 1);
  assert.strictEqual(result2, 2);
  assert.strictEqual(result3, 2);
});

test('buildAsyncExpirable', async () => {
  const c = new AbortController();
  let urlString = 'hello';

  const buildUrlString = expirable.buildAsyncExpirable(async () => {
    return { result: urlString, signal: c.signal };
  });

  const buildConnection = expirable.buildAsyncExpirable(async () => {
    const { result: urlString, signal } = await buildUrlString();

    // create a "connection" object
    const o = { urlString };

    return { result: o, signal };
  });

  const c1 = await buildConnection();
  urlString = 'update';

  const c2 = await buildConnection();

  c.abort();
  urlString = 'after-abort';
  const c3 = await buildConnection();

  assert.deepStrictEqual(c1, { urlString: 'hello' });
  assert.deepStrictEqual(c2, { urlString: 'hello' });
  assert.deepStrictEqual(c3, { urlString: 'after-abort' });

  assert.strictEqual(c1, c2);
  assert.notStrictEqual(c2, c3);
});
