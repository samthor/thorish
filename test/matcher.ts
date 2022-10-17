import test from 'node:test';
import * as assert from 'node:assert';
import { Matcher, matchAny, MatcherGroup, CombineGroup } from '../src/matcher';

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

  m.set('bar', { x: 2, y: 3, z: { a: 3, b: 100 } });
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

test('matcher sub any', () => {
  const m = new Matcher<string, any>();

  m.set('foo', { a: 1 });

  const calls: string[] = [];
  m.sub({ a: matchAny }, {
    add(k) {
      calls.push('add:' + k);
    },
    delete(k) {
      calls.push('delete:' + k);
    },
  });
  assert.deepStrictEqual(calls, ['add:foo']);

//  m.delete('foo');
  m.set('foo', { a: 2 });
  assert.deepStrictEqual(calls, ['add:foo', 'delete:foo', 'add:foo']);
  
});

test('group', () => {
  const m = new Matcher<string, any>();
  const mg = new MatcherGroup<string, any>({ x: matchAny }, m);

  let calls = 0;
  const listener = () => {
    ++calls;
  };
  mg.addListener(listener);

  m.set('hello', { x: 123 });
  assert.strictEqual(calls, 1);
  assert.deepStrictEqual([...mg.matching()], ['hello']);

  m.set('hello2', { y: 456 });
  assert.strictEqual(calls, 1);

  m.set('hello3-match', { x: 123 });
  assert.strictEqual(calls, 1);  // still active
  assert.deepStrictEqual([...mg.matching()], ['hello', 'hello3-match']);

  mg.removeListener(listener);
  assert.deepStrictEqual([...mg.matching()], ['hello', 'hello3-match']);

  m.delete('hello');
  m.delete('hello3-match');
  assert.deepStrictEqual([...mg.matching()], []);
});

test('combine', () => {
  const m = new Matcher<string, any>();

  const mg1 = new MatcherGroup<string, any>({ x: 1 }, m);
  const mg2 = new MatcherGroup<string, any>({ y: 1 }, m);

  const and = new CombineGroup([mg1, mg2]);

  mg1.addListener(() => console.info('mg1 pass', { x: 1 }));
  mg2.addListener(() => console.info('mg2 pass', { y: 1 }));

  let calls = 0;
  and.addListener(() => {
    console.info('AND called');
    ++calls;
  });

  console.info('listeners setup', calls);

  m.set('a', { x: 1 });
  assert.strictEqual(and.active(), false, 'not active, only one condition hit');
  assert.strictEqual(calls, 0);

  m.set('a', { x: 1, y: 1 });
  assert.strictEqual(and.active(), true, 'now active');
  assert.strictEqual(calls, 1);

  m.set('a', { y: 1 });
  assert.strictEqual(mg1.active(), false);
  assert.strictEqual(mg2.active(), true);
  assert.strictEqual(and.active(), false, 'should have cleared active state');
  assert.strictEqual(calls, 1);

  m.set('b', { x: 1 });
  assert.strictEqual(and.active(), true, 'should be unified a/b causing active');
  assert.strictEqual(calls, 2);
});