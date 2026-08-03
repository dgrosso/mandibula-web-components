import { expect, fixture, html } from "@open-wc/testing";
import "../packages/collapsible/src/index.js";

describe("mdb-collapsible", () => {
  it("exposes open, close, and toggle methods", async () => {
    const element = await fixture(
      html`<mdb-collapsible>Body</mdb-collapsible>`
    );

    element.openCollapsible();
    await element.updateComplete;
    expect(element.open).to.equal(true);
    expect(element.hasAttribute("open")).to.equal(true);

    element.toggleCollapsible();
    await element.updateComplete;
    expect(element.open).to.equal(false);
  });
});
