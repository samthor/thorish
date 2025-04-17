import { escapeStringFor, HtmlState, preprocessHtmlTemplateTag } from '../html-state.ts';
import { rafRunner, tickRunner } from '../promise.ts';
import { abortedSignal } from '../signal.ts';

/**
 * Simple CSS tagged literal interpolator.
 *
 * This actually does NO escaping or tracking of state, so user beware.
 */
export function css(arr: TemplateStringsArray, ...rest: (string | number)[]): CSSStyleSheet {
  const parts: string[] = [arr[0]];
  for (let i = 1; i < arr.length; ++i) {
    // interpolates but doesn't escape at all
    parts.push(String(rest[i - 1]), arr[i]);
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

  if (states.length + 1 !== arr.length || states.length !== rest.length) {
    // internal error really
    throw new Error(`unexpected html tag length`);
  }

  const parts: string[] = [];

  for (let i = 0; i < states.length; ++i) {
    parts.push(arr[i]);

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
  parts.push(arr[arr.length - 1]); // last one is always a gimme

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
  return buildShadowOptions({}, src, ...styles);
}

/**
 * Builds a tool which clones the given fragment/styles onto the target {@link HTMLElement} as a {@link ShadowRoot}.
 *
 * Basically for CE constructors.
 * Allows basic configuration.
 */
export function buildShadowOptions(
  options: { delegatesFocus?: boolean },
  src: DocumentFragment,
  ...styles: CSSStyleSheet[]
) {
  return (target: Element): ShadowRoot => {
    const root = target.attachShadow({ mode: 'open', delegatesFocus: options.delegatesFocus });
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

/**
 * Simple HTML superclass which provides an abstract {@link SignalHTMLElement#refresh} method which is called when the element is mounted.
 *
 * Call the protected method {@link SignalHTMLElement#invalidate} to trigger a refresh manually (e.g., some important value has changed).
 */
export abstract class SignalHTMLElement extends HTMLElement {
  private abort = () => {};
  private signal: AbortSignal = abortedSignal;

  connectedCallback() {
    this.maybeRefresh();
  }

  disconnectedCallback() {
    if (this.isConnected && !this.reparentShouldInvalidate()) {
      // we're about to have connectedCallback() fired, don't abort
    } else {
      this.abort();
    }
  }

  /**
   * Call to cause a refresh, e.g., some value has changed.
   */
  protected invalidate() {
    this.abort();
    this.maybeRefresh();
  }

  /**
   * Return `true` if this should cause a refresh/signal to be aborted.
   */
  protected reparentShouldInvalidate(): boolean {
    return false;
  }

  private maybeRefresh() {
    if (!this.isConnected || !this.signal.aborted) {
      return;
    }

    const c = new AbortController();
    this.signal = c.signal;
    this.abort = () => c.abort();

    this.refresh(this.signal);
  }

  protected abstract refresh(signal: AbortSignal): void;
}

/**
 * Non-abstract class which sizes its 'position' as best it can.
 * It is best placed inside something _else_ with `display: contents`, as we only inherit "supported" values.
 *
 * Slotted children are put into a flexbox which sets `flex-grow` on them.
 * That is, if you add multiple children, they'll be stacked in a column.
 *
 * Must be registered before use, not defined "for free" by this library.
 */
export class SizingElement extends HTMLElement {
  constructor() {
    super();

    const s = buildShadow(
      html`<div id="inner"><slot></slot></div>`,
      css`
        :host {
          all: inherit;
          display: inline-flex;
        }
        :host([block]) {
          display: flex;
        }

        #inner {
          margin: var(--sizing-negative-margin);
          flex-grow: 1;
          position: relative;
        }

        #inner {
          display: flex;
          flex-flow: row;
        }

        ::slotted(*) {
          flex-grow: 1 !important;
        }

        :host([grid]) #inner {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          grid-template-rows: minmax(0, 1fr);
        }

        :host([grid]) ::slotted(*) {
          grid-column: 1 / -1 !important;
          grid-row: 1 / -1 !important;
          max-width: 100% !important;
          max-height: 100% !important;
          box-sizing: border-box !important;
        }
      `,
    );
    const root = s(this);
    const inner = root.firstElementChild as HTMLElement;

    const prop = (prop: string, value: string) => inner.style.setProperty(prop, value);

    // we measure our own padding so we can 'expand' to match that edge and have contained elements
    // decide whether they care / want to incorporate the padding
    const refreshState = () => {
      const cs = window.getComputedStyle(this);
      const { paddingTop, paddingRight, paddingBottom, paddingLeft, padding } = cs;
      const negativePadding = `-${paddingTop} -${paddingRight} -${paddingBottom} -${paddingLeft}`;

      prop('--sizing-extra-width', `calc(${paddingLeft} + ${paddingRight})`);
      prop('--sizing-extra-height', `calc(${paddingTop} + ${paddingBottom})`);
      prop('--sizing-padding', padding);
      prop('--sizing-inner-width', cs.getPropertyValue('width'));
      prop('--sizing-inner-height', cs.getPropertyValue('height'));

      // TODO: Safari complains when padding is changed and we set this line
      // How often will people change padding in regular operation?
      prop('--sizing-negative-margin', negativePadding);
    };
    const ro = new ResizeObserver(tickRunner(refreshState));

    // we need all three (long story)
    ro.observe(this, { box: 'content-box' });
    ro.observe(this, { box: 'border-box' });
    ro.observe(inner);
  }
}
