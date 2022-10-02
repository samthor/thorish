
import test from 'node:test';
import * as assert from 'node:assert';
import * as objectUtils from '../src/object-utils';

test('matchPartial', () => {
  const o = {
    a: {
      b: 1,
    },
    b: 2,
    isNull: null,
    isUndefined: undefined,
  };

  assert.strictEqual(objectUtils.matchPartial({ b: 2 }, o), true);
  assert.strictEqual(objectUtils.matchPartial({ b: 1 }, o), false);
  assert.strictEqual(objectUtils.matchPartial({ a: { b: 1 } }, o), true);

  assert.strictEqual(objectUtils.matchPartial({ c: objectUtils.matchAny } as any, o), false);
  assert.strictEqual(objectUtils.matchPartial({ a: objectUtils.matchAny }, o), true);

  // null matches
  assert.strictEqual(objectUtils.matchPartial({ isNull: objectUtils.matchAny }, o), true);

  // undefined does not
  assert.strictEqual(objectUtils.matchPartial({ isUndefined: objectUtils.matchAny }, o), false);
});


test('readMatchAny', () => {
  const o = {
    a: {
      b: 1,
      c: 1234,
    },
    b: 2,
  };

  assert.deepStrictEqual(objectUtils.readMatchAny({ a: { b: objectUtils.matchAny } }, o), [1]);
  assert.deepStrictEqual(objectUtils.readMatchAny({ a: { b: objectUtils.matchAny, c: objectUtils.matchAny } }, o), [1, 1234]);
  assert.deepStrictEqual(objectUtils.readMatchAny({ d: objectUtils.matchAny } as any, o), undefined);
});
