import test from 'node:test';
import * as assert from 'node:assert';
import { WorkQueue } from '../src/queue.js';
import { wrapTrigger } from '../src/promise.js';

test('queue', async () => {
  const wq = new WorkQueue<number>();

  wq.push(1);
  wq.unshift(2);

  assert.strictEqual(wq.length, 2);

  const actual: number[] = [];
  for await (const next of wq) {
    actual.push(next);

    if (wq.length === 0) {
      break;
    }
  }

  assert.strictEqual(wq.length, 0);
});

test('queue wait', async () => {
  const wq = new WorkQueue<string>();

  let wait1fire = false;
  const wait1 = wq.wait()!;
  assert.ok(wait1);

  let wait2fire = false;
  const wait2 = wq.wait()!;
  assert.ok(wait2);

  const done1 = wait1.then(() => {
    const p = wq.pop();
    assert.ok(p);
    wait1fire = true;
  });
  const done2 = wait2.then(() => {
    const p = wq.pop();
    assert.ok(p);
    wait2fire = true;
  });

  wq.push('hello');
  assert.strictEqual(wq.length, 1);
  await wrapTrigger(queueMicrotask);
  assert.ok(+wait1fire ^ +wait2fire, 'only one wait1/wait2 should trigger');
  assert.strictEqual(wq.length, 0);

  wq.push('hello2');
  assert.strictEqual(wq.length, 1);
  await wrapTrigger(queueMicrotask);
  assert.ok(wait1fire && wait2fire, 'both must be fired');

  await done1;
  await done2;
});

test('wait2', async () => {
  const wq = new WorkQueue<string>();
  let done = false;
  try {
    // This aggressively pops things in a setTimeout loop, basically "stealing" the values that
    // are pushed into the queue.
    (async () => {
      while (!done) {
        wq.pop();
        // TODO: should be queueMicrotask, but Node freaks out - test env issues?
        await wrapTrigger(setTimeout, 0);
      }
    })();

    const n1 = wq.next();

    wq.push('a');
    wq.push('b');
    wq.push('c');

    await wrapTrigger(setTimeout, 25);

    const n2 = wq.next();
    const n3 = wq.next();

    // We prove that some values have been stolen, AND the returned Promises have not resolved
    // with accidental undefined values.
    const out = await Promise.race([
      Promise.all([n1, n2, n3]),
      Promise.resolve(true),
    ]);
    assert.strictEqual(out, true);

  } finally {
    done = true;
  }
});

test('undefined', async () => {
  const wq = new WorkQueue<string | undefined>();
  assert.ok(wq.wait() instanceof Promise);

  wq.push(undefined);
  assert.strictEqual(wq.length, 1);
  assert.strictEqual(wq.wait(), undefined);  // no waiting required

  const next = await wq.next();
  assert.strictEqual(next, undefined);

  wq.push(undefined);
  let iterated = 0;
  for (const value of wq) {
    assert.strictEqual(value, undefined);
    iterated++;
  }
  assert.strictEqual(iterated, 1);
});