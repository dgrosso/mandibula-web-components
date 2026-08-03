import { LitElement, css, html } from "lit";

// <mdb-collapsible>
// Minimal collapsible element that animates height from 0 to the content's scrollHeight.
// It does NOT add any user event handlers; toggle it from JavaScript using the public
// methods: openCollapsible(), closeCollapsible(), toggleCollapsible(), or by setting the 'open' property/attribute.

export class MdbCollapsible extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .content {
      overflow: hidden; /* necessary */
      height: 0;
      transition: height var(--mdb-collapsible-animation-duration, 350ms) ease;
    }

    :host([open]) .content {
      /* height is controlled programmatically; this selector exists so CSS specificity
         knows when the element is intended to be open. */
    }
  `;

  static get properties() {
    return {
      open: { type: Boolean, reflect: true },
    };
  }

  constructor() {
    super();
    this.open = false;
    this._onTransitionEnd = this._onTransitionEnd.bind(this);
  }

  render() {
    return html`<div class="content" part="content"><slot></slot></div>`;
  }

  firstUpdated() {
    this._contentEl = this.shadowRoot.querySelector(".content");
    this._contentEl.addEventListener("transitionend", this._onTransitionEnd);

    if (this.open) {
      this._contentEl.style.height = "auto";
    } else {
      this._contentEl.style.height = "0";
    }
  }

  // Public API ---------------------------------------------------------------

  openCollapsible() {
    this.open = true;
  }

  closeCollapsible() {
    this.open = false;
  }

  toggleCollapsible() {
    this.open = !this.open;
  }

  updated(changedProps) {
    if (!this._contentEl) {
      return;
    }

    if (changedProps.has("open")) {
      if (this.open) {
        const height = this._contentEl.scrollHeight;
        const computed = getComputedStyle(this._contentEl).height;
        this._contentEl.style.height = computed;

        requestAnimationFrame(() => {
          this._contentEl.style.height = height + "px";
        });
      } else {
        const computed = getComputedStyle(this._contentEl).height;
        this._contentEl.style.height = computed;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this._contentEl.style.height = "0";
          });
        });
      }
    }
  }

  _onTransitionEnd(e) {
    if (e.target !== this._contentEl || e.propertyName !== "height") {
      return;
    }

    if (this.open) {
      this._contentEl.style.height = "auto";
    }
  }

  disconnectedCallback() {
    if (this._contentEl) {
      this._contentEl.removeEventListener(
        "transitionend",
        this._onTransitionEnd
      );
    }
    super.disconnectedCallback();
  }
}

if (globalThis.customElements && !customElements.get("mdb-collapsible")) {
  customElements.define("mdb-collapsible", MdbCollapsible);
}
