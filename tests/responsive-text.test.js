import { expect, fixture, html } from "@open-wc/testing";
import "../packages/responsive-text/src/index.js";

describe("mdb-responsive-text", () => {
  it("registers as a custom element and renders slotted text", async () => {
    const element = await fixture(
      html`<mdb-responsive-text>Responsive text</mdb-responsive-text>`
    );

    expect(element).to.be.instanceOf(HTMLElement);
    expect(element.shadowRoot.querySelector("slot")).to.exist;
    expect(element.textContent.trim()).to.equal("Responsive text");
  });

  it("maps CSS sizing attributes to custom properties", async () => {
    const element = await fixture(
      html`<mdb-responsive-text
        min-size="1.25rem"
        fluid-size="6vw"
        max-size="4rem"
        line-height="1"
      ></mdb-responsive-text>`
    );

    await element.updateComplete;

    expect(
      element.style.getPropertyValue("--mdb-responsive-text-min-size")
    ).to.equal("1.25rem");
    expect(
      element.style.getPropertyValue("--mdb-responsive-text-fluid-size")
    ).to.equal("6vw");
    expect(
      element.style.getPropertyValue("--mdb-responsive-text-max-size")
    ).to.equal("4rem");
    expect(
      element.style.getPropertyValue("--mdb-responsive-text-line-height")
    ).to.equal("1");
  });
});
