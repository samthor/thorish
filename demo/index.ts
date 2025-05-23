import { buildShadow, css, html, SizingElement } from '../src/dom/browser.ts';

export class DemoElement extends HTMLElement {
  constructor() {
    super();

    const s = buildShadow(
      html`
        <sizing-test>
          <div id="big"></div>
          <div id="big">
            Big!
            <button>Make bigger</button>
          </div>

          <div id="pad"></div>

          <div id="align">To bottom</div>
        </sizing-test>
      `,
      css`
        :host {
          display: contents !important;
        }

        #big {
          background: #00f1;
          border: 4px solid blue;
        }
        #align {
          position: absolute;
          bottom: 0;
          right: 0;
          background: green;
        }

        #pad {
          width: var(--sizing-inner-width);
          height: var(--sizing-inner-height);
          background: pink;
          opacity: 0.5;
          pointer-events: none;
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
x.style.display = 'block !important';
document.body.append(x, 'After the demo');
