// mdb-fader.js
// LitElement component that fades between its slotted children (no decorators)
// - No decorators used
// - Accessible (ARIA for carousel pattern)
// - Listens to a compatible control placed in a named slot="pagination"
// - Exposes imperative methods: next(), prev(), goTo(index)
// - Syncs with slotted controls exposing pages/current properties

import { LitElement, css, html } from "lit";

export class MdbFader extends LitElement {
  static get properties() {
    return {
      current: { type: Number, reflect: true },
      loop: { type: Boolean, reflect: true },
      duration: { type: Number, reflect: true },
      easing: { type: String, reflect: true },
      inDuration: { type: Number, reflect: true, attribute: "in-duration" },
      outDuration: { type: Number, reflect: true, attribute: "out-duration" },
      inEasing: { type: String, reflect: true, attribute: "in-easing" },
      outEasing: { type: String, reflect: true, attribute: "out-easing" },
      inTransform: { type: String, reflect: true, attribute: "in-transform" },
      outTransform: { type: String, reflect: true, attribute: "out-transform" },
      label: { type: String, reflect: true },
    };
  }

  constructor() {
    super();
    this.current = 0;
    this.loop = true;
    this.duration = 300;
    this.easing = "ease";
    this.inDuration = null;
    this.outDuration = null;
    this.inEasing = "";
    this.outEasing = "";
    this.inTransform = "";
    this.outTransform = "";
    this.label = "Carousel";

    this._items = [];
    this._lastIndex = -1;
    this._onKeydown = this._onKeydown.bind(this);
    this._onPaginationEvent = this._onPaginationEvent.bind(this);
    this._mutationObserver = null;
  }

  static get styles() {
    return css`
      :host {
        display: block;
        position: relative;
        --mdb-fader-duration: 300ms;
        --mdb-fader-easing: ease;
        --mdb-fader-in-duration: var(--mdb-fader-duration);
        --mdb-fader-out-duration: var(--mdb-fader-duration);
        --mdb-fader-in-easing: var(--mdb-fader-easing);
        --mdb-fader-out-easing: var(--mdb-fader-easing);
        --mdb-fader-in-visibility-delay: 0ms;
        --mdb-fader-out-visibility-delay: var(
          --mdb-fader-out-duration,
          var(--mdb-fader-duration)
        );
        --mdb-fader-in-transform: translate3d(0, 0, 0);
        --mdb-fader-out-transform: translate3d(0, 0, 0);
        --mdb-fader-bg: transparent;
        --mdb-fader-justify: normal;
        --mdb-fader-align: normal;
        background: var(--mdb-fader-bg);
      }

      .viewport {
        position: relative;
        display: grid;
        justify-items: var(--mdb-fader-justify);
        align-items: var(--mdb-fader-align);
      }

      ::slotted(:not([slot])) {
        grid-area: 1 / 1;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transform: var(--mdb-fader-out-transform);
        transition:
          opacity var(--mdb-fader-out-duration, var(--mdb-fader-duration))
            var(--mdb-fader-out-easing, var(--mdb-fader-easing)),
          visibility 0s linear
            var(
              --mdb-fader-out-visibility-delay,
              var(--mdb-fader-out-duration, var(--mdb-fader-duration))
            ),
          transform var(--mdb-fader-out-duration, var(--mdb-fader-duration))
            var(--mdb-fader-out-easing, var(--mdb-fader-easing));
      }

      ::slotted(.is-active) {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transform: var(--mdb-fader-in-transform);
        transition:
          opacity var(--mdb-fader-in-duration, var(--mdb-fader-duration))
            var(--mdb-fader-in-easing, var(--mdb-fader-easing)),
          visibility 0s linear var(--mdb-fader-in-visibility-delay, 0ms),
          transform var(--mdb-fader-in-duration, var(--mdb-fader-duration))
            var(--mdb-fader-in-easing, var(--mdb-fader-easing));
      }

      .pagination {
        display: contents;
      }

      @media (prefers-reduced-motion: reduce) {
        :host {
          --mdb-fader-duration: 1ms;
          --mdb-fader-in-duration: 1ms;
          --mdb-fader-out-duration: 1ms;
          --mdb-fader-out-visibility-delay: 1ms;
        }
      }
    `;
  }

