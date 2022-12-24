import * as fake from '#support';

export const isArrayEqualIsh = fake.isArrayEqualIsh;

const fauxStructuredClone = (o: any) => {
  if (typeof o !== 'object') {
    return o;
  }

  const out = {...o};
  for (const k in out) {
    out[k] = fauxStructuredClone(out[k])
  }
  return out;
};

export const structuredIshClone: <T> (o: T) => T = (typeof structuredClone === 'function') ? structuredClone : fauxStructuredClone;

