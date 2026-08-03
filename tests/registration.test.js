import { expect } from "@open-wc/testing";
import { LitElement } from "lit";
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
  "mdb-modal-container",
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

describe("Mandíbula component registry", () => {
  for (const tagName of elements) {
    it(`registers ${tagName} as a Lit element`, () => {
      const ElementClass = customElements.get(tagName);

      expect(ElementClass).to.be.a("function");
      expect(ElementClass.prototype).to.be.instanceOf(LitElement);
    });
  }
});
