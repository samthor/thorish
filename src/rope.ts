/**
 * @fileoverview Derived from @josephg's implementation here: https://github.com/josephg/jumprope
 *
 * MIT license etc etc
 */

const POOL_MAX_SIZE = 100;

/**
 * Doesn't support weird biases but anywhere around 0.3-0.6 seems to be pretty similar anyway.
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

type LevelType<T> = {
  next: NodeType<T> | null;
  prev: NodeType<T>;
  subtreesize: number;
};

type NodeType<T> = {
  data: T;
  id: number;
  length: number;
  levels: LevelType<T>[];
};

export type RopeLookup<T> = {
  data: T;
  length: number;
  id: number;
  prevId: number;
  nextId: number;
};

export type RopeRead<T> = {
  out: T[];
  len: number[];
};

const zeroNode: NodeType<never> = {
  data: undefined as never,
  id: 0,
  length: 0,
  levels: [],
};
const globalPool: NodeType<any>[] = [];

/**
 * Actually an 'immutable rope'.
 *
 * Parts cannot be modified, because they are objects with length that have some kind of rendering that this class won't understand.
 */
export class Rope<T> {
  private _length: number;
  private head: NodeType<T>;
  private tail: NodeType<T>;

  private id = 0;
  private byId = new Map<number, NodeType<T>>();

  // We use these as the results of `rseek` and `rseekNodes`.
  // Otherwise we keep recreating pointless arrays.
  private _nodesBuffer: NodeType<T>[] = [];
  private _subBuffer: number[] = [];

  length() {
    return this._length;
  }

  last(): number {
    return this.tail.id;
  }

  count() {
    return this.byId.size - 1;
  }

  /**
   * Find the length between these two valid IDs.
   *
   * This isn't a substitute for {@link compare} as zero length entries are allowed, so this won't return which one is first.
   *
   * Currently just calls {@link find} twice.
   */
  lengthBetween(low: number, high: number): number {
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

    let curr: NodeType<T> | null = this.head;
    let last: NodeType<T> | null = null;

    for (;;) {
      const leftRaw = JSON.stringify(curr.data);
      const left = `(id=${curr.id.toString().padEnd(3, ' ')}) ` + leftRaw.substring(0, 60);

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
      prevs.push(JSON.stringify(last.data));
      last = last.levels.at(-1)!.prev;
    }
    console.info('prevs:', prevs.join(' -> '));

    console.info('');
    console.info('<');
  }

  constructor(root: T) {
    this.head = {
      data: root,
      id: 0,
      length: 0,
      levels: [],
    };
    this.head.levels.push({
      next: null,
      prev: this.head,
      subtreesize: 0,
    });
    this.byId.set(0, this.head);
    this._length = 0;

    this.tail = this.head;
  }

  *[Symbol.iterator]() {
    // Skip the head, since it has no string.
    let e = this.head.levels[0].next;

    while (e) {
      yield e.data;
      e = e.levels[0].next;
    }
  }

  /**
   * Finds the position of the given ID.
   *
   * Perf: `O(logn)-ish`.
   */
  find(id: number): number {
    const e = this.byId.get(id);
    if (e === undefined) {
      throw new Error(`missing id: ${id}`);
    }
    let node = e;
    let pos = 0;

    while (node !== this.head) {
      const link = node.levels.length - 1;
      node = node.levels[link].prev;
      pos += node.levels[link].subtreesize;
    }

    return pos;
  }

  has(id: number): boolean {
    return this.byId.has(id);
  }

  lookup(id: number): RopeLookup<T> {
    const out = this.byId.get(id);
    if (out === undefined) {
      throw new Error(`could not lookup id=${id}`);
    }
    const ol = out.levels[0]!;

    return {
      data: out.data,
      length: out.length,
      id,
      prevId: ol.prev.id,
      nextId: ol.next?.id ?? 0,
    };
  }

  /**
   * Find the ID for the given position.
   *
   * By default, this will be the left-most ID that contains the position (even 'at end').
   * For example, looking up `offset=0` in an already-used rope will always yield `id=0`, as it has zero length.
   *
   * Specify the `biasEnd` parameter to flip this behavior.
   */
  byPosition(
    offset: number,
    biasAfter: boolean = false,
  ): { id: number; offset: number; length: number; data: T } {
    if (offset < 0) {
      offset = this._length + offset;
    }
    if (offset < 0 || offset > this._length || Math.floor(offset) !== offset) {
      throw new Error(`invalid offset within rope: offset=${offset} length=${this.length()}`);
    }

    let e = this.head;
    let h = e.levels.length;
    outer: while (h--) {
      // traverse this height while we can
      while (offset > e.levels[h].subtreesize) {
        offset -= e.levels[h].subtreesize;

        const next = e.levels[h].next;
        if (!next) {
          continue outer;
        }
        e = next;
      }

      // if we bias to end, move as far forward as possible (even zero)
      while (biasAfter && offset >= e.levels[h].subtreesize && e.levels[h].next) {
        offset -= e.levels[h].subtreesize;
        e = e.levels[h].next!;
      }
    }

    return { id: e.id, offset, length: e.length, data: e.data };
  }

