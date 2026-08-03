import { expect, fixture, html, oneEvent } from "@open-wc/testing";
import "../packages/clickable-area/src/index.js";

describe("mdb-clickable-area", () => {
  it("delegates a container click to its explicit target", async () => {
    const element = await fixture(html`
      <mdb-clickable-area preserve-layout>
        <a href="#target" data-clickable-area="target">Target</a>
        <span>Click area</span>
      </mdb-clickable-area>
    `);
    const link = element.querySelector("a");
    const clicked = oneEvent(link, "click");

    element.querySelector("span").click();
    const event = await clicked;

    expect(event.target).to.equal(link);
  });
});
