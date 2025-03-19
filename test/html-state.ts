import test from 'node:test';
import * as assert from 'node:assert';
import * as dom from '../src/html-state.js';

test('stateMachine', () => {
  const x = dom.htmlStateMachine();
  assert.strictEqual(x.consume('hello <!-- there <!-- --> bob'), dom.HtmlState.Normal);
  assert.strictEqual(x.consume('<!-- what'), dom.HtmlState.TextOnlyClose);
  assert.strictEqual(x.consume('--> <div'), dom.HtmlState.WithinTag);
  assert.strictEqual(x.consume(' x="y"  >'), dom.HtmlState.Normal);
  assert.strictEqual(x.consume('<script><lol x="y </script>'), dom.HtmlState.Normal);
  assert.strictEqual(x.consume('<script2><lol x="y </script>'), dom.HtmlState.WithinTagAttr);
  assert.strictEqual(x.consume('"'), dom.HtmlState.WithinTag);
});
