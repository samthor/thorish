import test from 'node:test';
import * as assert from 'node:assert';
import { prepareEffectTrigger } from '../src/effect.js';

test('effect', () => {
  const invocations: { a?: number; b?: number }[] = [];

  const values = prepareEffectTrigger<{
    a: number;
    b: number;
  }>().build(
    (signal, cbValues) => {
      invocations.push(cbValues);
    },
    ['a'],
  );

  values.b = 123;
  assert.strictEqual(invocations.length, 0);

  values.a = 456;
  assert.strictEqual(invocations.length, 1);
  assert.deepStrictEqual(invocations[0], { a: 456, b: 123 });

  delete values.b;
  assert.strictEqual(invocations.length, 2);
  assert.deepStrictEqual(invocations[1], { a: 456 });

  values.b = undefined;
  assert.strictEqual(invocations.length, 2);
});
