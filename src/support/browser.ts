/**
 * Checks, at minimum, whether the two passed values are arrays with the same length and the same soft-references within the array.
 *
 * In Node, this will just use deep equality.
 */
export function isArrayEqualIsh(val1: unknown, val2: unknown) {
  if (val1 === val2) {
    return true;
  }

  if (!Array.isArray(val1) || !Array.isArray(val2) || val1.length !== val2.length) {
    return false;
  }

  for (let i = 0; i < val1.length; ++i) {
    if (val1[i] !== val2[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Convert a base64url-encoded string into {@link Uint8Array}.
 *
 * Slow in browser.
 */
export function base64UrlToBytes(s: string): Uint8Array {
  if ('fromBase64' in Uint8Array) {
    // @ts-ignore
    return Uint8Array.fromBase64(s, { alphabet: 'base64url' });
  }

  const sb = atob(s.replaceAll('-', '+').replaceAll('_', '/'));

  const out = new Uint8Array(sb.length);
  for (let i = 0; i < out.length; ++i) {
    out[i] = sb.charCodeAt(i);
  }

  return out;
}

/**
 * Convert a base64url-encoded string into a string via UTF-8.
 *
 * Slow in browser.
 */
export function base64UrlToString(s: string) {
  return new TextDecoder('utf-8').decode(base64UrlToBytes(s));
}

/**
 * Converts a {@link Uint8Array} or string (as UTF-8) to a base64url-encoded string without padding.
 *
 * Slow in browser.
 */
export function toBase64Url(s: string | Uint8Array): string {
  if (typeof s === 'string') {
    s = new TextEncoder().encode(s);
  }

  if ('toBase64' in s) {
    // @ts-ignore
    return s.toBase64({ alphabet: 'base64url', omitPadding: true });
  }

  const bs = String.fromCodePoint(...s); // btoa works on ascii strings
  return btoa(bs).replace(/=+$/, '').replaceAll('+', '-').replaceAll('/', '_');
}

/**
 * Concat the given {@link Uint8Array} together. If only one is given, returns that in-place.
 */
export function concatBytes(chunks: Uint8Array[]) {
  chunks = chunks.filter((chunk) => chunk.length !== 0);

  if (chunks.length === 0) {
    return new Uint8Array();
  } else if (chunks.length === 1) {
    return chunks[0];
  }

  let size = 0;
  chunks.forEach((chunk) => (size += chunk.length));
  const out = new Uint8Array(size);
  let at = 0;
  chunks.forEach((chunk) => {
    out.set(chunk, at);
    at += chunk.length;
  });

  return out;
}

// export const nextTick = /* @__PURE__ */ (() => {
//   const isIOS = /iphone|ipad|ipod|ios/.test(window.navigator.userAgent);
//   const noop = () => {};

//   return (cb: () => {}) => {
//     resolvedPromise.then(cb);
//     if (isIOS) {
//       setTimeout(noop);
//     }
//   };
// })();
