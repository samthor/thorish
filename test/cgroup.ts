import test from 'node:test';
import * as assert from 'node:assert';
import { CGroup } from '../src/cgroup.ts';

test('cgroup', () => {
  const cg = new CGroup();

  const c = new AbortController();
  cg.add(c.signal);

  const group = cg.start();
  assert.ok(!group.aborted);

  c.abort();
  assert.ok(group.aborted);
  assert.strictEqual(group, cg.start());
});

test('halt', async () => {
  const cg = new CGroup();

  let halts = 0;
  let resumes = 0;

  cg.halt(async (s, resume) => {
    ++halts;
    resume.addEventListener('abort', () => {
      ++resumes;
    });
  });

  const c = new AbortController();
  cg.add(c.signal);
  cg.start();

  c.abort();

  const c2 = new AbortController();
  assert.ok(cg.add(c2.signal));

  assert.strictEqual(halts, 1);
  assert.strictEqual(resumes, 1);

  c2.abort();

  assert.strictEqual(halts, 2);
  assert.strictEqual(resumes, 1);

  // need to async for the actual stop (because halt/resumeStart is async)
  await cg.wait();

  const c3 = new AbortController();
  assert.ok(!cg.add(c3.signal));

  assert.strictEqual(halts, 2);
  c3.abort();
  assert.strictEqual(halts, 2);
});
