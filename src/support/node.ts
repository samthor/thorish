
export { isDeepStrictEqual as isArrayEqualIsh } from 'node:util';

export function base64ToBytes(s: string): Uint8Array {
  return Buffer.from(s, 'base64');
}

export function concatBytes(chunks: Uint8Array[]): Uint8Array {
  return Buffer.concat(chunks);
}