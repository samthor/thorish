
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
  assert.deepStrictEqual(objectUtils.readMatchAny({ d: objectUtils.matchAny } as any, o), [undefined]);

  assert.deepStrictEqual(objectUtils.readMatchAny({} as any, undefined), undefined);
  assert.deepStrictEqual(objectUtils.readMatchAny({ whatever: objectUtils.matchAny } as any, undefined), [undefined]);
});

test('intersectObjects', () => {
  assert.strictEqual(objectUtils.intersectObjects(1, 2), undefined);
  assert.strictEqual(objectUtils.intersectObjects(1, 1), 1);

  // undefined is not included
  assert.deepStrictEqual(objectUtils.intersectObjects({ a: undefined, b: 1 }, { a: undefined, b: 1 }), { b: 1 });

  // check dse but not ===
  assert.deepStrictEqual(objectUtils.intersectObjects({ a: 'hello', b: 'bob' }, { a: 'hello', b: 'there' }), { a: 'hello' });
  assert.notEqual(objectUtils.intersectObjects({ a: 'hello', b: 'bob' }, { a: 'hello', b: 'there' }), { a: 'hello' });
});
