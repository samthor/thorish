
export { isDeepStrictEqual as isArrayEqualIsh } from 'node:util';

export function base64ToBytes(s: string): Uint8Array {
  return Buffer.from(s, 'base64');
}
