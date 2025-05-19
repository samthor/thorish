import test from 'node:test';
import * as assert from 'node:assert';
import { AATree } from '../src/aatree.ts';
import { randomRangeInt } from '../src/primitives.ts';

const ITER = 10_000;
const RANGE = 1_000_000;

type NodeId = [number, string];

test('simple', () => {
  const t = new AATree<number>((a, b) => a - b);

  const numbersToInsert = [50, 51, 52, 53, 30, 20, 10, 48, 1, -100, 400, 4141];
  numbersToInsert.forEach((x) => {
    assert.ok(t.insert(x), `failed to insert ${x}`);
  });

  assert.strictEqual(t.equalAfter(49), 50);

  assert.strictEqual(t.equalAfter(4141), 4141);
  assert.strictEqual(t.equalAfter(4141.1), undefined);

  assert.strictEqual(t.before(4142), 4141);
  assert.strictEqual(t.before(-100), undefined);
  assert.strictEqual(t.before(-99.999), -100);

  assert.strictEqual(t.equalBefore(4141), 4141);
  assert.strictEqual(t.equalBefore(4142), 4141);

  assert.strictEqual(t.after(4140), 4141);
  assert.strictEqual(t.after(4141), undefined);
  assert.strictEqual(t.after(-99.999), 1);

  const sorted = numbersToInsert.toSorted((a, b) => a - b);
  for (let i = 1; i < sorted.length; ++i) {
    assert.strictEqual(t.before(sorted[i]), sorted[i - 1]);
  }
});

test('tree', () => {
  const t = new AATree<number>((a, b) => a - b);
  const seen = new Set<number>();
  let count = 0;

  // 10000k => 7000ms
  //  1000k =>  700ms
  //   100k =>   70ms
  //    10k =>   ~8ms

  for (let i = 0; i < ITER; ++i) {
    const num = randomRangeInt(0, RANGE);

    const expected = seen.has(num);
    if (!expected) {
      ++count;
      seen.add(num);
    }

    assert.strictEqual(t.query(num) !== undefined, expected);
    assert.strictEqual(t.insert(num), !expected);
  }

  let offByOnes = 0;
  for (const x of seen) {
    let expected = x;
    if (seen.has(x - 1)) {
      expected = x - 1;
      ++offByOnes;
    }
    assert.strictEqual(t.equalAfter(x - 1), expected, `for num ${x - 1} expected=${expected}`);
  }

  assert.strictEqual(t.count(), count);
});

test('nodeId', () => {
  const nodeIds = new AATree<[NodeId, number]>(([a], [b]) => {
    if (a[1] !== b[1]) {
      return a[1].localeCompare(b[1]);
    }
    return a[0] - b[0];
  });
  nodeIds.insert([[0, ''], 0]);
  nodeIds.insert([[123, 'sam'], 0]);

  assert.deepStrictEqual(nodeIds.equalAfter([[-1, ''], 1241]), [[0, ''], 0]);
  assert.deepStrictEqual(nodeIds.equalAfter([[0, 'sam'], 1241]), [[123, 'sam'], 0]);

  // no more above 123
  assert.deepStrictEqual(nodeIds.equalAfter([[124, 'sam'], 1241]), undefined);

  // overflows blank ID and goes to 'sam' (prevented in real use)
  assert.deepStrictEqual(nodeIds.equalAfter([[1_000, ''], 1241]), [[123, 'sam'], 0]);

  const findNodeId = (req: NodeId): [NodeId, number] | undefined => {
    const nearest = nodeIds.equalAfter([req, 0]);

    if (nearest === undefined) {
      return undefined;
    } else if (nearest[0][1] !== req[1]) {
      // clientId must be the same
      return undefined;
    }

    return nearest;
  };

  // prevents reach into different clientId
  assert.deepStrictEqual(findNodeId([1_000, '']), undefined);

  assert.deepStrictEqual(findNodeId([1, 'sam']), [[123, 'sam'], 0]);
});
