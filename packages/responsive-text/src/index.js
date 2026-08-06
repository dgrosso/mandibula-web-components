import { LitElement, css, html } from "lit";

/**
 * Text that scales fluidly between a minimum and maximum font size.
 */
export class MdbResponsiveText extends LitElement {
  static properties = {
    minSize: { type: String, reflect: true, attribute: "min-size" },
    fluidSize: { type: String, reflect: true, attribute: "fluid-size" },
    maxSize: { type: String, reflect: true, attribute: "max-size" },
    lineHeight: { type: String, reflect: true, attribute: "line-height" },
  };

  static styles = css`
    :host {
      --mdb-responsive-text-min-size: 1rem;
      --mdb-responsive-text-fluid-size: 5vw;
      --mdb-responsive-text-max-size: 3rem;
      --mdb-responsive-text-line-height: 1.2;
      display: inline;
      font-size: clamp(
        var(--mdb-responsive-text-min-size),
        var(--mdb-responsive-text-fluid-size),
        var(--mdb-responsive-text-max-size)
      );
      line-height: var(--mdb-responsive-text-line-height);
    }
  `;

  constructor() {
    super();
    this.minSize = "1rem";
    this.fluidSize = "5vw";
    this.maxSize = "3rem";
    this.lineHeight = "1.2";
  }

  updated(changed) {
    if (changed.has("minSize")) {
      this._setStyleVariable(
        "--mdb-responsive-text-min-size",
        this.minSize,
        "1rem"
      );
    }
    if (changed.has("fluidSize")) {
      this._setStyleVariable(
        "--mdb-responsive-text-fluid-size",
        this.fluidSize,
        "5vw"
      );
    }
    if (changed.has("maxSize")) {
      this._setStyleVariable(
        "--mdb-responsive-text-max-size",
        this.maxSize,
        "3rem"
      );
    }
    if (changed.has("lineHeight")) {
      this._setStyleVariable(
        "--mdb-responsive-text-line-height",
        this.lineHeight,
        "1.2"
      );
    }
  }

  _setStyleVariable(name, value, fallback) {
    this.style.setProperty(name, value || fallback);
  }

  render() {
    return html`<slot></slot>`;
  }
}

if (globalThis.customElements && !customElements.get("mdb-responsive-text")) {
  customElements.define("mdb-responsive-text", MdbResponsiveText);
}
