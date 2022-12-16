import test from 'node:test';
import * as assert from 'node:assert';
import { combineAsyncGenerators, asyncGeneratorForHandler, asyncGeneratorQueue } from '../src/generator.js';
import { WorkQueue } from '../src/queue.js';
import { timeout, wrapTrigger } from '../src/promise.js';

test('combineAsyncGenerators empty', async () => {
  const g = combineAsyncGenerators([]);
  for await (const next of g) {
    assert.fail('should have no values');
  }
  const doneValue = await g.next();
  assert.deepStrictEqual(doneValue, { done: true, value: undefined });  // won't show up outside loop

  const g2 = combineAsyncGenerators([]);
  const next = await g2.next();
  assert.deepStrictEqual(next, { done: true, value: [] });
});

test('asyncGeneratorForHandler', async () => {
  const c = new AbortController();

  let once = false;
  const gen = asyncGeneratorForHandler(() => wrapTrigger(setTimeout, 2), { signal: c.signal });
  for await (const x of gen) {
    if (once) {
      assert.fail('Should not run loop twice');
    }
    once = true;
    c.abort();
  }
});

test('combineAsyncGenerators', async () => {
  const wq1 = new WorkQueue<number>();
  const wq2 = new WorkQueue<number>();
  const gen1 = wq1.asyncGenerator();
  const gen2 = wq2.asyncGenerator();

  const task = (async () => {
    await timeout(1);
    wq2.push(1);
    await timeout(1);
    wq1.push(1);
    wq2.push(2);
    wq1.push(2);

    // send final end
    wq1.push(0);
  })();

  const results: number[] = [];
  const c = combineAsyncGenerators([gen1, gen2]);
  for await (const out of c) {
    if (out.value === 0) {
      break;
    }
    results.push(((out.index + 1) * 100) + out.value);
  }

  assert.deepStrictEqual(results, [201, 101, 202, 102]);
  await task;
});

test('asyncGeneratorQueue', async () => {
  const q = asyncGeneratorQueue<number>();

  (async () => {
    q.push(1);
    q.push(2);
    q.done();

    try {
      q.push(123);
      assert.fail('Should throw when pushing after done');
    } catch {}

    try {
      q.done();
      assert.fail('Should throw when completing after done');
    } catch {}
  })();

  const values: number[] = [];
  for await (const out of q.generator) {
    values.push(out);
  }
  assert.deepStrictEqual(values, [1, 2]);
});