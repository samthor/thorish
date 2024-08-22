type LeafJoinTreeNode<X> = {
  leaf: true;
  value: X;
  parent: BranchJoinTreeNode<X> | null;
  otherLeaf: Set<number>; // TODO: could be like a RLE
};

type BranchJoinTreeNode<X> = {
  leaf: false;
  left: JoinTreeNode<X>;
  right: JoinTreeNode<X>;
  parent: BranchJoinTreeNode<X> | null;
  otherBranch: Set<BranchJoinTreeNode<number>>;
};

type JoinTreeNode<X> = LeafJoinTreeNode<X> | BranchJoinTreeNode<X>;

/**
 * Does something with numbers and groups.
 *
 * Only the leaf nodes actually contain real numbers.
 *
 * The empty tree is actually empty. The tree containing a single node is just that. Two nodes
 * mean there's one virtual node and two leaves.
 *
 * TODO: Only supports known nodes
 */
export class NumericJoinTree {
  private root: JoinTreeNode<number> | null = null;
  private index = new Map<number, LeafJoinTreeNode<number>>();

  constructor(nodes: Iterable<number>) {
    // Approach something like a BSP tree. Just split in middle.

    const x = [...nodes];
    if (x.length !== 0) {
      this.root = this.#split([...nodes]);
    }

    for (const node of this.#iter()) {
      if (this.index.has(node.value)) {
        throw new Error(`must be unique values`);
      }
      this.index.set(node.value, node);
    }
  }

  *values() {
    for (const node of this.#iter()) {
      yield node.value;
    }
  }

  *#iter(): Generator<LeafJoinTreeNode<number>, void, void> {
    if (!this.root) {
      return;
    }

    let curr = this.root;
    for (;;) {
      let isLeft = false;
      while ('left' in curr) {
        curr = curr.left;
        isLeft = true;
      }

      yield curr;

      if (isLeft) {
        // we're in the left leaf node, there _must_ be a right node
        curr = curr.parent!.right;
        continue;
      }

      // this is a right leaf node, walk until a new right
      let walk = curr.parent;
      while (walk?.right === curr) {
        curr = walk;
        walk = walk.parent;
      }
      if (walk === null) {
        return;
      }
      curr = walk.right;
    }
  }

  #split(arr: number[]): JoinTreeNode<number> {
    const { length } = arr;
    if (length === 0) {
      throw new Error(`TODO: zero`);
    } else if (length === 1) {
      return {
        leaf: true,
        value: arr[0],
        parent: null,
        otherLeaf: new Set(),
      };
    }

    const split = length >>> 1;
    const left = arr.slice(0, split);
    const right = arr.slice(split);

    const o: JoinTreeNode<number> = {
      leaf: false,
      left: this.#split(left),
      right: this.#split(right),
      parent: null,
      otherBranch: new Set(),
    };

    o.left.parent = o;
    o.right.parent = o;

    return o;
  }

  /**
   * Find the common parent node between two nodes.
   */
  #common(nodeA: JoinTreeNode<number>, nodeB: JoinTreeNode<number>): BranchJoinTreeNode<number> | null {
    const all = new Set<JoinTreeNode<number>>();
    let curr: JoinTreeNode<number> | null = nodeA;
    while (curr) {
      all.add(curr);
      curr = curr.parent;
    }

    curr = nodeB;
    while (curr) {
      if (all.has(curr)) {
        return curr as BranchJoinTreeNode<number>;
      }
      curr = curr.parent;
    }
    return null;
  }

  #chain(child: BranchJoinTreeNode<number>, common: BranchJoinTreeNode<number>) {
    const out = [child];
    if (child === common) {
      return out;
    }

    let curr = child;
    while (curr.parent) {
      curr = curr.parent;
      if (curr === common) {
        break; // don't include common
      }
      out.push(curr);
    }

    return out;
  }

  /**
   * Join these two existing nodes together.
   */
  join(a: number, b: number) {
    const nodeA = this.index.get(a);
    const nodeB = this.index.get(b);

    if (nodeA === undefined || nodeB === undefined || nodeA === nodeB) {
      throw new Error(`bad nodes: ${a}~${b}`);
    }

    if (nodeA.otherLeaf.has(b)) {
      return false; // already joined
    }

    const common = this.#common(nodeA, nodeB);
    if (!common) {
      throw new Error(`internal error: no common node??`);
    }
    nodeA.otherLeaf.add(b);
    nodeB.otherLeaf.add(a);

    // Add one to all possible pairs.

    const allA = this.#chain(nodeA.parent!, common);
    const allB = this.#chain(nodeB.parent!, common);

    for (const sideA of allA) {
      for (const sideB of allB) {
        sideA.otherBranch.add(sideB);
        sideB.otherBranch.add(sideA);
      }
    }
    console.info('join mult', allA.length, allB.length);

    return true;

  }
}
