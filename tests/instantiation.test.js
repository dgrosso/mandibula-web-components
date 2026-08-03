import { expect, fixture } from "@open-wc/testing";
import "../packages/web-components/src/index.js";

const elements = [
  "mdb-accessible-menu",
  "mdb-carousel",
  "mdb-clickable-area",
  "mdb-collapsible",
  "mdb-counter",
  "mdb-document-preview-button",
  "mdb-fader",
  "mdb-media-slot",
  "mdb-modal",
  "mdb-pagination",
  "mdb-paper",
  "mdb-pointer",
  "mdb-post-loop",
  "mdb-post-loop-filters",
  "mdb-post-loop-pagination",
  "mdb-responsive-text",
  "mdb-scoped-inline-svg",
  "mdb-spinner",
  "mdb-suspense",
  "mdb-video",
  "mdb-video-modal-button",
];

describe("Mandíbula component lifecycle", () => {
  for (const tagName of elements) {
    it(`connects ${tagName} without throwing`, async () => {
      const element = document.createElement(tagName);
      if (tagName === "mdb-post-loop") {
        element.setAttribute("disable-fetch", "");
      }
      if (tagName === "mdb-accessible-menu") {
        element.setAttribute("toggle-selector", "button");
      }

      const connected = await fixture(element);
      if (connected.updateComplete) {
        await connected.updateComplete;
      }

      expect(connected.isConnected).to.equal(true);
    });
  }

  it("does not register the legacy namespace", () => {
    expect(customElements.get("ona-counter")).to.equal(undefined);
  });
});
