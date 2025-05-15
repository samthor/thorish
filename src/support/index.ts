export { concatBytes, base64UrlToBytes, toBase64Url, base64UrlToString } from '#support';

import * as fake from '#support';

export const isArrayEqualIsh = fake.isArrayEqualIsh;

const fauxStructuredClone = (o: any) => {
  if (typeof o !== 'object') {
    return o;
  }

  const out = { ...o };
  for (const k in out) {
    out[k] = fauxStructuredClone(out[k]);
  }
  return out;
};

export const structuredIshClone: <T>(o: T) => T =
  typeof structuredClone === 'function' ? structuredClone : fauxStructuredClone;

// FIXME: can't convince esbuild that this is pure (I guess it's not)

// /**
//  * Escapes basic HTML entities. (Does not escape `"` or `'`).
//  */
// let escapeHtmlEntites: (str: string) => string;

// if (typeof document === 'object') {
//   const temporaryHtmlEscaper: Element = /* @__PURE__ */ document.createElement('span');
//   escapeHtmlEntites = /* @__PURE__ */ (s: string): string => {
//     temporaryHtmlEscaper.textContent = s;
//     return temporaryHtmlEscaper.innerHTML;
//   };
// } else {
//   escapeHtmlEntites = /* @__PURE__ */ (str: string): string => {
//     return str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
//   };
// }

// export { escapeHtmlEntites };

export const escapeHtmlEntites = /* @__PURE__ */ (str: string): string => {
  return str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
};
