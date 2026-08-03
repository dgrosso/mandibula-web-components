import { expect, fixture, html } from "@open-wc/testing";
import "../packages/modal/src/index.js";

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

describe("mdb-modal", () => {
  it("keeps a replacement modal active while the previous close finishes", async () => {
    const first = await fixture(html`<mdb-modal></mdb-modal>`);
    const second = await fixture(html`<mdb-modal></mdb-modal>`);
    const container = document.querySelector("mdb-modal-container");

    container.open(first);
    container.close(first);
    container.open(second);
    await wait(550);

    expect(container._activeModal).to.equal(second);

    container.close(second);
    await wait(550);
    expect(container._activeModal).to.equal(null);
  });
});
