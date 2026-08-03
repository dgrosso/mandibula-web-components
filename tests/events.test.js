import { expect } from "@open-wc/testing";
import "../packages/pagination/src/index.js";

describe("cross-platform events", () => {
  it("emits bubbling and composed custom events", () => {
    const element = document.createElement("mdb-pagination");
    let received;
    document.body.append(element);
    document.body.addEventListener(
      "mdb-test-event",
      (event) => {
        received = event;
      },
      { once: true }
    );

    element._emit("mdb-test-event", { page: 2 });

    expect(received.detail).to.deep.equal({ page: 2 });
    expect(received.bubbles).to.equal(true);
    expect(received.composed).to.equal(true);
    element.remove();
  });

  it("keeps pagination aria-current synchronized", async () => {
    const element = document.createElement("mdb-pagination");
    element.innerHTML = `
      <button slot="previous" type="button">Previous</button>
      <template slot="indicator"><button type="button"></button></template>
      <button slot="next" type="button">Next</button>
    `;
    element.pages = 3;
    element.current = 1;
    document.body.append(element);

    element.current = 2;

    const current = element.shadowRoot.querySelector('[aria-current="page"]');
    expect(current.dataset.page).to.equal("2");
    element.remove();
  });
});
