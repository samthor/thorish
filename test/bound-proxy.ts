import test from 'node:test';
import * as assert from 'node:assert';
import { buildBoundProxy } from '../src/bound-proxy.js';

test('buildBoundProxy local object', () => {
  const mod = {
    fn: (x: number) => x + 1,
    primitive: 2,
    [Symbol.toStringTag]: 'Whatever',
  };

  const fake = buildBoundProxy(mod);

  assert.deepStrictEqual(fake[Symbol.toStringTag], 'Whatever');

  const { fn } = fake;
  assert.strictEqual(fn(1), 2);

  fake.fn = (x: number) => x * 100;
  assert.strictEqual(fn(1), 100);
  assert.strictEqual(fake.fn(2), 200);
  assert.notStrictEqual(mod.fn(2), 200, 'original module remains unchanged');

  // this is noop
  fake.fn = fake.fn;
  assert.strictEqual(fn(1), 100);

  // check primitive changes
  const { primitive } = fake;
  fake.primitive = -2;
  assert.notStrictEqual(fake.primitive, primitive);
});

test(`can't create new properties`, () => {
  const o = { x: 1 };
  const fake = buildBoundProxy(o);

  assert.throws(() => {
    Object.defineProperty(fake, 'y', { value: 123 });
  });

  assert.throws(() => {
    fake['fn'] = () => 123;
  });
});

test('mock class ctor', () => {
  class Foo {
    constructor(public x: number) {}
  }
  const o = {
    Foo,
  };

  const fake = buildBoundProxy(o);
  const { Foo: FakeFoo } = fake;

  // construct unmocked
  const f = new FakeFoo(1);
  assert.strictEqual(f.x, 1);
  assert.ok(f instanceof FakeFoo);
  assert.ok(f instanceof Foo);

  // mock
  fake.Foo = class NewFoo {
    x: number;
    constructor(x: number) {
      this.x = x + 1;
    }
  }

  // construct mocked
  const f2 = new FakeFoo(1);
  assert.strictEqual(f2.x, 2);
  assert.ok(f2 instanceof FakeFoo, 'FakeFoo "ref" updates itself');
  assert.ok(!(f2 instanceof Foo), 'not related to original ctor');
});

test('buildBoundProxy module', async () => {
  const mod = await import('./support/module.js');
  const fake = buildBoundProxy(mod);

  assert.deepStrictEqual(fake[Symbol.toStringTag], 'Module');

  const { fn } = fake;
  assert.strictEqual(fn(1), 2);

  Object.defineProperty(fake, 'fn', { value: (x: number) => x * 200 });
  assert.strictEqual(fn(1), 200);

  // same object
  assert.strictEqual(fn, fake.fn);

  assert.throws(() => {
    Object.defineProperty(fake, 'fn', {
      get() {
        return (x: number) => 1;
      },
    });
  }, `can't pass getter or setter`);
});
