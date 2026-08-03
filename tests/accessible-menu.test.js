import { expect, fixture, html } from "@open-wc/testing";
import "../packages/accessible-menu/src/index.js";

describe("mdb-accessible-menu", () => {
  it("synchronizes and toggles disclosure state", async () => {
    const element = await fixture(html`
      <mdb-accessible-menu toggle-selector="button">
        <ul>
          <li>
            <button aria-controls="submenu" aria-expanded="false">Menu</button>
            <div id="submenu"><a href="/one">One</a></div>
          </li>
        </ul>
      </mdb-accessible-menu>
    `);
    const button = element.querySelector("button");
    const submenu = element.querySelector("#submenu");

    expect(submenu.getAttribute("aria-hidden")).to.equal("true");
    button.click();
    expect(button.getAttribute("aria-expanded")).to.equal("true");
    expect(submenu.getAttribute("aria-hidden")).to.equal("false");
  });
});
