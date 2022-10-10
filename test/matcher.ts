import test from 'node:test';
import * as assert from 'node:assert';
import { Matcher, matchAny } from '../src/matcher';

test('matcher match helpers', () => {
  const m = new Matcher<string, any>();

  m.set('asdfsad', 1234);

  m.set('abc', { x: 1 });
  assert.deepStrictEqual([...m.matchAll({ x: matchAny })], ['abc']);
  assert.deepStrictEqual([...m.matchAll({ x: 2 })], []);
  assert.strictEqual(m.matchAny({ y: 2 }), false);

  m.set('def', { x: 1, y: 2 });
  assert.deepStrictEqual([...m.matchAll({ x: matchAny })], ['abc', 'def']);
  assert.strictEqual(m.matchAny({ y: 2 }), true);

  assert.strictEqual(m.delete('def'), true);
  assert.strictEqual(m.matchAny({ y: 2 }), false);
});

test('read', () => {
  const m = new Matcher<string, { x: number, y: number, z: { a: number, b: number } }>();

  assert.deepStrictEqual(m.read([]), undefined);

  m.set('qqq', { x: 1, y: 2, z: { a: 3, b: 4 } });
  assert.deepStrictEqual(m.read(['qqq']), { x: 1, y: 2, z: { a: 3, b: 4 } });

  m.set('bar', { x: 2, y: 3, z: { a: 3, b: 100 }});
  assert.deepStrictEqual(m.read(['bar', 'qqq']), { z: { a: 3 } });

  assert.deepStrictEqual(m.read(['bar', 'qqq2']), undefined);
});

test('matcher sub', () => {
  const m = new Matcher<string, any>();
  const s = new Set<string>();

  const c = new AbortController();

  m.sub({ x: 1 }, s, { signal: c.signal });
  assert.strictEqual(s.size, 0);

  m.set('abc', { x: 1 });
  assert.strictEqual(s.size, 1);

  m.set('def', { x: 1, y: 123 });
  assert.strictEqual(s.size, 2);

  m.set('ghi', { q: 1, zz: { x: 1 } });
  assert.strictEqual(s.size, 2);

  m.set('def', undefined);
  assert.strictEqual(s.size, 1);

  c.abort();
  // doesn't call .delete
  assert.strictEqual(s.size, 1);
  m.set('def', { x: 1 });
  assert.strictEqual(s.size, 1);
});

test('matcher sub init', () => {
  const m = new Matcher<string, any>();
  m.set('123', { qqq: 123 });

  const s = new Set<string>();
  m.sub({ qqq: matchAny }, s);
  assert.strictEqual(s.size, 1);
});
