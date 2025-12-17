/**
 * @fileoverview Derived from @josephg's implementation here: https://github.com/josephg/jumprope
 *
 * MIT license etc etc
 *
 * Version that doesn't break reactivity.
 */

/**
 * Returns a value with 50% chance of 1, 25% chance of 2, 12.5% chance of 3, ...
 */
const randomHeight = () => {
  let length = 1;
  let r = Math.random() * 2;
  while (r > 1) {
    r = (r - 1) * 2;
    ++length;
  }
  return length;
};

type LevelType<K> = {
  next: NodeType<K> | null;
  prev: NodeType<K>;
  subtreesize: number;
};

type NodeType<K> = {
  id: K;
  length: number;
  levels: LevelType<K>[];
};

export type RopeLookup<K, T> = {
  data: T;
  length: number;

  /**
   * The ID of this lookup.
   * This will be the same as what was passed in to perform the lookup.
   */
  id: K;

  /**
   * The previous ID in sequence.
   */
  prevId: K;

  /**
   * The next ID in sequence.
   * This will be the zero ID if there is no following data.
   */
  nextId: K;
};

export type RopeRead<T> = {
  out: T[];
  len: number[];
};

/**
 * Implements a skip list with `O(logn)-ish` performance.
 *
 * We store data here, but mostly only as a convenience: it's a simple k/v map.
 * The length is far more important.
 *
 * Individual parts can have zero length.
 */
export class Rope<K, T = void> {
  private _length: number;
  private head: NodeType<K>;
  private tail: NodeType<K>;

  private readonly _zeroId: K;
  private readonly byId = new Map<K, NodeType<K>>();
  private readonly dataById = new Map<K, T>();

  private readonly nodeCache: NodeType<K>[] = [];

  /**
   * The zero ID that this {@link Rope} was created with.
   */
  zeroId(): K {
    return this._zeroId;
  }

  /**
   * Clones this {@link Rope} using {@link structuredClone}.
   */
  clone(): Rope<K, T> {
    const r = new Rope<K, T>(this._zeroId);

    // @ts-expect-error
    r.dataById = new Map(this.dataById);

    const byId = structuredClone(this.byId); // safe because we don't reference data
    // @ts-expect-error
    r.byId = byId;

    r.head = r.byId.get(this._zeroId)!;
    r.tail = r.byId.get(this.tail.id)!;
    r._length = this._length;

    if (r.head === undefined || r.tail === undefined) {
      throw new Error(`bad Rope clone`);
    }

    return r;
  }

  /**
   * Constructs a new {@link Rope}.
   *
   * The second argument may be passed purely as a TypeScript hint for {@link T} and it is stored on the root node, but it is not required and cannot ever be read.
   */
  constructor(zeroId: K, sampleData?: T) {
    this.head = {
      id: zeroId,
      length: 0,
      levels: [],
    };
    this.head.levels.push({
      next: null,
      prev: this.head,
      subtreesize: 0,
    });
    this.byId.set(zeroId, this.head);
    this._length = 0;
    this._zeroId = zeroId;

    this.tail = this.head;
  }

  /**
   * The total length of all items in this {@link Rope}.
   */
  length() {
    return this._length;
  }

  /**
   * The ID of the right-most entry here.
   */
  last(): K {
    return this.tail.id;
  }

  /**
   * The count of items in this {@link Rope}, even zero-length ones.
   */
  count() {
    return this.byId.size - 1;
  }

  /**
   * Find the length between these two valid IDs.
   *
   * This isn't a substitute for {@link compare} as zero length entries are allowed, so this won't return which one is first.
   *
   * Currently just calls {@link find} twice, so `O(logn)-ish`.
   */
  lengthBetween(low: K, high: K): number {
    // TODO: This could be faster by using the tricks in `compare`.
    const lowAt = this.find(low);
    const highAt = this.find(high);
    return highAt - lowAt;
  }

