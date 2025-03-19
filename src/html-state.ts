export enum HtmlState {
  Normal = 0, // outside tags
  TextOnlyClose = 1, // within <script>, <style> or a comment; tags not allowed except the matching closer
  WithinTag = 2, // within `<script ... `>
  TagAttr = 3, // sitting directly after `=`
  WithinTagAttr = 4, // sitting within quoted string for attr `key="foo"`
}

const nextRe = /<(\!--|\w+)/;

const withinTagNext = /(=?\'|=?\"|=|>|\/\>)/;

export function htmlStateMachine() {
  let state: HtmlState = HtmlState.Normal;
  let closedBy = '';

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

      case HtmlState.WithinTagAttr: {
        const escapeIndex = next.indexOf(closedBy);
        if (escapeIndex === -1) {
          return;
        }
        closedBy = '';
        state = HtmlState.WithinTag;
        return internalConsume(next.substring(escapeIndex + 1));
      }

      case HtmlState.WithinTag: {
        const m = withinTagNext.exec(next);
        if (!m) {
          return;
        }

        switch (m[1]) {
          case '/>':
          case '>':
            state = closedBy ? HtmlState.TextOnlyClose : HtmlState.Normal;
            break;

          case `='`:
          case `="`:
          case `'`:
          case `"`:
            closedBy = m[1].substring(m[1].length - 1);
            state = HtmlState.WithinTagAttr;
            break;

          case '=':
            state = HtmlState.TagAttr;
            break;

          default:
            throw new Error(`unexpected next: ${m[1]}`);
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
          state = HtmlState.TextOnlyClose;
          closedBy = '-->';
          return internalConsume(next.substring(m.index));
        }

        if (m[1] === 'script' || m[1] === 'style') {
          closedBy = `</${m[1]}`;
        }

        state = HtmlState.WithinTag;
        return internalConsume(next.substring(m.index + m[1].length));
      }

      case HtmlState.TextOnlyClose: {
        if (!closedBy) {
          throw new Error(`missing closedBy`);
        }
        const index = next.indexOf(closedBy);
        if (index === -1) {
          return;
        }
        next = next.substring(index + closedBy.length);

        if (!closedBy.endsWith('>')) {
          // consume e.g., "</script   >" (space allowed)
          while (next[0] === ' ') {
            next = next.substring(1);
          }
          if (next[0] !== '>') {
            return internalConsume(next);
          }
          next = next.substring(1);
        }

        state = HtmlState.Normal;
        closedBy = '';
        return internalConsume(next);
      }

      default:
        throw new Error(`unhandled state: ${state}`);
    }
  };

  return {
    consume(next: string): HtmlState {
      internalConsume(next);
      return state;
    },
    get closedBy(): string {
      if (closedBy !== '-->') {
        return closedBy + '>';
      }
      return closedBy;
    },
  };
}
