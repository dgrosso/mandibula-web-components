import { expect } from "@open-wc/testing";
import { LitElement } from "lit";
import "../packages/web-components/src/index.js";

const elements = [
  "mdb-fader",
  "mdb-media-slot",
  "mdb-pointer",
  "mdb-scoped-inline-svg",
  "mdb-spinner",
  "mdb-suspense",
  "mdb-video",
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
