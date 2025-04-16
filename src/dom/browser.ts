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
 * Non-abstract class which sizes its parent container as best it can.
 *
 * This has two main requirements:
 *  - the parent MUST NOT be `display` of "inline", "contents" or similar
 *  - the parent MUST NOT be `height: auto`
 *
 * In practice you should be able to influence the default behavior of the parent.
 * Set it to `display: block` and `height: 0` as defaults and let the user overwrite them.
 *
 * Must be registered before use, not defined "for free" by this library.
 */
export class SizingElement extends HTMLElement {
  private ro: ResizeObserver;
  private parent?: Element;
  private holder: HTMLElement;

  constructor() {
    super();

    const s = buildShadow(
      html`
        <div id="inner">
          <div id="abs"><slot name="abs"></slot></div>
          <slot></slot>
        </div>
      `,
      css`
        :host {
          flex-grow: 1; /* in case host is "display: flex" for some reason */

          position: relative;
          width: 100%;
          height: 100%;
          /* do NOT set Firefox; it is happy with height: 100% */
          height: -webkit-fill-available;
          display: flex;
        }

        main {
          width: 100%;
          height: 100%;
          background: blue;
          display: block;
        }

        #inner {
          margin: var(--sizing-negative-margin);
          position: relative;

          width: 100%;
          width: -webkit-fill-available;
          width: -moz-available;
          width: stretch;

          flex-grow: 1;
          /*          min-height: calc(100% + var(--sizing-extra-height)); */
          display: flex;
          flex-flow: column;

          min-height: var(--sizing-outer-height);
        }
        #abs {
          inset: 0;
          position: absolute;
          pointer-events: none;
        }
        ::slotted(*) {
          flex-grow: 1;
        }
      `,
    );
    const root = s(this);
    const holder = root.firstElementChild as HTMLElement;
    this.holder = holder;

    const safeApply = (prop: string, value: string) => {
      const prev = holder.style.getPropertyValue(prop);
      if (prev !== value) {
        holder.style.setProperty(prop, value);
      }
    };

    // This all exists so we can determine how much padding has been set on the <gumnut-text>, and
    // then 'expand' our interior rendering to match that edge, so that non-wrapped inputs still go
    // to the edge (but they themselves get _matching_ padding).
    const refreshState = () => {
      if (!this.parent) {
        return;
      }

      const cs = window.getComputedStyle(this.parent);
      const { paddingTop, paddingRight, paddingBottom, paddingLeft, padding } = cs;

      // console.debug('resize fired', {
      //   padding,
      //   ow: { w: this.offsetWidth, h: this.offsetHeight },
      //   pow: { w: this.parent.offsetWidth, h: this.parent.offsetHeight },
      // });

      safeApply('--sizing-extra-width', `calc(${paddingLeft} + ${paddingRight})`);
      safeApply('--sizing-extra-height', `calc(${paddingTop} + ${paddingBottom})`);
      safeApply('--sizing-padding', padding);
      safeApply(
        '--sizing-negative-margin',
        `-${paddingTop} -${paddingRight} -${paddingBottom} -${paddingLeft}`,
      );

      // TODO: these are 'dangerously' integer values
      holder.style.setProperty('--sizing-inner-width', `${this.offsetWidth}px`);
      holder.style.setProperty('--sizing-inner-height', `${this.offsetHeight}px`);

      if (this.parent instanceof HTMLElement) {
        holder.style.setProperty('--sizing-outer-width', `${this.parent.offsetWidth}px`);
        holder.style.setProperty('--sizing-outer-height', `${this.parent.offsetHeight}px`);
      }
    };
    this.ro = new ResizeObserver(tickRunner(refreshState));
  }

  connectedCallback() {
    if (this.parentElement instanceof Element) {
      this.parent = this.parentElement;
    } else {
      const root = this.getRootNode();
      if (root instanceof ShadowRoot) {
        this.parent = root.host;
      }
    }

    if (this.parent) {
      this.ro.observe(this);
      this.ro.observe(this.parent, { box: 'border-box' });
      this.ro.observe(this.holder);
    }
  }

  disconnectedCallback() {
    this.parent = undefined;
    this.ro.disconnect();
  }
}
