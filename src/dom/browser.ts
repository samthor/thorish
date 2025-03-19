import { escapeStringFor, HtmlState, preprocessHtmlTemplateTag } from '../html-state.ts';

/**
 * Simple CSS tagged literal interpolator.
 *
 * This actually does NO escaping or tracking of state, so user beware.
 */
export function css(arr: TemplateStringsArray, ...rest: string[]): CSSStyleSheet {
  const parts: string[] = [arr[0]];
  for (let i = 1; i < arr.length; ++i) {
    // interpolates but doesn't escape at all
    parts.push(rest[i - 1], arr[i]);
  }

  const styleSheet = new CSSStyleSheet();
  styleSheet.replaceSync(parts.join(''));
  return styleSheet;
}

/**
 * Naïvely builds a {@link DocumentFragment} with interpolated HTML-safe strings/etc.
 *
 * This has basic support for interpolating tag values and within comments etc.
 * This may throw if values are placed in the wrong location, e.g., a `Node` within a tag.
 * It probably would not survive untrusted user input.
 */
export function html(arr: TemplateStringsArray, ...rest: (string | number | Node)[]) {
  const idToReplace = new Map<string, Node>();
  const states = preprocessHtmlTemplateTag(arr);

  const parts: string[] = [];

  for (let i = 0; i < states.length; ++i) {
    parts.push(arr[i]);
    if (i === rest.length) {
      break; // no more data to process (last one is a gimme)
    }

    const state = states[i];

    const inner = rest[i];
    if (inner instanceof Node) {
      if (state !== HtmlState.Normal) {
        throw new Error(`can only place Node within regular HTML`);
      }

      const id = `__html_${Math.random()}`;
      parts.push(`<link id="${id}" />`);
      idToReplace.set(id, inner);
      continue;
    }

    parts.push(escapeStringFor(state, inner));
  }
  temporaryHtmlEscaper.textContent = '';

  const node = document.createElement('div');
  node.innerHTML = parts.join('');

  const frag = document.createDocumentFragment();
  frag.append(...node.children);

  for (const [id, node] of idToReplace) {
    const target = frag.getElementById(id)!;
    if (node instanceof DocumentFragment) {
      target.replaceWith(node.cloneNode(true));
    } else {
      target.replaceWith(node);
    }
  }

  return frag;
}

/**
 * Builds a tool which clones the given fragment/styles onto the target {@link HTMLElement} as a {@link ShadowRoot}.
 *
 * Basically for CE constructors.
 */
export function buildShadow(src: DocumentFragment, ...styles: CSSStyleSheet[]) {
  return (target: Element): ShadowRoot => {
    const root = target.attachShadow({ mode: 'open' });
    root.append(src.cloneNode(true));
    root.adoptedStyleSheets = styles;
    return root;
  };
}

const temporaryHtmlEscaper: Element = /* @__PURE__ */ document.createElement('span');

/**
 * Escapes basic HTML entities. (Does not escape `"` or `'`).
 */
export function escapeHtmlEntites(s: string): string {
  temporaryHtmlEscaper.textContent = s;
  return temporaryHtmlEscaper.innerHTML;
}
