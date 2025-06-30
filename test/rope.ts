import test from 'node:test';
import * as assert from 'node:assert';
import { Rope } from '../src/rope.ts';
import { randomArrayChoice, randomRangeInt } from '../src/primitives.ts';
import { arraySwapRemoveAt } from '../src/array.ts';

const count = 20;
let globalId = 0;

const insertAtHelper = (r: Rope<number, string>, at: number, s: string): number => {
  const f = r.byPosition(at);
  if (f.offset) {
    throw new Error(`cannot insertAt not on edge`);
  } else if (f.offset === 0) {
    //    r.lookup(at);
  }
  const newId = ++globalId;
  r.insertAfter(f.id, newId, s.length, s);
  return newId;
};

const ropeToString = (r: Rope<any, string>) => [...r].join('');

test('basic', () => {
  for (let i = 0; i < count; ++i) {
    const r = new Rope(0, '');
    const helloId = ++globalId;
    r.insertAfter(0, helloId, 5, 'hello');
    assert.strictEqual(r.find(helloId), 5);

    const thereId = ++globalId;
    r.insertAfter(helloId, thereId, 6, ' there');

    // if (i === 0) {
    //   r._debug();
    // }

    assert.strictEqual(r.last(), thereId);

    const r2 = r.clone();
    r.deleteById(helloId);
    assert.strictEqual(r2.find(helloId), 5);
    assert.throws(() => r.find(helloId));
    assert.strictEqual(r2.last(), thereId);
    assert.strictEqual(r.last(), thereId);

    r.deleteById(thereId);
    assert.strictEqual(r.last(), 0);
    assert.strictEqual(r2.last(), thereId);
    r2.deleteById(thereId);
    assert.strictEqual(r2.last(), helloId);
  }
});

test('adjust', () => {
  for (let i = 0; i < count; ++i) {
    const r = new Rope(0, '');

    r.insertAfter(0, ++globalId, 5, 'hello');
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
      offset: 1,
    });
  }
});

test('seek', () => {
  const r = new Rope(0, '');
  const helloId = insertAtHelper(r, 0, 'hello');
  const xId = insertAtHelper(r, 0, 'x');
  insertAtHelper(r, 0, 'yy');
  insertAtHelper(r, 3, 'early: ');
  const lastId = insertAtHelper(r, r.find(helloId), '!!');
  const xxId = insertAtHelper(r, r.find(lastId), 'xx');

  //  assert.ok(r.before(helloId, lastId), 'hello should be before last');

  const helloLookup = r.lookup(helloId);
  assert.ok(r.deleteTo(helloLookup.prevId!, lastId));

  // assert.throws(() => {
  //   // lastId was deleted
  //   insertAtHelper(r, lastId, 'hellO');
  // });
  const newHelloId = insertAtHelper(r, r.find(xxId), 'hellO');

  assert.deepStrictEqual(r.read(xId, newHelloId), {
    out: ['x', 'early: ', 'xx', 'hellO'],
    len: [1, 7, 2, 5],
  });
});

test('rope', () => {
  for (let i = 0; i < count; ++i) {
    const r = new Rope(0, '');
    const insertAt = (at: number, s: string) => insertAtHelper(r, at, s);

    const helloId = insertAt(0, 'hello');
    assert.strictEqual(ropeToString(r), 'hello');

    assert.deepStrictEqual(r.byPosition(0), { id: 0, offset: 0 });
    assert.deepStrictEqual(r.byPosition(0, true), {
      id: helloId,
      offset: 5,
    });

    const questionId = insertAt(5, '??');
    assert.strictEqual(ropeToString(r), 'hello??');

    const bangsId = insertAt(5, '!!');
    assert.strictEqual(ropeToString(r), 'hello!!??');

    // check move
    assert.deepStrictEqual(r.find(questionId), 9);

    assert.ok(r.deleteById(bangsId));
    assert.strictEqual(ropeToString(r), 'hello??');

    // assert.deepStrictEqual(r.read(4, 6), {
    //   prefix: 4,
    //   suffix: 1,
    //   out: ['hello', '??'],
    //   len: [5, 2],
    // });
    assert.deepStrictEqual(r.find(questionId), 7);

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
      id: itisId,
      offset: 5,
    });
    assert.deepStrictEqual(r.byPosition('what up hello[6][5][4][3][2][1][0]i'.length), {
      id: itisId,
      offset: 4,
    });
    assert.deepStrictEqual(r.byPosition('what up hello[6][5][4][3][2][1][0]i'.length, true), {
      id: itisId,
      offset: 4,
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

    const r = new Rope(0, '');
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

        const newId = ++globalId;
        r.insertAfter(choice, newId, s.length, s);
        nodes.push(newId);
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
