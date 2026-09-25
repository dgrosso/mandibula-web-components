import { expect, fixture, html } from "@open-wc/testing";
import "../packages/slider/src/index.js";

describe("mdb-slider", () => {
  it("registers and exposes a native scroll-snap viewport", async () => {
    const element = await fixture(html`
      <mdb-slider>
        <div>One</div>
        <div>Two</div>
      </mdb-slider>
    `);

    await element.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const viewport = element.shadowRoot.querySelector(".viewport");
    expect(element).to.be.instanceOf(HTMLElement);
    expect(viewport).to.exist;
    expect(getComputedStyle(viewport).scrollSnapType).to.contain("x");
  });

  it("navigates by index and emits change", async () => {
    const element = await fixture(html`
      <mdb-slider>
        <div>One</div>
        <div>Two</div>
        <div>Three</div>
      </mdb-slider>
    `);

    await element.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const events = [];
    element.addEventListener("change", (event) => events.push(event.detail));

    element.goTo(2);
    await element.updateComplete;

    expect(element.current).to.equal(2);
    expect(events.at(-1)).to.deep.equal({ current: 2, total: 3 });
  });

  it("keeps imperative navigation finite unless loop is enabled", async () => {
    const element = await fixture(html`
      <mdb-slider>
        <div>One</div>
        <div>Two</div>
      </mdb-slider>
    `);

    await element.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));

    element.goTo(1);
    await element.updateComplete;
    element.next();
    expect(element.current).to.equal(1);

    element.loop = true;
    element.next();
    await element.updateComplete;
    expect(element.current).to.equal(0);

    element.prev();
    await element.updateComplete;
    expect(element.current).to.equal(1);
  });

  it("adds carousel semantics to slides", async () => {
    const element = await fixture(html`
      <mdb-slider label="Highlights">
        <article>One</article>
        <article>Two</article>
      </mdb-slider>
    `);

    await element.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const slides = [...element.children];
    expect(slides[0].getAttribute("aria-roledescription")).to.equal("slide");
    expect(slides[0].getAttribute("aria-label")).to.equal("1 of 2");
    expect(slides[0].getAttribute("aria-current")).to.equal("true");
    expect(slides[1].hasAttribute("aria-current")).to.equal(false);
  });
});
