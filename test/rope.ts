import test from 'node:test';
import * as assert from 'node:assert';
import { Rope } from '../src/rope.ts';
import { randomArrayChoice, randomRangeInt } from '../src/primitives.ts';
import { arraySwapRemoveAt } from '../src/array.ts';

const count = 20;

const insertAtHelper = (r: Rope<string>, at: number, s: string) => {
  const f = r.byPosition(at);
  if (f.offset !== f.length) {
    throw new Error(`cannot insertAt not on edge`);
  }
  return r.insertAfter(f.id, s, s.length);
};

const ropeToString = (r: Rope<string>) => [...r].join('');

test('basic', () => {
  for (let i = 0; i < count; ++i) {
    const r = new Rope<string>('');
    const helloId = r.insertAfter(0, 'hello', 5);
    assert.strictEqual(r.find(helloId), 0);

    const thereId = r.insertAfter(helloId, ' there', 6);

    // if (i === 0) {
    //   r._debug();
    // }

    assert.strictEqual(r.last(), thereId);

    r.deleteById(thereId);
    assert.strictEqual(r.last(), helloId);
  }
});

test('adjust', () => {
  for (let i = 0; i < count; ++i) {
    const r = new Rope<string>('');

    r.insertAfter(0, 'hello', 5);
    const thereId = insertAtHelper(r, 5, 'there');
    insertAtHelper(r, 10, 'sam');

    assert.deepStrictEqual(r.read(0), {
      out: ['', 'hello', 'there', 'sam'],
      len: [0, 5, 5, 3],
    });

    r.adjust(thereId, '!', 1);
    assert.deepStrictEqual(r.read(0), {
      out: ['', 'hello', '!', 'sam'],
      len: [0, 5, 1, 3],
    });

    assert.deepStrictEqual(r.byPosition(5, true), {
      id: thereId,
      data: '!',
      length: 1,
      offset: 0,
    });
  }
});

test('seek', () => {
  const r = new Rope<string>('');
  const helloId = r.insertAfter(0, 'hello', 5);
  const xId = insertAtHelper(r, 0, 'x');
  r.insertAfter(0, 'yy', 2);
  insertAtHelper(r, 3, 'early: ');
  const lastId = r.insertAfter(helloId, '!!', 2);
  const xxId = r.insertAfter(lastId, 'xx', 2);

  assert.ok(r.before(helloId, lastId));

  const helloLookup = r.lookup(helloId);
  assert.ok(r.deleteTo(helloLookup.prevId!, lastId));

  assert.throws(() => {
    // lastId was deleted
    r.insertAfter(lastId, 'hellO', 5);
  });
  const newHelloId = r.insertAfter(xxId, 'hellO', 5);

  assert.deepStrictEqual(r.read(xId, newHelloId), {
    out: ['x', 'early: ', 'xx', 'hellO'],
    len: [1, 7, 2, 5],
  });
});

