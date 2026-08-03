import { expect, fixture, html } from "@open-wc/testing";
import "../packages/scoped-inline-svg/src/index.js";

describe("mdb-scoped-inline-svg", () => {
  it("removes executable and external SVG content", async () => {
    const element = await fixture(html`<mdb-scoped-inline-svg />`);

    element._renderScopedSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
        <script>alert(1)</script>
        <style>@import url(https://example.com/style.css)</style>
        <a href="https://example.com"><circle onclick="alert(1)" style="fill:red" r="4" /></a>
      </svg>
    `);
    await element.updateComplete;

    const svg = element.shadowRoot.querySelector("svg");
    expect(svg.querySelector("script")).to.equal(null);
    expect(svg.querySelector("style")).to.equal(null);
    expect(svg.querySelector("a").hasAttribute("href")).to.equal(false);
    expect(svg.querySelector("circle").hasAttribute("onclick")).to.equal(false);
    expect(svg.querySelector("circle").hasAttribute("style")).to.equal(false);
  });
});
