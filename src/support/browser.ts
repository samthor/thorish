
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
