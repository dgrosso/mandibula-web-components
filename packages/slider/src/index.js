import { LitElement, css, html } from "lit";

export class MdbSlider extends LitElement {
  static get properties() {
    return {
      current: { type: Number, reflect: true },
      loop: { type: Boolean, reflect: true },
      label: { type: String, reflect: true },
    };
  }

  constructor() {
    super();
    this.current = 0;
    this.loop = false;
    this.label = "Carousel";

    this._items = [];
    this._viewport = null;
    this._scrollTimer = null;
    this._resizeObserver = null;
    this._mutationObserver = null;
    this._paginationEls = [];
    this._skipNextProgrammaticScroll = false;
    this._lastInteractionWasKeyboard = false;

    this._onKeydown = this._onKeydown.bind(this);
    this._onPaginationEvent = this._onPaginationEvent.bind(this);
    this._onScroll = this._onScroll.bind(this);
    this._onScrollEnd = this._onScrollEnd.bind(this);
  }

  static get styles() {
    return css`
      :host {
        display: block;
        position: relative;
        --mdb-slider-slide-size: 100%;
        --mdb-slider-gap: 0px;
        --mdb-slider-snap-align: start;
      }

      .viewport {
        display: flex;
        width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        gap: var(--mdb-slider-gap);
        overscroll-behavior-x: contain;
        scroll-snap-type: x mandatory;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
      }

      .viewport::-webkit-scrollbar {
        display: none;
      }

      slot:not([name]) {
        display: contents;
      }

      ::slotted(:not([slot])) {
        flex: 0 0 var(--mdb-slider-slide-size);
        min-width: 0;
        scroll-snap-align: var(--mdb-slider-snap-align);
        scroll-snap-stop: always;
      }

      .pagination {
        display: contents;
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
        tabindex="0"
        @keydown=${this._onKeydown}
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
    this._viewport = this.renderRoot.querySelector(".viewport");
    this._viewport.addEventListener("scroll", this._onScroll, {
      passive: true,
    });

    if ("onscrollend" in this._viewport) {
      this._viewport.addEventListener("scrollend", this._onScrollEnd);
    }

    if (globalThis.ResizeObserver) {
      this._resizeObserver = new ResizeObserver(() => {
        this._scrollToCurrent("auto");
      });
      this._resizeObserver.observe(this._viewport);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    clearTimeout(this._scrollTimer);
    this._resizeObserver?.disconnect();
    this._mutationObserver?.disconnect();

    if (this._viewport) {
      this._viewport.removeEventListener("scroll", this._onScroll);
      this._viewport.removeEventListener("scrollend", this._onScrollEnd);
    }

    this._paginationEls.forEach((element) => {
      element.removeEventListener("previous", this._onPaginationEvent);
      element.removeEventListener("next", this._onPaginationEvent);
      element.removeEventListener("goto", this._onPaginationEvent);
    });
  }

  updated(changed) {
    if (!changed.has("current") || !this._items.length) {
      return;
    }

    const next = this._clampIndex(this.current);
    if (next !== this.current) {
      this.current = next;
      return;
    }

    if (this._skipNextProgrammaticScroll) {
      this._skipNextProgrammaticScroll = false;
    } else {
      this._scrollToCurrent(this._preferredBehavior());
    }

    this._applyCurrentState();
    this._syncPaginationFromSlider();
    this._emitChange();
  }

  next() {
    const count = this._items.length;
    if (!count) return;

    if (this.current < count - 1) {
      this.goTo(this.current + 1);
    } else if (this.loop) {
      this.goTo(0);
    }
  }

  prev() {
    const count = this._items.length;
    if (!count) return;

    if (this.current > 0) {
      this.goTo(this.current - 1);
    } else if (this.loop) {
      this.goTo(count - 1);
    }
  }

  goTo(index) {
    if (!this._items.length) return;
    this.current = this._clampIndex(index);
  }

  _clampIndex(index) {
    const last = Math.max(0, this._items.length - 1);
    const numeric = Number(index);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(Math.trunc(numeric), last));
  }

  _preferredBehavior() {
    const reduce = globalThis.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    return reduce ? "auto" : "smooth";
  }

  _onSlotChange = () => {
    const slot = this.renderRoot.querySelector("slot:not([name])");
    this._items = (slot?.assignedElements({ flatten: true }) || []).filter(
      (element) => element.slot !== "pagination"
    );

    this._items.forEach((element, index) => {
      element.setAttribute("role", "group");
      element.setAttribute("aria-roledescription", "slide");
      element.setAttribute(
        "aria-label",
        `${index + 1} of ${this._items.length}`
      );
      element.removeAttribute("aria-current");
    });

    const next = this._clampIndex(this.current);
    if (next !== this.current) {
      this.current = next;
      return;
    }

    this._applyCurrentState();
    this._syncPaginationFromSlider();

    requestAnimationFrame(() => this._scrollToCurrent("auto"));
  };

  _applyCurrentState() {
    this._items.forEach((element, index) => {
      if (index === this.current) {
        element.setAttribute("aria-current", "true");
      } else {
        element.removeAttribute("aria-current");
      }
    });
  }

  _scrollToCurrent(behavior = "auto") {
    if (!this._viewport || !this._items.length) return;

    const item = this._items[this._clampIndex(this.current)];
    if (!item) return;

    const viewportRect = this._viewport.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const left = this._viewport.scrollLeft + itemRect.left - viewportRect.left;

    this._viewport.scrollTo({ left, behavior });
  }

  _onScroll() {
    if ("onscrollend" in this._viewport) return;

    clearTimeout(this._scrollTimer);
    this._scrollTimer = setTimeout(() => {
      this._syncCurrentFromScroll();
    }, 100);
  }

  _onScrollEnd() {
    this._syncCurrentFromScroll();
  }

  _syncCurrentFromScroll() {
    if (!this._viewport || !this._items.length) return;

    const viewportRect = this._viewport.getBoundingClientRect();
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    this._items.forEach((item, index) => {
      const distance = Math.abs(
        item.getBoundingClientRect().left - viewportRect.left
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    if (nearestIndex === this.current) return;

    this._skipNextProgrammaticScroll = true;
    this.current = nearestIndex;
  }

  _onKeydown(event) {
    this._lastInteractionWasKeyboard = true;

    switch (event.key) {
      case "ArrowRight":
      case "PageDown":
        event.preventDefault();
        this.next();
        break;
      case "ArrowLeft":
      case "PageUp":
        event.preventDefault();
        this.prev();
        break;
      case "Home":
        event.preventDefault();
        this.goTo(0);
        break;
      case "End":
        event.preventDefault();
        this.goTo(this._items.length - 1);
        break;
    }

    clearTimeout(this._keyboardTimer);
    this._keyboardTimer = setTimeout(() => {
      this._lastInteractionWasKeyboard = false;
    }, 200);
  }

  _onPaginationSlotChange = () => {
    const slot = this.renderRoot.querySelector('slot[name="pagination"]');
    const elements = slot?.assignedElements({ flatten: true }) || [];

    this._paginationEls.forEach((element) => {
      element.removeEventListener("previous", this._onPaginationEvent);
      element.removeEventListener("next", this._onPaginationEvent);
      element.removeEventListener("goto", this._onPaginationEvent);
    });

    this._paginationEls = elements;

    elements.forEach((element) => {
      element.addEventListener("previous", this._onPaginationEvent);
      element.addEventListener("next", this._onPaginationEvent);
      element.addEventListener("goto", this._onPaginationEvent);
    });

    this._mutationObserver?.disconnect();
    this._mutationObserver = null;

    if (elements.length && globalThis.MutationObserver) {
      this._mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (
            mutation.type === "attributes" &&
            (mutation.attributeName === "current" ||
              mutation.attributeName === "pages")
          ) {
            this._syncSliderFromPagination();
          }
        }
      });

      elements.forEach((element) => {
        this._mutationObserver.observe(element, { attributes: true });
      });

      this._syncPaginationFromSlider();
      this._syncSliderFromPagination();
    }
  };

  _onPaginationEvent(event) {
    if (event.type === "previous") {
      this.prev();
    } else if (event.type === "next") {
      this.next();
    } else if (event.type === "goto") {
      const page = Number(event.detail?.page) - 1;
      if (!Number.isNaN(page)) {
        this.goTo(page);
      }
    }
  }

  _syncPaginationFromSlider() {
    if (!this._paginationEls.length) return;

    const pages = String(this._items.length);
    const current = String(this.current + 1);

    this._paginationEls.forEach((element) => {
      if (element.getAttribute?.("pages") !== pages) {
        element.setAttribute("pages", pages);
      }
      if (element.getAttribute?.("current") !== current) {
        element.setAttribute("current", current);
      }
    });
  }

  _syncSliderFromPagination() {
    for (const element of this._paginationEls) {
      const current = element.getAttribute?.("current");
      if (current === null) continue;

      const index = Number(current) - 1;
      if (!Number.isNaN(index) && index !== this.current) {
        this.goTo(index);
      }
      return;
    }
  }

  _emitChange() {
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: {
          current: this.current,
          total: this._items.length,
        },
        bubbles: true,
        composed: true,
      })
    );
  }
}

if (globalThis.customElements && !customElements.get("mdb-slider")) {
  customElements.define("mdb-slider", MdbSlider);
}
