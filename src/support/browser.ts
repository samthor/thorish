
export function isDeepStrictEqual(val1: unknown, val2: unknown) {
  if (val1 === val2) {
    return true;
  }

  if (val1 && typeof val1 === 'object' && val2 && typeof val2 === 'object') {
    throw new Error('TODO: browser support');
  }
}
