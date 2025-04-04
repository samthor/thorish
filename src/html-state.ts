import { escapeHtmlEntites } from '#dom';

export enum HtmlState {
  /**
   * Normal HTML state. Regular content allowed here.
   */
  Normal = 0,

  /**
   * Within a tag declaration, e.g. `<foo ...`, but not yet within an attribute.
   */
  WithinTag = 2,

  /**
   * Sitting directly after a `=` within a tag not followed by a quote.
   */
  TagAttr = 3,

  /**
   * Within a comment started with `<!--`.
   */
  WithinComment = 9,

  /**
   * Within a `<script>` tag. Important as it must be closed by `</script>`.
   */
  WithinScriptTag = 10,

  /**
   * Within a `<style>` tag. Important as it must be closed by `</style>`.
   */
  WithinStyleTag = 11,

  /**
   * Within a `<textarea>` tag. Important as it must be closed by `</textarea>`.
   */
  WithinTextAreaTag = 12,

  /**
   * Within a tag started by `"`.
   */
  WithinTagAttrDoubleQuote = 17,

  /**
   * Within a tag started by `'`.
   */
  WithinTagAttrSingleQuote = 18,
}

const nextRe = /<(\!--|\w+)/;

const withinTagNext = /(=?\s*\'|=?\s*\"|=\s*|>|\/\>)/;

const closedByRe = /^\s*>/;

export function indexOfCloserWithinTagLike(state: HtmlState, check: string) {
  let find: string;
  switch (state) {
    case HtmlState.WithinComment: {
      const index = check.indexOf('-->');
      if (index === -1) {
        return -1;
      }
      return index + 3;
    }

    case HtmlState.WithinScriptTag:
      find = '</script';
      break;

    case HtmlState.WithinStyleTag:
      find = '</style';
      break;

    case HtmlState.WithinTextAreaTag:
      find = '</textarea';
      break;

    default:
      return -1;
  }

  let out = check.indexOf(find);
  if (out === -1) {
    return -1;
  }
  out += find.length;

  // we are "<script", look for spaces and closing ">"
  const rest = check.substring(out);
  if (!closedByRe.test(rest)) {
    return -1;
  }
  const indexOfEnd = rest.indexOf('>');
  if (indexOfEnd === -1) {
    throw new Error(`should never happen`);
  }
  return out + indexOfEnd + 1;
}

/**
 * Escapes the given raw string for its placement within HTML based on the given state.
 *
 * This may throw in two cases:
 *    - state is `HtmlState.Within...` and the text contains the closer (dangerous)
 *    - state is {@link HtmlState.WithinTag}, no valid/obvious interpolation (TODO: could allow valid attr names)
 */
export function escapeStringFor(state: HtmlState, s: string | number) {
  s = String(s);

  if (indexOfCloserWithinTagLike(state, s) !== -1) {
    // e.g., if the text you're inlining in a comment includes "-->", disallow it
    // or "</script>" inside "<script>...</script>"
    let msg: string = '?';
    switch (state) {
      case HtmlState.WithinComment:
        msg = '-->';
        break;
      case HtmlState.WithinScriptTag:
        msg = '</script>';
        break;
      case HtmlState.WithinStyleTag:
        msg = '</style>';
        break;
      case HtmlState.WithinTextAreaTag:
        msg = '</textarea>';
        break;
    }
    throw new Error(`can't inline text: dangerously contains closer "${msg}"`);
  }

  switch (state) {
    case HtmlState.WithinComment:
    case HtmlState.WithinScriptTag:
    case HtmlState.WithinStyleTag:
    case HtmlState.WithinTextAreaTag:
      // safe because of indexOfCloserWithinTagLike above
      return s;
  }

  const escaped = escapeHtmlEntites(s);
  switch (state) {
    case HtmlState.WithinTag:
      throw new Error(`unsupported interpolation within <tag>`);

    case HtmlState.TagAttr:
      return `"${escaped.replaceAll('"', '&quot;')}"`;

    case HtmlState.WithinTagAttrDoubleQuote:
      return escaped.replaceAll('"', '&quot;');

    case HtmlState.WithinTagAttrSingleQuote:
      return escaped.replaceAll("'", '&apos;');

    case HtmlState.Normal:
      return escaped;
  }
}

export function htmlStateMachine() {
  let state: HtmlState = HtmlState.Normal;
  let upcomingWithinTag = '';

  const internalConsume = (next: string) => {
    if (!next) {
      return;
    }

    switch (state) {
      case HtmlState.TagAttr: {
        // this exists only as a helper for who's using us: we're at a relevant point
        state = HtmlState.WithinTag;
        return internalConsume(next);
      }

      case HtmlState.WithinTagAttrDoubleQuote:
      case HtmlState.WithinTagAttrSingleQuote: {
        const search = state === HtmlState.WithinTagAttrDoubleQuote ? '"' : "'";
        const escapeIndex = next.indexOf(search);
        if (escapeIndex === -1) {
          return;
        }
        state = HtmlState.WithinTag;
        return internalConsume(next.substring(escapeIndex + 1));
      }

      case HtmlState.WithinTag: {
        const m = withinTagNext.exec(next);
        if (!m) {
          return;
        }
        const inner = m[1];
        const last = inner[inner.length - 1];
        if (last === '"') {
          state = HtmlState.WithinTagAttrDoubleQuote;
        } else if (last === "'") {
          state = HtmlState.WithinTagAttrSingleQuote;
        } else if (inner[0] === '=') {
          state = HtmlState.TagAttr;
        } else {
          switch (upcomingWithinTag) {
            case 'script':
              state = HtmlState.WithinScriptTag;
              break;
            case 'style':
              state = HtmlState.WithinStyleTag;
              break;
            case 'textarea':
              state = HtmlState.WithinTextAreaTag;
              break;
            default:
              state = HtmlState.Normal;
          }
          upcomingWithinTag = '';
        }

        return internalConsume(next.substring(m.index + m[1].length));
      }

      case HtmlState.Normal: {
        const m = nextRe.exec(next);
        if (!m) {
          return;
        }

        if (m[1] === '!--') {
          // found comment
          state = HtmlState.WithinComment;
          return internalConsume(next.substring(m.index));
        }
        upcomingWithinTag = m[1];

        state = HtmlState.WithinTag;
        return internalConsume(next.substring(m.index + m[1].length));
      }

      case HtmlState.WithinComment:
      case HtmlState.WithinScriptTag:
      case HtmlState.WithinStyleTag:
      case HtmlState.WithinTextAreaTag: {
        const index = indexOfCloserWithinTagLike(state, next);
        if (index === -1) {
          return; // no state change
        }
        state = HtmlState.Normal;
        next = next.substring(index);
        return internalConsume(next);
      }

      default: {
        const x: never = state;
        throw new Error(`unhandled state: ${state}`);
      }
    }
  };

  return {
    consume(next: string): HtmlState {
      internalConsume(next);
      return state;
    },
  };
}

const preprocessCache = /* @__PURE__ */ new WeakMap<TemplateStringsArray, readonly HtmlState[]>();

export function preprocessHtmlTemplateTag(arr: TemplateStringsArray): readonly HtmlState[] {
  const prev = preprocessCache.get(arr);
  if (prev) {
    return prev;
  }

  const sm = htmlStateMachine();
  const states: HtmlState[] = [];

  for (let i = 0; ; ++i) {
    if (i + 1 === arr.length) {
      break; // no more inner to process
    }
    const state = sm.consume(arr[i]);
    states.push(state);
  }

  const f = Object.freeze(states);
  preprocessCache.set(arr, f);
  return f;
}
