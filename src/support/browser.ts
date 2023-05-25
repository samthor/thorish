
/**
 * This is good enough for the matcher "any" stuff.
 */
export function isArrayEqualIsh(val1: unknown, val2: unknown) {
  if (val1 === val2) {
    return true;
  }

  if (Array.isArray(val1) && Array.isArray(val2)) {
    if (val1.length !== val2.length) {
      return false;
    }

    for (let i = 0; i < val1.length; ++i) {
      if (val1[i] !== val2[i]) {
        return false;
      }
    }

    return true;
  }

  return false;
}

/**
 * Convert a base64-encoded string to a {@link Uint8Array}.
 */
export function base64ToBytes(s: string): Uint8Array {
  // TODO: not base64?
  const sb = atob(s);

  const out = new Uint8Array(sb.length);
  for (let i = 0; i < out.length; ++i) {
    out[i] = sb.charCodeAt(i);
  }

  return out;
}
