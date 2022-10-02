import test from 'node:test';
import * as assert from 'node:assert';
import * as maps from '../src/maps';

test('CountSet', () => {
  const c = new maps.CountSet<string>();

  assert.strictEqual(c.add('hello'), true);
  assert.strictEqual(c.add('hello'), true);
  assert.strictEqual(c.total(), 2);
  assert.deepStrictEqual([...c.uniques()], ['hello']);

  assert.strictEqual(c.add('there'), true);
  assert.strictEqual(c.total(), 3);
  assert.deepStrictEqual([...c.uniques()], ['hello', 'there']);

  assert.strictEqual(c.delete('hello'), true);
  assert.strictEqual(c.has('hello'), true);
  assert.deepStrictEqual([...c.uniques()], ['hello', 'there']);
  assert.strictEqual(c.delete('hello'), true);

  assert.strictEqual(c.has('hello'), false);
  assert.strictEqual(c.delete('hello'), false);
});

test('pair', () => {
  const c = new maps.PairSet<string>();

  assert.strictEqual(c.add('a', 'b'), true);
  assert.strictEqual(c.add('a', 'b'), false);
  assert.strictEqual(c.add('b', 'a'), false);
  assert.strictEqual(c.has('b', 'a'), true);
  assert.strictEqual(c.hasAny('b'), true);
  assert.strictEqual(c.hasAny('a'), true);
  assert.strictEqual(c.hasAny('c'), false);

  assert.strictEqual(c.add('b', 'c'), true);
  assert.strictEqual(c.hasAny('b'), true);
  assert.deepStrictEqual([...c.otherKeys('b')], ['a', 'c']);

  assert.strictEqual(c.delete('b', 'a'), true);
  assert.strictEqual(c.delete('b', 'a'), false);
  assert.deepStrictEqual([...c.otherKeys('b')], ['c']);
});

test('multimap', () => {
  const m = new maps.MultiMap<string, number>();

  assert.strictEqual(m.add('hello', 1), true);
  assert.strictEqual(m.add('hello', 2), true);
  assert.strictEqual(m.add('hello', 1), false);
  assert.strictEqual(m.count('hello'), 2);
  assert.deepStrictEqual([...m.get('hello')], [1, 2]);
  assert.strictEqual(m.delete('hello', 2), true);
  assert.strictEqual(m.delete('hello', 2), false);
  assert.strictEqual(m.count('hello'), 1);
  assert.strictEqual(m.delete('hello', 1), true);
  assert.deepStrictEqual([...m.get('hello')], []);
});
