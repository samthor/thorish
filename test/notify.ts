import test from 'node:test';
import * as assert from 'node:assert';
import { objectNotify, objectNotifyAll, objectWait } from '../src/notify.ts';

test('notify', async (t) => {
  const o = new Object();

  assert.strictEqual(objectNotify(o), false);

  const w1 = objectWait(o);
  const w2 = objectWait(o);

  await assertPending(w1);
  await assertPending(w2);

  assert.strictEqual(objectNotify(o), true);
  await Promise.resolve();

  await assertResolved(w1);
  await assertPending(w2);

  assert.strictEqual(await w1, true);

  assert.strictEqual(objectNotifyAll(o), 1);
  await Promise.resolve();

  await assertResolved(w2);
});

test('notify abort', async (t) => {
  const o = new Object();

  assert.strictEqual(objectNotify(o), false);

  const c = new AbortController();
  const w1 = objectWait(o, c.signal);
  await Promise.resolve();

  c.abort();

  assert.strictEqual(objectNotify(o), false);
  await Promise.resolve();

  await assertResolved(w1);
  assert.strictEqual(await w1, false);
});

async function assertResolved(x: Promise<any>) {
  const y = Symbol('unique');
  const out = await Promise.race([x, Promise.resolve(y)]);
  if (out === y) {
    assert.fail('not resolved');
  }
}
async function assertPending(x: Promise<any>) {
  const y = Symbol('unique');
  const out = await Promise.race([x, Promise.resolve(y)]);
  if (out !== y) {
    assert.fail("promise wasn't pending");
  }
}
