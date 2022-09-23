import test from 'node:test';
import * as assert from 'node:assert';
import { WorkQueue } from '../src/queue';
import { wrapTrigger } from '../src/promise';

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
    console.info('wait1 fire', wq.length);
    const p = wq.pop();
    console.info('wait1 got', p);
    assert.ok(p);
    wait1fire = true;
  });
  const done2 = wait2.then(() => {
    console.info('wait2 fire', wq.length);
    const p = wq.pop();
    console.info('wait2 got', p);
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
  console.debug({wait1, wait1fire, wait2, wait2fire, length: wq.length});
  assert.ok(wait1fire && wait2fire, 'both must be fired');
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