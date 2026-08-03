import { expect, fixture, html } from "@open-wc/testing";
import "../packages/web-components/src/index.js";

const cases = [
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
  ["pointer", () => html`<mdb-pointer aria-hidden="true"></mdb-pointer>`],
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
];

describe("component accessibility", () => {
  for (const [name, template] of cases) {
    it(`${name} has no automated axe violations`, async () => {
      const element = await fixture(template());
      await expect(element).to.be.accessible();
    });
  }
});
