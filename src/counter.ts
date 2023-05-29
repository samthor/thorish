import { TransformMap } from './maps.js';

/**
 * Helper to create implicit counts of things.
 */
export class StatsCount<K = string> extends TransformMap<K, number> {
  constructor() {
    super(0, (v, update) => v + update);
  }

  inc(k: K, by: number) {
    return this.update(k, by);
  }
}