test('rope', () => {
  for (let i = 0; i < count; ++i) {
    const r = new Rope<string>('');
    const insertAt = (at: number, s: string) => insertAtHelper(r, at, s);

    const helloId = insertAt(0, 'hello');
    assert.strictEqual(ropeToString(r), 'hello');

    assert.deepStrictEqual(r.byPosition(0), { data: '', id: 0, offset: 0, length: 0 });
    assert.deepStrictEqual(r.byPosition(0, true), {
      data: 'hello',
      id: helloId,
      offset: 0,
      length: 5,
    });

    const questionId = insertAt(5, '??');
    assert.strictEqual(ropeToString(r), 'hello??');

    const bangsId = insertAt(5, '!!');
    assert.strictEqual(ropeToString(r), 'hello!!??');

    // check move
    assert.deepStrictEqual(r.find(questionId), 7);

    assert.ok(r.deleteById(bangsId));
    assert.strictEqual(ropeToString(r), 'hello??');

    // assert.deepStrictEqual(r.read(4, 6), {
    //   prefix: 4,
    //   suffix: 1,
    //   out: ['hello', '??'],
    //   len: [5, 2],
    // });
    assert.deepStrictEqual(r.find(questionId), 5);

    insertAt(0, 'what up ');
    insertAt(13, ', a test');
    insertAt(21, ', yarly');
    const itisId = insertAt(13, 'it is');

    for (let i = 0; i < 10; ++i) {
      const numberId = insertAt(13, `[${i}]`);
      assert.ok(r.before(numberId, itisId));
    }

    assert.strictEqual(
      ropeToString(r),
      'what up hello[9][8][7][6][5][4][3][2][1][0]it is, a test, yarly??',
    );

    // do some deletions

    const deleteAfterId = r.byPosition('what up hello'.length, false);
    const endDeleteId = r.byPosition('what up hello[9][8][7]'.length, false);

    assert.ok(r.deleteTo(deleteAfterId.id, endDeleteId.id));
    assert.strictEqual(r.length(), ropeToString(r).length);

    assert.deepStrictEqual(r.byPosition('what up hello[6][5][4][3][2][1][0]'.length, true), {
      data: 'it is',
      id: itisId,
      offset: 0,
      length: 5,
    });
    assert.deepStrictEqual(r.byPosition('what up hello[6][5][4][3][2][1][0]i'.length), {
      data: 'it is',
      id: itisId,
      offset: 1,
      length: 5,
    });
    assert.deepStrictEqual(r.byPosition('what up hello[6][5][4][3][2][1][0]i'.length, true), {
      data: 'it is',
      id: itisId,
      offset: 1,
      length: 5,
    });

    // if (i === 0) {
    //   r._debug();
    // }
  }

  //  console.info(JSON.stringify(r, null, 2));
});

test('rand', () => {
  const start = performance.now();

  // (over 8 attempts => faster over time due to cache)
  // nb. these numbers might be made up because v8 is a dirty liar?
  //
  // 5000k => 13000ms (390k ops/sec)
  // 1000k =>  1400ms (720k ops/sec)
  //  500k =>   530ms (940k ops/sec)
  //  100k =>    50ms (1900k ops/sec)

  const attempts = 4;
  const ops = 1_000;
  const lengths: number[] = [];
  const perfs: number[] = [];

  for (let i = 0; i < attempts; ++i) {
    const startA = performance.now();

    const r = new Rope('');
    const nodes: number[] = [0];

    for (let i = 0; i < ops; ++i) {
      if (nodes.length === 1 || Math.random() < 0.95) {
        // insert case
        const choice = randomArrayChoice(nodes)!;

        const chars = randomRangeInt(1, 2);
        let s = '';
        for (let i = 0; i < chars; ++i) {
          s += String.fromCharCode(97 + randomRangeInt(26));
        }

        // emulate the user having to actually get the key position... adds about 20%
        // const pos = r.positionForId(choice);
        // const n = r.insertAt(pos, s, s.length);

        const n = r.insertAfter(choice, s, s.length);
        nodes.push(n);
      } else {
        // delete case
        const index = randomRangeInt(nodes.length - 1) + 1; // can't delete zero
        const choice = arraySwapRemoveAt(nodes, index)!;
        assert.ok(r.deleteById(choice));
      }
    }

    // if (i === 0) {
    //   r._debug();
    // }

    lengths.push(r.length());
    const durationA = performance.now() - startA;
    perfs.push(durationA);
  }

  const duration = performance.now() - start;
  const perAttempt = duration / attempts;
  const perOp = perAttempt / ops;

  const opsPerSec = 1000.0 / perOp;

  // still one-magnitude off best-case (and this is JUST a rope, not the CRDT)
  // :. would need WASM / GC avoidance to be better
  if (false) {
    console.info('rand', {
      perAttempt: perAttempt.toFixed(4) + 'ms',
      perOp: perOp.toFixed(4) + 'ms',
      opsPerSec: opsPerSec.toFixed(2),
      attempts,
      ops,
      lengths,
      perfs,
    });
  }
});