  /**
   * Reduced version of `rseek` for various purposes...
   *
   * Result placed in `_nodesBuffer`.
   */
  private rseekNodes(e: NodeType<T>): void {
    const nodes = this._nodesBuffer;
    const height = this.head.levels.length;
    let i = 0;

    for (;;) {
      while (i < e.levels.length) {
        nodes[i] = e;
        ++i;
        if (i === height) {
          return;
        }
      }
      e = e.levels[i - 1].prev;
    }
  }

  /**
   * Adjust the given entry's data/length.
   */
  adjust(id: number, data: T, length: number) {
    const e = this.byId.get(id);
    if (e === undefined) {
      throw new Error(`missing id=${id}`);
    } else if (length < 0) {
      throw new Error(`must be +ve length`);
    }
    const lengthDelta = length - e.length;

    this.rseekNodes(e);
    const nodes = this._nodesBuffer;

    e.data = data;
    e.length = length;

    if (lengthDelta !== 0) {
      nodes.forEach((n, i) => {
        n.levels[i].subtreesize += lengthDelta;
      });
      this._length += lengthDelta;
    }
  }

  /**
   * Inserts a node after a previous node.
   */
  insertAfter(id: number, data: T, length: number): number {
    const e = this.byId.get(id);
    if (e === undefined) {
      throw new Error(`missing id=${id}`);
    } else if (length < 0) {
      throw new Error(`must be +ve length`);
    }

    const head = this.head;
    const headLevels = head.levels.length;

    // -- create new node

    let height;
    let newE: NodeType<T> | undefined = globalPool.pop();
    const newId = ++this.id;

    let levels: LevelType<T>[];

    if (newE !== undefined) {
      // use from the pool (levels is already randomly distributed!)
      newE.data = data;
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
        data,
        id: newId,
        length,
        levels,
      };
    }
    this.byId.set(newId, newE);

    // -- rseek to find out where it goes

    const nodes = this._nodesBuffer;
    const sub = this._subBuffer;

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
        nodes.push(zeroNode);
        sub.push(0);

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

    return newId;
  }

  /**
   * Deletes the given ID from this rope.
   */
  deleteById(id: number) {
    const actual = this.byId.get(id);
    if (!actual) {
      throw new Error(`missing id=${id}`);
    } else if (actual.levels[0].prev === actual) {
      throw new Error(`cannot delete id=0`);
    }
    const prev = actual.levels[0].prev;

    return this.deleteTo(prev.id, id);
  }

  /**
   * Deletes after the given ID until the target ID.
   */
  deleteTo(id: number, untilId: number): T[] {
    const startNode = this.byId.get(id);
    if (startNode === undefined) {
      throw new Error(`missing id=${id}`);
    }

    this.rseekNodes(startNode);
    const nodes = this._nodesBuffer;
    let out: T[] = [];

    for (;;) {
      const e = nodes[0].levels[0].next;
      if (!e) {
        break;
      }
      this.byId.delete(e.id);
      this._length -= e.length;
      out.push(e.data);

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

    return out;
  }

  private insertIntoPool(e: NodeType<T>) {
    if (globalPool.length > POOL_MAX_SIZE) {
      return;
    }

    // we don't need to do this EXCEPT for GC purposes
    e.levels.forEach((l) => {
      l.next = null;
      l.prev = zeroNode;
    });

    if (globalPool.length <= 1) {
      // nothing to do, always goes at end
      globalPool.push(e);
    } else {
      // this is "pre-randomizing" the order within the pool
      const choice = Math.floor(Math.random() * globalPool.length);
      const prev = globalPool[choice];
      globalPool[choice] = e;
      globalPool.push(prev);
    }
  }

  /**
   * Is the ID in `a` before the ID in `b`?
   */
  before(a: number, b: number) {
    const c = this.compare(a, b);
    return c < 0;
  }

  compare(a: number, b: number): number {
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

    this.rseekNodes(anode);
    const anodes = this._nodesBuffer;

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

  *iter(afterId: number): Iterable<{ id: number; data: T }> {
    let curr = this.byId.get(afterId);
    if (curr === undefined) {
      return;
    }

    for (;;) {
      const next: NodeType<T> | null = curr!.levels[0].next;
      if (next === null) {
        return;
      }

      yield next;
      curr = next;
    }
  }

  read(from: number, to?: number): RopeRead<T> | undefined {
    const left = this.byId.get(from);
    if (!left) {
      return;
    }

    let right: NodeType<T> | undefined;
    if (to !== undefined) {
      right = this.byId.get(to);
      if (!right || this.before(to, from)) {
        return;
      }
    }

    const out: T[] = [];
    const len: number[] = [];

    let curr: NodeType<T> = left;
    for (;;) {
      out.push(curr.data);
      len.push(curr.length);

      if (curr === right) {
        break;
      }

      const next = curr.levels[0].next;
      if (!next) {
        break;
      }

      curr = next;
    }

    return { out, len };
  }
}
