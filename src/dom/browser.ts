import { HtmlState, htmlStateMachine } from '../html-state.ts';

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

let temporaryHtmlEscaper: Element | undefined;

/**
 * Simple HTML interpolator.
 *
 * Naïvely builds a {@link DocumentFragment} with interpolated HTML-safe strings/etc.
 *
 * This has basic support for interpolating tag values and within comments etc.
 * This may throw if values are placed in the wrong location, e.g., a `Node` within a tag.
 * It probably would not survive untrusted user input.
 */
export function html(arr: TemplateStringsArray, ...rest: (string | number | Node)[]) {
  if (temporaryHtmlEscaper === undefined) {
    temporaryHtmlEscaper = document.createElement('span');
  }

  const idToReplace = new Map<string, Node>();
  const sm = htmlStateMachine();

  const parts: string[] = [];

  for (let i = 0; ; ++i) {
    parts.push(arr[i]);
    if (i + 1 === arr.length) {
      break; // no more inner to process
    }
    const state = sm.consume(arr[i]);

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

    const s = String(inner);
    if (state === HtmlState.TextOnlyClose) {
      if (s.includes(sm.closedBy)) {
        throw new Error(`can't inline text: contains closer=${sm.closedBy}`);
      }
      parts.push(s);
      continue;
    }

    temporaryHtmlEscaper.textContent = s;
    const escaped = temporaryHtmlEscaper.innerHTML;

    switch (state) {
      case HtmlState.WithinTag:
        throw new Error(`unsupported interpolation within <tag>`);

      case HtmlState.TagAttr:
        parts.push(`"${escaped}"`);
        continue;

      case HtmlState.WithinTagAttr:
      case HtmlState.Normal:
        parts.push(escaped);
        continue;
    }

    throw new Error(`should not get here`);
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

export function buildShadow(src: DocumentFragment, ...styles: CSSStyleSheet[]) {
  return (target: HTMLElement): ShadowRoot => {
    const root = target.attachShadow({ mode: 'open' });
    root.append(src.cloneNode(true));
    root.adoptedStyleSheets = styles;
    return root;
  };
}
