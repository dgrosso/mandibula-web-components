import { LitElement, css, html } from "lit";

export class MdbResponsiveText extends LitElement {
  static properties = {
    scaling: { type: String, reflect: true },
  };

  constructor() {
    super();
    this.scaling = "transform";
    this.resizeObserver = new ResizeObserver(() => this.scaleText());
  }

  static styles = css`
    :host {
      display: block;
      overflow: hidden;
    }

    .text {
      display: inline-block;
      transform-origin: left top;
      will-change: transform;
      opacity: 0;
      transition: opacity 350ms ease-in;
    }

    .text.visible {
      opacity: 1;
    }
  `;

  render() {
    return html` <span class="text" part="text"><slot></slot></span> `;
  }

  firstUpdated() {
    this.container = this;
    this.textEl = this.renderRoot.querySelector(".text");
    this.resizeObserver.observe(this.container);
    this.scaleText();
  }

  disconnectedCallback() {
    this.resizeObserver.disconnect();
    super.disconnectedCallback();
  }

  updated(changed) {
    if (changed.has("scaling")) {
      this.scaleText();
    }
  }

  scaleText() {
    if (!this.container || !this.textEl) {
      return;
    }

    this.textEl.classList.remove("visible");
    this.textEl.style.transform = "";
    this.textEl.style.fontSize = "";

    requestAnimationFrame(() => {
      const containerRect = this.container.getBoundingClientRect();
      const textRect = this.textEl.getBoundingClientRect();

      if (
        !containerRect.width ||
        !containerRect.height ||
        !textRect.width ||
        !textRect.height
      ) {
        return;
      }

      if (this.scaling === "font-size") {
        const computed = window.getComputedStyle(this.textEl);
        const baseFontSize = parseFloat(computed.fontSize) || 16;
        const scaleX = containerRect.width / textRect.width;
        const scaleY = containerRect.height / textRect.height;
        const scale = Math.min(scaleX, scaleY, 1);
        this.textEl.style.fontSize = `${baseFontSize * scale}px`;
      } else {
        const scaleX = containerRect.width / textRect.width;
        const scaleY = containerRect.height / textRect.height;
        const scale = Math.min(scaleX, scaleY, 1);
        this.textEl.style.transform = `scale(${scale})`;
      }

      this.textEl.classList.add("visible");
    });
  }
}

if (globalThis.customElements && !customElements.get("mdb-responsive-text")) {
  customElements.define("mdb-responsive-text", MdbResponsiveText);
}
