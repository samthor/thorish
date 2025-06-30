import test from 'node:test';
import * as assert from 'node:assert';
import * as objectUtils from '../src/object-utils.ts';

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
  assert.deepStrictEqual(
    objectUtils.readMatchAny({ a: { b: objectUtils.matchAny, c: objectUtils.matchAny } }, o),
    [1, 1234],
  );
  assert.deepStrictEqual(objectUtils.readMatchAny({ d: objectUtils.matchAny } as any, o), [
    undefined,
  ]);

  assert.deepStrictEqual(objectUtils.readMatchAny({} as any, undefined), undefined);
  assert.deepStrictEqual(
    objectUtils.readMatchAny({ whatever: objectUtils.matchAny } as any, undefined),
    [undefined],
  );

  assert.deepStrictEqual(objectUtils.readMatchAny({ a: 'hello' } as any, o), undefined);
});

test('intersectObjects', () => {
  assert.strictEqual(objectUtils.intersectObjects(1, 2), undefined);
  assert.strictEqual(objectUtils.intersectObjects(1, 1), 1);

  // undefined is not included
  assert.deepStrictEqual(
    objectUtils.intersectObjects({ a: undefined, b: 1 }, { a: undefined, b: 1 }),
    { b: 1 },
  );

  // check dse but not ===
  assert.deepStrictEqual(
    objectUtils.intersectObjects({ a: 'hello', b: 'bob' }, { a: 'hello', b: 'there' }),
    { a: 'hello' },
  );
  assert.notEqual(
    objectUtils.intersectObjects({ a: 'hello', b: 'bob' }, { a: 'hello', b: 'there' }),
    { a: 'hello' },
  );
});

test('reassignOwnProperty', () => {
  class FooTest {
    y = 0;

    set v(v: number) {
      this.y = -v;
    }

    get v() {
      return -this.y;
    }

    whatever() {
      return true;
    }

    constructor() {
      // CEs are magic, they call their ctor; regular classes don't
      assert.fail('FooTest ctor called');
    }
  }

  function Foo() {}

  const x = new Foo();
  x.v = 123;
  assert.strictEqual(x.v, 123);
  assert.strictEqual(x.y, undefined);

  Object.setPrototypeOf(Foo.prototype, FooTest.prototype);
  assert.strictEqual(x.v, 123);
  assert.strictEqual(x.y, undefined);

  assert.strictEqual(x.whatever(), true);

  const props = Object.getOwnPropertyDescriptors(x);
  console.info(props);

  objectUtils.reassignOwnProperty(x, 'v');
  assert.strictEqual(x.v, 123);
  assert.strictEqual(x.y, -123);
});
