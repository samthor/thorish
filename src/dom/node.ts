export function css(arr: TemplateStringsArray, ...rest: string[]): CSSStyleSheet {
  throw new Error(`css not in node`);
}

export function html(arr: TemplateStringsArray, ...rest: (string | number | Node)[]) {
  throw new Error(`html not in node`);
}

export function buildShadow(src: DocumentFragment, ...styles: CSSStyleSheet[]) {
  throw new Error(`buildShadow not in node`);
}

export function escapeHtmlEntites(str: string): string {
  return str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export abstract class SignalHTMLElement {
  constructor() {
    throw new Error(`SignalHTMLElement not in node`);
  }
}
