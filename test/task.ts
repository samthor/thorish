import test from 'node:test';
import * as assert from 'node:assert';
import { runner, workTask } from '../src/task.ts';
import { promiseWithResolvers, timeout } from '../src/promise.ts';

test('task', async () => {
  const c = new AbortController();
  const signal = c.signal;

  const t = workTask<number>(
    (...args) => {
      assert.deepStrictEqual(args, [1, 2, 3]);
    },
    { signal },
  );

  t.queue(1);
  t.queue(2);
  t.queue(3);

  await new Promise((r) => setTimeout(r, 20));

  c.abort();
  await t.done;
});

test('runner', async () => {
  const r = runner();
  const outerThis = this;

  const result1 = await r(async () => {
    assert.strictEqual(this, outerThis);
    return 123;
  });
  assert.strictEqual(result1, 123);

  let result2: number = 0;
  let result3: number = 0;
  const { promise: barrier, resolve: releaseBarrier } = promiseWithResolvers<void>();

  const t1 = r(async () => {
    await barrier;
    result2 = 2;
  });

  const t2 = r(async () => {
    result3 = 3;
  });

  assert.strictEqual(result2, 0);
  assert.strictEqual(result3, 0);

  releaseBarrier();
  await t1;
  assert.strictEqual(result2, 2);

  await t2;
  assert.strictEqual(result3, 3);
});

test('runner this', async () => {
  const rthis = runner({ x: 1 });

  await rthis(function (this: { x: 1 }) {
    assert.strictEqual(this.x, 1);
  });
});

test('runner fail', async () => {
  const r = runner();

  const expectedFailure = r(() => {
    throw 123;
  });

  const out = await r(() => 456);
  assert.strictEqual(out, 456);

  try {
    await expectedFailure;
  } catch (e) {
    assert.strictEqual(e, 123);
  }
});