  /**
   * Prints out the rope for debugging.
   */
  _debug() {
    console.info('> rope len=', this._length, 'heads', this.head.levels.length);
    console.info('');

    const height = this.head.levels.length;
    const nulls: boolean[] = [];
    for (let i = 0; i < height; ++i) {
      nulls[i] = false;
    }

    let curr: NodeType<K> | null = this.head;
    let last: NodeType<K> | null = null;

    for (;;) {
      const data = this.dataById.get(curr.id);
      let leftRaw = JSON.stringify(data);
      if (typeof leftRaw !== 'string') {
        leftRaw = '';
      }
      const left = `(id=${String(curr.id).padEnd(3, ' ')}) ` + leftRaw.substring(0, 60);

      const parts: string[] = curr.levels.map(({ next, subtreesize }, i) => {
        if (next === null) {
          nulls[i] = true;
        }
        return (next ? '+' : '*') + subtreesize.toString().padEnd(3, ' ');
      });

      while (parts.length < height) {
        if (nulls[parts.length]) {
          parts.push('    ');
        } else {
          parts.push('|   ');
        }
      }
      console.info('-', parts.join(' '), left);

      last = curr;
      curr = curr.levels[0].next;
      if (!curr) {
        break;
      }

      const partsGap: string[] = [];
      while (partsGap.length < height) {
        if (nulls[partsGap.length]) {
          break;
        }
        partsGap.push('|   ');
      }
      console.info(' ', partsGap.join(' '));
    }

    console.info('');

    // render last to start via prevs links
    const prevs: string[] = [];
    while (last !== this.head) {
      const data = this.dataById.get(last.id);
      prevs.push(JSON.stringify(data));
      last = last.levels.at(-1)!.prev;
    }
    console.info('prevs:', prevs.join(' -> '));

    console.info('');
    console.info('<');
  }

  *[Symbol.iterator](): Iterator<T, void, void> {
    // Skip the head, since it has no content.
    let e = this.head.levels[0].next;

    while (e) {
      yield this.dataById.get(e.id)!;
      e = e.levels[0].next;
    }
  }

  /**
   * Finds the position after the given ID.
   *
   * Perf: `O(logn)-ish`.
   */
  find(ropeId: K): number {
    const e = this.byId.get(ropeId);
    if (e === undefined) {
      throw new Error(`missing id: ${ropeId}`);
    }
    let node = e;
    let pos = 0;

    while (node !== this.head) {
      const link = node.levels.length - 1;
      node = node.levels[link].prev;
      pos += node.levels[link].subtreesize;
    }

    return pos + e.length;
  }

  /**
   * Does this ID exist here.
   *
   * Perf: `O(1)-ish` (just {@link Map}).
   */
  has(ropeId: K): boolean {
    return this.byId.has(ropeId);
  }

  /**
   * Lookup information on this ID.
   *
   * This throws when trying to look up the zero ID.
   *
   * Perf: `O(1)-ish` (just {@link Map}).
   */
  lookup(ropeId: K): RopeLookup<K, T> {
    if (ropeId === this._zeroId) {
      throw new Error(`cannot lookup root ID`);
    }

    const out = this.byId.get(ropeId);
    if (out === undefined) {
      throw new Error(`could not lookup id=${ropeId}`);
    }
    const ol = out.levels[0]!;

    return {
      data: this.dataById.get(ropeId)!,
      length: out.length,
      id: ropeId,
      prevId: ol.prev.id,
      nextId: ol.next?.id ?? this._zeroId,
    };
  }

  /**
   * Find the ID for the given position, and the offset from the end of that ID.
   * Always returns a valid value, is clamped to edge.
   *
   * By default, this will be the left-most ID that contains the position (even 'at end').
   * For example, looking up `offset=0` in an already-used rope will always yield `id=0`, as it has zero length.
   *
   * Specify the `biasEnd` parameter to flip this behavior.
   *
   * Perf: `O(logn)-ish`.
   */
  byPosition(position: number, biasAfter: boolean = false): { id: K; offset: number } {
    if (position < 0 || (!biasAfter && position === 0)) {
      return { id: this._zeroId, offset: 0 };
    } else if (position > this._length || (biasAfter && position == this._length)) {
      return { id: this.tail.id, offset: 0 };
    }

    let e = this.head;
    outer: for (let h = e.levels.length - 1; h >= 0; h--) {
      // traverse this height while we can
      while (position > e.levels[h].subtreesize) {
        position -= e.levels[h].subtreesize;

        const next = e.levels[h].next;
        if (!next) {
          continue outer;
        }
        e = next;
      }

      // if we bias to end, move as far forward as possible (even zero)
      while (biasAfter && position >= e.levels[h].subtreesize && e.levels[h].next) {
        position -= e.levels[h].subtreesize;
        e = e.levels[h].next!;
      }
    }

    return { id: e.id, offset: e.length - position };
  }

  /**
   * Reduced version of `rseek` for various purposes...
   */
  private rseekNodes(e: NodeType<K>): NodeType<K>[] {
    const height = this.head.levels.length;
    let i = 0;

    const out = new Array(e.levels.length).fill(null);
    for (;;) {
      while (i < e.levels.length) {
        out[i] = e;
        ++i;
        if (i === height) {
          return out;
        }
      }
      e = e.levels[i - 1].prev;
    }
  }