  render() {
    return html`
      <div
        part="viewport"
        class="viewport"
        role="group"
        aria-roledescription="carousel"
        aria-label=${this.label}
        @keydown=${this._onKeydown}
        tabindex="0"
      >
        <slot @slotchange=${this._onSlotChange}></slot>
      </div>
      <div class="pagination">
        <slot
          name="pagination"
          @slotchange=${this._onPaginationSlotChange}
        ></slot>
      </div>
    `;
  }

  firstUpdated() {
    this.updateComplete.then(() => {
      this._updateDurationVars();
      this._updateEasingVars();
      this._updateTransformVars();
    });
  }

  updated(changed) {
    if (
      changed.has("duration") ||
      changed.has("inDuration") ||
      changed.has("outDuration")
    ) {
      this._updateDurationVars();
    }
    if (
      changed.has("easing") ||
      changed.has("inEasing") ||
      changed.has("outEasing")
    ) {
      this._updateEasingVars();
    }
    if (changed.has("inTransform") || changed.has("outTransform")) {
      this._updateTransformVars();
    }
    if (changed.has("current")) {
      this._applyActive();
      this._syncPaginationFromFader();
      this.dispatchEvent(
        new CustomEvent("change", {
          detail: { current: this.current, total: this._items.length },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  _updateDurationVars() {
    const baseDuration = Number.isFinite(this.duration) ? this.duration : 0;
    this.style.setProperty("--mdb-fader-duration", `${baseDuration}ms`);
    this._setOptionalDurationVar("--mdb-fader-in-duration", this.inDuration);
    this._setOptionalDurationVar("--mdb-fader-out-duration", this.outDuration);
  }

  _updateEasingVars() {
    const baseEasing = this.easing || "ease";
    this.style.setProperty("--mdb-fader-easing", baseEasing);
    this._setOptionalStringVar("--mdb-fader-in-easing", this.inEasing);
    this._setOptionalStringVar("--mdb-fader-out-easing", this.outEasing);
  }

  _setOptionalDurationVar(name, value) {
    if (Number.isFinite(value)) {
      this.style.setProperty(name, `${value}ms`);
    } else {
      this.style.removeProperty(name);
    }
  }

  _setOptionalStringVar(name, value) {
    if (value && String(value).trim()) {
      this.style.setProperty(name, value);
    } else {
      this.style.removeProperty(name);
    }
  }

  _updateTransformVars() {
    this._setOptionalStringVar("--mdb-fader-in-transform", this.inTransform);
    this._setOptionalStringVar("--mdb-fader-out-transform", this.outTransform);
  }

  next() {
    const n = this._items.length;
    if (!n) {
      return;
    }
    const last = n - 1;
    if (this.current < last) {
      this.current += 1;
    } else if (this.loop) {
      this.current = 0;
    }
  }

  prev() {
    const n = this._items.length;
    if (!n) {
      return;
    }
    if (this.current > 0) {
      this.current -= 1;
    } else if (this.loop) {
      this.current = n - 1;
    }
  }

  goTo(index) {
    const n = this._items.length;
    if (!n) {
      return;
    }
    const i = Math.max(0, Math.min(index, n - 1));
    this.current = i;
  }

  clear() {
    // this.shadowRoot.querySelector("slot").innerHTML = "";
  }

  _onSlotChange = () => {
    const slot = this.shadowRoot.querySelector("slot:not([name])");
    this._items = (slot?.assignedElements({ flatten: true }) || []).filter(
      (el) => el.slot !== "pagination"
    );

    this._items.forEach((el, i) => {
      el.classList.remove("is-active");
      el.setAttribute("aria-hidden", "true");
      el.setAttribute("role", "group");
      el.setAttribute("aria-roledescription", "slide");
      el.setAttribute("aria-label", `${i + 1} of ${this._items.length}`);
      const tabIndex = el.getAttribute("tabindex");
      if (tabIndex === null) {
        el.setAttribute("tabindex", "-1");
      }
      el.style.removeProperty("opacity");
      el.style.removeProperty("visibility");
      el.style.removeProperty("position");
    });

    if (this.current >= this._items.length) {
      this.current = Math.max(0, this._items.length - 1);
    }
    this._applyActive();
    this._syncPaginationFromFader();
  };

  _applyActive() {
    const n = this._items.length;
    if (!n) {
      return;
    }
    const i = Math.max(0, Math.min(this.current, n - 1));

    if (this._lastIndex >= 0 && this._lastIndex < n) {
      const prevEl = this._items[this._lastIndex];
      if (prevEl) {
        prevEl.classList.remove("is-active");
        prevEl.setAttribute("aria-hidden", "true");
        prevEl.removeAttribute("aria-current");
        prevEl.setAttribute("tabindex", "-1");
      }
    }

    const el = this._items[i];
    if (el) {
      el.classList.add("is-active");
      el.setAttribute("aria-hidden", "false");
      el.setAttribute("aria-current", "true");
      el.removeAttribute("tabindex");
      if (this._lastInteractionWasKeyboard) {
        requestAnimationFrame(() => el.focus({ preventScroll: true }));
      }
    }

    this._lastIndex = i;
  }

  _onKeydown(e) {
    this._lastInteractionWasKeyboard = true;
    switch (e.key) {
      case "ArrowRight":
      case "PageDown":
        e.preventDefault();
        this.next();
        break;
      case "ArrowLeft":
      case "PageUp":
        e.preventDefault();
        this.prev();
        break;
      case "Home":
        e.preventDefault();
        this.goTo(0);
        break;
      case "End":
        e.preventDefault();
        this.goTo(this._items.length - 1);
        break;
    }
    clearTimeout(this._kbdTO);
    this._kbdTO = setTimeout(
      () => (this._lastInteractionWasKeyboard = false),
      200
    );
  }

  _onPaginationSlotChange = () => {
    const slot = this.shadowRoot.querySelector('slot[name="pagination"]');
    const els = slot?.assignedElements({ flatten: true }) || [];

    if (this._paginationEls) {
      this._paginationEls.forEach((el) => {
        el.removeEventListener("previous", this._onPaginationEvent);
        el.removeEventListener("next", this._onPaginationEvent);
        el.removeEventListener("goto", this._onPaginationEvent);
      });
    }

    this._paginationEls = els;

    els.forEach((el) => {
      el.addEventListener("previous", this._onPaginationEvent);
      el.addEventListener("next", this._onPaginationEvent);
      el.addEventListener("goto", this._onPaginationEvent);
    });

    if (this._mutationObserver) {
      this._mutationObserver.disconnect();
      this._mutationObserver = null;
    }
    if (els.length) {
      this._mutationObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (
            m.type === "attributes" &&
            (m.attributeName === "current" || m.attributeName === "pages")
          ) {
            this._syncFaderFromPagination();
          }
        }
      });
      els.forEach((el) =>
        this._mutationObserver.observe(el, { attributes: true })
      );
      this._syncPaginationFromFader();
      this._syncFaderFromPagination();
    }
  };

  _onPaginationEvent(e) {
    if (e.type === "previous") {
      this.prev();
    } else if (e.type === "next") {
      this.next();
    } else if (e.type === "goto") {
      const d = e.detail || {};
      const page = Number(d.page) - 1;
      if (!Number.isNaN(page)) {
        this.goTo(page);
      }
    }
  }

  _syncPaginationFromFader() {
    if (!this._paginationEls || !this._paginationEls.length) {
      return;
    }
    const pages = String(this._items.length);
    const current1 = String(this.current + 1);
    this._paginationEls.forEach((el) => {
      if (el.getAttribute?.("pages") !== pages) {
        el.setAttribute("pages", pages);
      }
      if (el.getAttribute?.("current") !== current1) {
        el.setAttribute("current", current1);
      }
    });
  }

  _syncFaderFromPagination() {
    if (!this._paginationEls || !this._paginationEls.length) {
      return;
    }
    for (const el of this._paginationEls) {
      const curAttr = el.getAttribute?.("current");
      if (curAttr !== null) {
        const idx = Number(curAttr) - 1;
        if (!Number.isNaN(idx) && idx !== this.current) {
          this.goTo(idx);
        }
        return;
      }
    }
  }
}

if (globalThis.customElements && !customElements.get("mdb-fader")) {
  customElements.define("mdb-fader", MdbFader);
}
