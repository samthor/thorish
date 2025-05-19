class AANode<X> {
  level: number = 1;
  left: AANode<X> | null = null;
  right: AANode<X> | null = null;

  constructor(public data: X) {}
}

/**
 * AATree implementation.
 *
 * Obviously `O(logn)` performance, but scales linearly under performance testing.
 * (Future readers: don't look here for perf gains.)
 *
 * https://en.wikipedia.org/wiki/AA_tree
 */
export class AATree<X extends F, F = X> {
  private root: AANode<X> | null = null;
  private _count = 0;
  private _change = false;

  constructor(private compare: (a: F, b: F) => number) {}

  clear() {
    this.root = null;
    this._count = 0;
  }

  /**
   * The count of items in this tree.
   */
  count(): number {
    return this._count;
  }

  /**
   * Query for this exact node.
   */
  query(data: F): X | undefined {
    let node = this.root;

    while (node !== null) {
      const c = this.compare(data, node.data);
      if (c < 0) {
        node = node.left;
      } else if (c > 0) {
        node = node.right;
      } else {
        return node.data;
      }
    }

    return undefined;
  }

  /**
   * Finds the target node or the node closest before the query.
   */
  equalBefore(data: F): X | undefined {
    return this._equalBefore(this.root, data);
  }

  /**
   * Finds the node immediately before the query.
   */
  before(data: F): X | undefined {
    let best: X | undefined;
    let node = this.root;

    while (node !== null) {
      const c = this.compare(data, node.data);
      if (c > 0) {
        best = node.data;
        node = node.right;
      } else {
        node = node.left;
      }
    }

    return best;
  }

  /**
   * Finds the target node or the node closest after the query.
   */
  equalAfter(data: F): X | undefined {
    return this._equalAfter(this.root, data);
  }

  /**
   * Finds the node immediately after the query.
   */
  after(data: F): X | undefined {
    let best: X | undefined;
    let node = this.root;

    while (node !== null) {
      const c = this.compare(data, node.data);
      if (c < 0) {
        best = node.data;
        node = node.left;
      } else {
        node = node.right;
      }
    }

    return best;
  }

  /**
   * Inserts the value. Updates the previous value if compare is zero.
   *
   * @return if there was a change
   */
  insert(data: X): boolean {
    this._change = false;
    this.root = this._insert(this.root, data);
    return this._change;
  }

  /**
   * Removes the value.
   *
   * @return if there was a change
   */
  remove(data: F): boolean {
    this._change = false;
    this.root = this._remove(this.root, data);
    return this._change;
  }

  private skew(node: AANode<X>) {
    if (node.left?.level !== node.level) {
      return node;
    }
    const leftNode = node.left;
    node.left = leftNode.right;
    leftNode.right = node;
    return leftNode;
  }

  private split(node: AANode<X>) {
    if (node.right?.right?.level !== node.level) {
      return node;
    }
    const rightNode = node.right;
    node.right = rightNode.left;
    rightNode.left = node;
    ++rightNode.level;
    return rightNode;
  }

  private _equalBefore(node: AANode<X> | null, data: F): X | undefined {
    while (node !== null) {
      const c = this.compare(data, node.data);
      if (c < 0) {
        node = node.left;
        continue;
      }

      if (c === 0) {
        return node.data; // found it
      }

      // recursive on right so we can compare value
      const within = this._equalBefore(node.right, data);
      return within === undefined ? node.data : within;
    }
  }

  private _equalAfter(node: AANode<X> | null, data: F): X | undefined {
    while (node !== null) {
      const c = this.compare(data, node.data);
      if (c > 0) {
        node = node.right;
        continue;
      }

      if (c === 0) {
        return node.data; // found it
      }

      // recursive on left so we can compare value
      const within = this._equalAfter(node.left, data);
      return within === undefined ? node.data : within;
    }
  }

  private _insert(node: AANode<X> | null, data: X) {
    if (node === null) {
      ++this._count;
      this._change = true;
      return new AANode(data);
    }

    const c = this.compare(data, node.data);

    if (c < 0) {
      node.left = this._insert(node.left, data);
    } else if (c > 0) {
      node.right = this._insert(node.right, data);
    } else {
      if (node.data !== data) {
        this._change = true;
        node.data = data;
      }
      return node; // found ourselves
    }
    node = this.skew(node);
    node = this.split(node);
    return node;
  }

  private _remove(node: AANode<X> | null, data: F) {
    if (node === null) {
      return null;
    }
    const c = this.compare(data, node.data);

    if (c < 0) {
      node.left = this._remove(node.left, data);
    } else if (c > 0) {
      node.right = this._remove(node.right, data);
    } else {
      --this._count;
      this._change = true;

      if (node.left === null && node.right === null) {
        return null;
      } else if (node.left === null) {
        return node.right;
      } else if (node.right === null) {
        return node.left;
      } else {
        const successor = this._findMin(node.right);
        node.data = successor.data;
        node.right = this._remove(node.right, successor.data);
      }
    }

    const newLevel = Math.min(node.left?.level ?? 0, node.right?.level ?? 0) + 1;
    if (newLevel < node.level) {
      node.level = newLevel;
      if (node.right && newLevel < node.right.level) {
        node.right.level = newLevel;
      }
    }

    node = this.skew(node);
    node = this.split(node);

    if (node.right) {
      node.right = this.skew(node.right);
      node.right = this.split(node.right);

      if (node.right?.right) {
        node.right.right = this.split(node.right.right);
      }
    }

    return node;
  }

  private _findMin(node: AANode<X>) {
    while (node.left) {
      node = node.left;
    }
    return node;
  }
}
