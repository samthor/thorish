import test from 'node:test';
import * as assert from 'node:assert';
import * as tree from '../src/tree.js';

test('extreme', () => {
  const t0 = new tree.NumericJoinTree([]);
  assert.deepStrictEqual([...t0.values()], []);

  const t1 = new tree.NumericJoinTree([1]);
  assert.deepStrictEqual([...t1.values()], [1]);

  const t2 = new tree.NumericJoinTree([-100, 2]);
  assert.deepStrictEqual([...t2.values()], [-100, 2]);
});

test('tree', () => {
  const valueSet = new Set<number>();
  for (let i = 0; i < 10_000; ++i) {
    const v = Math.floor(Math.random() * 1_000_000);
    valueSet.add(v);
  }
  const values = [...valueSet];

  const t = new tree.NumericJoinTree(values);

  assert.deepStrictEqual([...t.values()], values);

  const leftValue = values.at(32)!;
  const rightValue = values.at(values.length >>> 1)!;

  assert.ok(t.join(leftValue, rightValue));
  assert.ok(!t.join(leftValue, rightValue));
});
