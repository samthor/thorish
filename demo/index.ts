import { buildShadow, css, html, SizingElement } from '../src/dom/browser.ts';

export class DemoElement extends HTMLElement {
  constructor() {
    super();

    const s = buildShadow(
      html`
        <sizing-test>
          <div id="big">
            Big!
            <button>Make bigger</button>
          </div>
          <div id="align" slot="abs">To bottom</div>
        </sizing-test>
      `,
      css`
        #big {
          background: #00f4;
        }
        #align {
          position: absolute;
          bottom: 0;
          right: 0;
          background: green;
        }
      `,
    );

    const root = s(this);
    const button = root.querySelector('button');
    button!.addEventListener('click', () => {
      const bigNode = button!.parentElement!;
      if (bigNode.style.height) {
        bigNode.style.height = '';
      } else {
        bigNode.style.height = '500px';
      }
    });
  }
}

customElements.define('sizing-test', SizingElement);
customElements.define('demo-test', DemoElement);

const x = document.createElement('demo-test');
document.body.append(x, 'After the demo');
