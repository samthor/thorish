import test from 'node:test';
import * as assert from 'node:assert';
import * as promise from '../src/promise.ts';

test('setTimeout', async () => {
  const t = promise.wrapTrigger(setTimeout, 10);
  await t;
  assert.ok(true);
});

test('timeout', async () => {
  const start = performance.now();
  const c = new AbortController();

  const tp = promise.timeout(500, c.signal);
  await promise.timeout(10);
  c.abort();
  await tp;

  const duration = performance.now() - start;
  if (duration > 100) {
    assert.fail('should abort early');
  }
});

test('spliceNextPromise', async () => {
  const unresolvedPromise = Promise.race([]);
  const arr = [
    unresolvedPromise,
    unresolvedPromise,
    Promise.resolve('this_one'),
    unresolvedPromise,
  ];
  assert.strictEqual(arr.length, 4);

  const out = await promise.spliceNextPromise(arr);
  assert.strictEqual(out, 'this_one');
  assert.strictEqual(arr.length, 3);
});

test('buildCallTrain', async () => {
  let count = 0;
  const fn = promise.buildCallTrain(async () => {
    await true; // microtask
    const localCount = ++count;
    return localCount;
  });

  const c1 = fn();
  const c2 = fn();
  const r1 = await c1;
  const r2 = await c2;
  assert.deepStrictEqual([r1, r2], [1, 1]);

  const c3 = fn();
  const c4 = fn();
  const r3 = await c3;
  const r4 = await c4;
  assert.deepStrictEqual([r3, r4], [2, 2]);
});

test('rafRunner', async () => {
  let usePolyfill = false;
  try {
    if (typeof requestAnimationFrame !== 'function') {
      global.requestAnimationFrame = (c) => setTimeout(c, 0);
      usePolyfill = true;
    }

    let count = 0;
    const f = promise.rafRunner(() => {
      count++;
    });

    f();
    f();
    assert.strictEqual(count, 0);

    await new Promise((r) => requestAnimationFrame(r));
    assert.strictEqual(count, 1);

    promise.rafRunner(
      () => {
        count++;
      },
      { immediate: true },
    );
    assert.strictEqual(count, 1);

    await new Promise((r) => requestAnimationFrame(r));
    assert.strictEqual(count, 2);

    // check fastFrameRunner only runs once
    count = 0;
    const r = promise.fastFrameRunner(() => {
      count++;
    });
    r();
    await Promise.all([
      new Promise((r) => requestAnimationFrame(r)),
      new Promise((r) => setTimeout(r, 0)),
    ]);
    assert.strictEqual(count, 1);
  } finally {
    if (usePolyfill) {
      // @ts-ignore
      delete global['requestAnimationFrame'];
    }
  }
});
