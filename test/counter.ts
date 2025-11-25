import test from 'node:test';
import * as assert from 'node:assert';
import { StatsCount } from '../src/counter.ts';

test('counter', () => {
  const sc = new StatsCount();

  sc.inc('hello', 0);
  assert.ok(!sc.has('hello'));

  sc.inc('hello', -1);
  assert.ok(sc.has('hello'));

  sc.inc('hello', -100);
  assert.strictEqual(sc.get('hello'), -101);

  assert.strictEqual(sc.update('there', 0.1), 0.1);
  assert.strictEqual(sc.update('there', 0.1), 0.2);

  assert.deepStrictEqual([...sc.keys()], ['hello', 'there']);
});
