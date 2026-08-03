import { LitElement, css, html } from "lit";

export class MdbCounter extends LitElement {
  static properties = {
    value: { type: Number }, // target value
    start: { type: Number }, // optional initial value
    duration: { type: Number }, // ms
    locale: { type: String }, // locale
  };

  constructor() {
    super();
    this.value = 0;
    this.start = 0;
    this.duration = 1200;
    this._hasAnimated = false;
    this._observer = null;
    this._currentValue = this.start;
  }

  static styles = css`
    :host {
      display: inline-block;
      font-variant-numeric: tabular-nums;
    }
  `;

  firstUpdated() {
    this._createObserver();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._observer) {
      this._observer.disconnect();
    }
  }

  _createObserver() {
    this._observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !this._hasAnimated) {
            this._hasAnimated = true;
            this._animate();
            this._observer.unobserve(this);
          }
        });
      },
      { threshold: 0.2 }
    );

    this._observer.observe(this);
  }

  _easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  _animate() {
    const start = this.start;
    const end = this.value;
    const duration = this.duration;

    if (
      duration <= 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      this._currentValue = end;
      this.requestUpdate();
      return;
    }

    const startTime = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = this._easeOut(progress);
      const newValue = Math.floor(start + (end - start) * eased);

      this._currentValue = newValue;
      this.requestUpdate();

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }

  render() {
    return html`${this._currentValue.toLocaleString(this.locale)}`;
  }
}

if (globalThis.customElements && !customElements.get("mdb-counter")) {
  customElements.define("mdb-counter", MdbCounter);
}
