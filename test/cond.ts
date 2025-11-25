import test from 'node:test';
import * as assert from 'node:assert';
import { Condition } from '../src/cond.ts';

test('cond', () => {
  const c = new Condition(false);

  assert.strictEqual(c.observed(), false);
  assert.strictEqual(c.state, false);

  c.state = true;
  assert.strictEqual(c.observed(), false);

  const calls: boolean[] = [];
  const listener = (state: boolean) => calls.push(state);
  assert.strictEqual(c.addListener(listener), true);
  assert.strictEqual(c.addListener(listener), false);

  c.state = false;
  assert.deepStrictEqual(calls, [], 'should not be called, both not set');

  c.state = true;
  assert.deepStrictEqual(calls, [true]);

  assert.strictEqual(c.removeListener(listener), true);
  assert.strictEqual(c.removeListener(listener), false);

  assert.strictEqual(c.addListener(listener, { both: true }), true);
  c.state = false;
  c.state = true;
  assert.deepStrictEqual(calls, [true, false, true]);
});
