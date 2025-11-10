import test from 'node:test';
import * as assert from 'node:assert';
import { timeout } from '../src/promise.ts';
import { buildMux, type MuxSession } from '../src/mux.ts';
import { forEachAsync } from '../src/generator.ts';

test('mux', async (t) => {
  const mux = buildMux(async (session: MuxSession<string, string>) => {
    for (;;) {
      const out = await Promise.race([session.waitForTask(), timeout(5)]);
      if (!out) {
        return;
      }

      const next = session.nextTask();
      if (!next) {
        continue;
      }

      if ('data' in next) {
        session.handle(next.token, 'RES:' + next.data);
        session.stop(next.token, new Error('lol'));
      }
    }
  });

  const c1 = new AbortController();
  const call1 = mux.call(c1.signal);
  call1.send('go');

  const task = (async () => {
    const res = await forEachAsync(call1.gen, (data) => {
      assert.strictEqual(data, 'RES:go');
    });
    assert.deepStrictEqual(res, new Error('lol'));
  })();

  await timeout(10);

  await task;
});
