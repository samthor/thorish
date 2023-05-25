
export { isDeepStrictEqual as isArrayEqualIsh } from 'node:util';

/**
 * Convert a base64-encoded string to a {@link Uint8Array}.
 */
export function base64ToBytes(s: string): Uint8Array {
  return Buffer.from(s, 'base64');
}
