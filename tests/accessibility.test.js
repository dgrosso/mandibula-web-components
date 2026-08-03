import { expect, fixture, html } from "@open-wc/testing";
import "../packages/web-components/src/index.js";

const cases = [
  [
    "accessible-menu",
    () =>
      html`<mdb-accessible-menu toggle-selector="button">
        <button type="button" aria-expanded="false" aria-controls="a11y-menu">
          Resources
        </button>
        <div id="a11y-menu"><a href="#guide">Guide</a></div>
      </mdb-accessible-menu>`,
  ],
  [
    "carousel",
    () =>
      html`<mdb-carousel>
        <div data-mdb-carousel-viewport>
          <div data-mdb-carousel-track><article>Slide one</article></div>
        </div>
      </mdb-carousel>`,
  ],
  [
    "clickable-area",
    () =>
      html`<mdb-clickable-area preserve-layout>
        <a href="#target" data-clickable-area="target">Target</a>
      </mdb-clickable-area>`,
  ],
  ["collapsible", () => html`<mdb-collapsible open>Details</mdb-collapsible>`],
  ["counter", () => html`<mdb-counter value="100"></mdb-counter>`],
  [
    "document-preview-button",
    () =>
      html`<mdb-document-preview-button heading="Preview">
        <button slot="trigger" type="button">Preview</button>
      </mdb-document-preview-button>`,
  ],
  [
    "fader",
    () =>
      html`<mdb-fader label="Highlights"
        ><div>One</div>
        <div>Two</div></mdb-fader
      >`,
  ],
  [
    "media-slot",
    () =>
      html`<mdb-media-slot
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
        alt="Empty test image"
        width="10"
        height="10"
      ></mdb-media-slot>`,
  ],
  [
    "pagination",
    () =>
      html`<mdb-pagination pages="3" current="1">
        <button slot="previous" type="button">Previous</button>
        <template slot="indicator"><button type="button"></button></template>
        <button slot="next" type="button">Next</button>
      </mdb-pagination>`,
  ],
  ["paper", () => html`<mdb-paper><h2>Paper content</h2></mdb-paper>`],
  ["pointer", () => html`<mdb-pointer aria-hidden="true"></mdb-pointer>`],
  [
    "post-loop",
    () =>
      html`<mdb-post-loop disable-fetch>
        <div data-ajax-post-loop="posts" aria-live="polite">Results</div>
      </mdb-post-loop>`,
  ],
  [
    "responsive-text",
    () =>
      html`<mdb-responsive-text scaling="font-size"
        >Headline</mdb-responsive-text
      >`,
  ],
  [
    "scoped-inline-svg",
    () =>
      html`<mdb-scoped-inline-svg aria-hidden="true"></mdb-scoped-inline-svg>`,
  ],
  [
    "spinner",
    () =>
      html`<span role="status"
        ><mdb-spinner aria-hidden="true"></mdb-spinner>Loading</span
      >`,
  ],
  [
    "suspense",
    () => html`<mdb-suspense><div>Loaded content</div></mdb-suspense>`,
  ],
  ["video", () => html`<mdb-video alt="Example video"></mdb-video>`],
  [
    "video-modal-button",
    () =>
      html`<mdb-video-modal-button
        play-label="Play video"
      ></mdb-video-modal-button>`,
  ],
];

describe("component accessibility", () => {
  for (const [name, template] of cases) {
    it(`${name} has no automated axe violations`, async () => {
      const element = await fixture(template());
      await expect(element).to.be.accessible();
    });
  }

  it("open modal has a dialog name and named close control", async () => {
    const modal = await fixture(
      html`<mdb-modal label="Account settings">
        <section>
          <h2>Account settings</h2>
          <p>Example settings.</p>
        </section>
      </mdb-modal>`
    );
    modal.open = true;
    await modal.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));

    await expect(modal._contentWrapper).to.be.accessible();

    modal.close();
  });
});