  /**
   * Adjust the given entry's data/length.
   */
  adjust(id: K, data: T, length: number) {
    const e = this.byId.get(id);
    if (e === undefined) {
      throw new Error(`missing id=${id}`);
    } else if (length < 0) {
      throw new Error(`must be +ve length`);
    }
    const lengthDelta = length - e.length;

    const nodes = this.rseekNodes(e);

    e.length = length;

    if (lengthDelta !== 0) {
      const height = this.head.levels.length;
      for (let i = 0; i < height; ++i) {
        // TODO: this matches before but seems wrong
        nodes[i].levels[i].subtreesize += lengthDelta;
      }
      this._length += lengthDelta;
    }

    this.dataById.set(id, data);
  }

  /**
   * Inserts a node after a previous node.
   *
   * Perf: `O(logn)-ish`.
   */
  insertAfter(afterId: K, newId: K, length: number, data: T) {
    const e = this.byId.get(afterId);
    if (e === undefined) {
      throw new Error(`missing id=${afterId}`);
    } else if (length < 0) {
      throw new Error(`must be +ve length`);
    }

    this.dataById.set(newId, data);

    const head = this.head;
    const headLevels = head.levels.length;

    // -- create new node

    let height;
    let newE: NodeType<K> | undefined = this.nodeCache.pop();

    let levels: LevelType<K>[];

    if (newE !== undefined) {
      // use from the pool (levels is already randomly distributed!)
      newE.id = newId;
      newE.length = length;
      levels = newE.levels;
      height = levels.length;
    } else {
      // create anew (creating objects in JS: slow)
      height = randomHeight();

      levels = new Array(height);
      for (let i = 0; i < height; ++i) {
        levels[i] = {
          next: null,
          prev: head,
          subtreesize: 0,
        };
      }

      newE = {
        id: newId,
        length,
        levels,
      };
    }
    this.byId.set(newId, newE);

    // -- rseek to find out where it goes

    const nodes = new Array(headLevels).fill(null);
    const sub: number[] = [];

    let seekNode = e;
    let insertPos = e.length;
    let i = 0;

    for (;;) {
      const nl = seekNode.levels.length;
      while (i < nl) {
        nodes[i] = seekNode;
        sub[i] = insertPos;
        ++i;
      }
      if (seekNode === head || i === headLevels) {
        break;
      }

      const link = i - 1;
      seekNode = seekNode.levels[link].prev;
      insertPos += seekNode.levels[link].subtreesize;
    }

    // -- do actual insert

    i = 0;
    for (; i < height; ++i) {
      if (i < headLevels) {
        // we fit within head height (~99.9% of the time)
        const n = nodes[i];
        const nl = n.levels[i];

        const nextI = nl.next;
        if (nextI !== null) {
          nextI.levels[i].prev = newE;
        } else if (i === 0) {
          this.tail = newE;
        }
        const st = sub[i];

        // re-use existing (don't recreate, slow)
        const l = levels[i];
        l.next = nextI;
        l.prev = n;
        l.subtreesize = length + nl.subtreesize - st;

        nl.next = newE;
        nl.subtreesize = st;
      } else {
        // this is a no-op on second go-around; we need to calc the actual insertPos for this
        // we previously gave up, `insertPos` was just the local consumed subtreesize
        while (seekNode !== head) {
          seekNode = seekNode.levels.at(-1)!.prev;
          insertPos += seekNode.levels.at(-1)!.subtreesize;
        }

        // grow head stuff (these are ref'ed to the _nodesBuffer and _subBuffer respectively)
        // nb. we automatically resize these when we use them ...
        // nodes.push(zeroNode);
        // sub.push(0);

        // ensure head has correct total height
        head.levels.push({
          next: newE,
          prev: head,
          subtreesize: insertPos,
        });

        // always new
        const l = levels[i];
        // l.next = null;
        l.prev = head;
        l.subtreesize = this._length - insertPos + length;
      }
    }
    for (; i < nodes.length; ++i) {
      nodes[i].levels[i].subtreesize += length;
    }

    this._length += length;
  }

  /**
   * Deletes the given ID from this rope.
   *
   * Perf: `O(logn)-ish`.
   */
  deleteById(id: K) {
    if (id === this._zeroId) {
      throw new Error(`cannot delete root ID`);
    }

    const actual = this.byId.get(id);
    if (!actual) {
      throw new Error(`missing id=${id}`);
    }
    const prev = actual.levels[0].prev;

    return this.deleteTo(prev.id, id);
  }

