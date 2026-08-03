import { expect, fixture } from "@open-wc/testing";
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

describe("Mandíbula component lifecycle", () => {
  for (const tagName of elements) {
    it(`connects ${tagName} without throwing`, async () => {
      const element = document.createElement(tagName);

      const connected = await fixture(element);
      if (connected.updateComplete) {
        await connected.updateComplete;
      }

      expect(connected.isConnected).to.equal(true);
    });
  }

  it("does not register the legacy namespace", () => {
    expect(customElements.get("ona-spinner")).to.equal(undefined);
  });
});
