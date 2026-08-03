import { LitElement, css, html } from "lit";

export class MdbSpinner extends LitElement {
  static properties = {
    template: { type: String },
  };

  static styles = css`
    :host {
      display: inline-block;
      width: var(--mdb-spinner-size, 1.5rem);
      height: var(--mdb-spinner-size, 1.5rem);
      border: var(--mdb-spinner-border-width, 0.125rem) solid
        var(--mdb-spinner-bg, color-mix(in srgb, currentColor 10%, transparent));
      border-left-color: var(--mdb-spinner-color, currentColor);
      border-radius: 50%;
      animation: mdb-spinner-spin 1s linear infinite;
    }

    @keyframes mdb-spinner-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
      }
    }
  `;

  constructor() {
    super();
    this.template = "mdb-spinner-template";
  }

  render() {
    const customTemplate = document.getElementById(this.template);

    return customTemplate
      ? html`${customTemplate.content.cloneNode(true)}`
      : html``;
  }
}

if (globalThis.customElements && !customElements.get("mdb-spinner")) {
  customElements.define("mdb-spinner", MdbSpinner);
}