  /**
   * Deletes after the given ID until the target ID.
   *
   * Perf: `O(logn)-ish`.
   */
  deleteTo(afterId: K, untilId: K): void {
    const startNode = this.byId.get(afterId);
    if (startNode === undefined) {
      throw new Error(`missing id=${afterId}`);
    }

    if (afterId === untilId) {
      return;
    }

    const nodes = this.rseekNodes(startNode);

    for (;;) {
      const e = nodes[0].levels[0].next;
      if (!e) {
        break;
      }
      this.byId.delete(e.id);
      this._length -= e.length;

      for (let i = 0; i < nodes.length; ++i) {
        const node = nodes[i];
        const nl = node.levels[i];
        const el = e.levels[i];

        if (i < e.levels.length) {
          // mid node 'before us'
          nl.subtreesize += el.subtreesize - e.length;
          const c = el.next;
          if (c) {
            c.levels[i].prev = node;
          } else if (i === 0) {
            this.tail = node;
          }
          nl.next = c;
        } else {
          // tail node
          nl.subtreesize -= e.length;
        }
      }

      this.insertIntoPool(e);

      if (e.id === untilId) {
        break;
      }
    }
  }

  private insertIntoPool(e: NodeType<K>) {
    if (this.nodeCache.length > 32) {
      return;
    }
    // sanitize stored node (don't hold old stuff)
    e.levels.forEach((v) => {
      v.next = null;
      v.prev = this.head;
    });
    this.nodeCache.push(e);
  }

  /**
   * Is the ID in `a` before the ID in `b`?
   *
   * Perf: `O(logn)-ish`.
   */
  before(a: K, b: K) {
    const c = this.compare(a, b);
    return c < 0;
  }

  /**
   * Compares the position of these two IDs.
   *
   * Returns -1 if A is before B, zero if they are the same, and +1 if A is after B.
   *
   * Perf: `O(logn)-ish`.
   */
  compare(a: K, b: K): number {
    let anode = this.byId.get(a);
    if (anode === undefined) {
      throw new Error(`missing id=${a}`);
    }
    if (a === b) {
      return 0;
    }

    let bnode = this.byId.get(b);
    if (bnode === undefined) {
      throw new Error(`missing id=${b}`);
    }

    let cmp = 1;

    if (anode.levels.length < bnode.levels.length) {
      // swap more levels into anode; seek will be faster
      cmp = -1;
      [anode, bnode] = [bnode, anode];
    }

    const anodes = this.rseekNodes(anode);

    // walk up the tree
    let curr = bnode;
    let i = 1;
    for (;;) {
      let ll = curr.levels.length;
      while (i < ll) {
        if (curr === anodes[i]) {
          // stepped "right" into the previous node tree, so it must be after us
          return cmp;
        }
        ++i;
      }

      --ll;
      curr = curr.levels[ll].prev;
      if (curr === anodes[ll]) {
        // stepped "up" into the previous node tree, so must be before us
        return -cmp;
      } else if (curr === this.head) {
        // stepped "up" to root, so must be after us (we never saw it in walk)
        return cmp;
      }
    }
  }

  /**
   * Iterate from after the given ID, to the target ID inclusive (i.e., `(afterId,untilId]`).
   *
   * If no `untilId` is passed or the IDs are in the wrong order, iterates from after `afterId` until the end of this {@link Rope}.
   */
  *iter(
    afterId: K = this._zeroId,
    untilId?: K,
  ): Iterable<{ id: K; data: T; length: number }, void, void> {
    if (afterId === untilId) {
      return;
    }

    let curr = this.byId.get(afterId);
    if (curr === undefined) {
      return;
    }

    for (;;) {
      const next: NodeType<K> | null = curr!.levels[0].next;
      if (next === null) {
        return;
      }

      yield { id: next.id, data: this.dataById.get(next.id)!, length: next.length };
      curr = next;

      if (curr.id === untilId) {
        return;
      }
    }
  }

  /**
   * Reads all data from after the given ID, to the target ID inclusive.
   *
   * This is a convenience over {@link iter} and has the same semantics.
   */
  read(afterId: K = this._zeroId, untilId?: K): RopeRead<T> {
    const it = this.iter(afterId, untilId);

    const out: T[] = [];
    const len: number[] = [];

    for (const next of it) {
      out.push(next.data);
      len.push(next.length);
    }

    return { out, len };
  }
}
