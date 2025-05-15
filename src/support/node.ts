export { isDeepStrictEqual as isArrayEqualIsh } from 'node:util';

export function base64UrlToBytes(s: string): Uint8Array {
  return Buffer.from(s, 'base64url') as Uint8Array;
}

export function base64UrlToString(s: string) {
  return new TextDecoder('utf-8').decode(base64UrlToBytes(s));
}

export function toBase64Url(s: string | Uint8Array) {
  let b: Buffer;

  if (typeof s === 'string') {
    b = Buffer.from(s, 'utf-8');
  } else {
    b = Buffer.from(s);
  }

  return b.toString('base64url'); // node doesn't emit trailing ='s
}

export function concatBytes(chunks: Uint8Array[]): Uint8Array {
  return Buffer.concat(chunks) as Uint8Array;
}

export const nextTick = /* @__PURE__ */ (() => process.nextTick as (callback: () => {}) => void)();

export function escapeHtmlEntites(str: string): string {
  return str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
