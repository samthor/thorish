import test from 'node:test';
import * as assert from 'node:assert';
import {
  escapeStringFor,
  HtmlState,
  htmlStateMachine,
  indexOfCloserWithinTagLike,
  preprocessHtmlTemplateTag,
} from '../src/html-state.ts';

test('stateMachine', () => {
  const x = htmlStateMachine();
  assert.strictEqual(x.consume('hello <!-- there <!-- --> bob'), HtmlState.Normal);
  assert.strictEqual(x.consume('<!-- what'), HtmlState.WithinComment);
  assert.strictEqual(x.consume('--> <div'), HtmlState.WithinTag);
  assert.strictEqual(x.consume(' x="y"  >'), HtmlState.Normal, 'should be normal');
  assert.strictEqual(x.consume('<script><lol x="y </script>'), HtmlState.Normal);
  assert.strictEqual(x.consume('<script2><lol x="y </script>'), HtmlState.WithinTagAttrDoubleQuote);
  assert.strictEqual(x.consume('"'), HtmlState.WithinTag);
});

test('preprocessCache', () => {
  const checker = (arr: TemplateStringsArray, ...rest: string[]) => {
    return preprocessHtmlTemplateTag(arr);
  };

  let prev: readonly HtmlState[] | undefined;

  for (let i = 0; i < 10; ++i) {
    const innerValue = '' + Math.random();

    const prep = checker`hi ${innerValue} there <script>${innerValue}</script>`;
    if (prev === undefined) {
      prev = prep;
    }

    assert.strictEqual(prev, prep, 'must be same exact ref');
  }
});

test('indexOfCloser', () => {
  assert.strictEqual(
    indexOfCloserWithinTagLike(HtmlState.WithinStyleTag, '< /style>  </style  >  abc'),
    '< /style>  </style  >'.length,
  );

  assert.strictEqual(
    indexOfCloserWithinTagLike(HtmlState.WithinScriptTag, '<style></script>'),
    '<style></script>'.length,
  );

  assert.strictEqual(
    indexOfCloserWithinTagLike(HtmlState.WithinScriptTag, '< /style>  </style  >  abc'),
    -1,
  );
});

test('escape', () => {
  assert.strictEqual(escapeStringFor(HtmlState.Normal, '<butts>'), '&lt;butts&gt;');

  assert.strictEqual(
    escapeStringFor(HtmlState.WithinTagAttrDoubleQuote, '<b"\'utts>'),
    "&lt;b&quot;'utts&gt;",
  );
});
