import { LitElement, css, html } from "lit";

/**
 * Usage notes:
 * - Preferred markup provides an explicit viewport wrapper with
 *   `[data-mdb-carousel-viewport]` whose first element child is the track
 *   (`[data-mdb-carousel-track]`).
 * - Legacy/content-first markup can point the viewport selector at a container
 *   like `.wp-block-query` and nest the track alongside headings, paragraphs,
 *   or other blocks.
 * - When the matched track is not the viewport's first element child, this
 *   component creates a temporary runtime viewport around the track. That keeps
 *   non-panel content outside the native scroll container without requiring
 *   saved block markup migrations.
 * - `--mdb-carousel-anchor` shifts the panel snap alignment point inside the
 *   viewport.
 * - `--mdb-carousel-padding-inline-start` and
 *   `--mdb-carousel-padding-inline-end` add inset padding to the resolved
 *   viewport (explicit or runtime) without requiring consumers to target the
 *   internal viewport element directly.
 */
const DEFAULT_VIEWPORT_SELECTOR =
  "[data-mdb-carousel-viewport], .wp-block-query";
const DEFAULT_TRACK_SELECTOR =
  "[data-mdb-carousel-track], .wp-block-post-template";
const DEFAULT_PANEL_LINK_SELECTOR = "[data-clickable-area='target'], a[href]";
const RUNTIME_VIEWPORT_ATTRIBUTE = "data-mdb-carousel-runtime-viewport";
const STATIC_PAGINATION_CONTROL_ATTRIBUTE = "data-mdb-carousel-static-control";
const VIEWPORT_CLASS_NAME = "mdb-carousel__viewport";
const TRACK_CLASS_NAME = "mdb-carousel__track";
const PANEL_CLASS_NAME = "mdb-carousel__panel";
const VIEWPORT_PADDING_INLINE_START_PROPERTY =
  "--mdb-carousel-padding-inline-start";
const VIEWPORT_PADDING_INLINE_END_PROPERTY =
  "--mdb-carousel-padding-inline-end";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export class MdbCarousel extends LitElement {
  static properties = {
    clickPanels: { type: Boolean, reflect: true, attribute: "click-panels" },
    panelLinkSelector: { type: String, attribute: "panel-link-selector" },
    trackSelector: { type: String, attribute: "track-selector" },
    viewportSelector: { type: String, attribute: "viewport-selector" },
  };

  static styles = css`
    :host {
      display: block;
      --mdb-carousel-anchor: 0px;
      --mdb-carousel-padding-inline-start: 0px;
      --mdb-carousel-padding-inline-end: 0px;
    }

    .pagination {
      display: block;
    }

    .pagination[hidden] {
      display: none;
    }

    ::slotted([slot="pagination"]) {
      display: block;
    }

    ::slotted([slot="pagination"][hidden]) {
      display: none;
    }
  `;

  constructor() {
    super();

    this.clickPanels = false;
    this.panelLinkSelector = DEFAULT_PANEL_LINK_SELECTOR;
    this.trackSelector = DEFAULT_TRACK_SELECTOR;
    this.viewportSelector = DEFAULT_VIEWPORT_SELECTOR;

    this._activeIndex = 0;
    this._panelClickHandlers = [];
    this._panelEls = [];
    this._prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    )?.matches;
    this._onPaginationEvent = this._onPaginationEvent.bind(this);
    this._onPaginationSlotChange = this._onPaginationSlotChange.bind(this);
    this._onDefaultSlotChange = this._onDefaultSlotChange.bind(this);
    this._onScroll = this._onScroll.bind(this);
    this._onScrollSnapChange = this._onScrollSnapChange.bind(this);
    this._syncFromVisiblePanels = this._syncFromVisiblePanels.bind(this);
  }

  firstUpdated() {
    this._syncPaginationElements();
    this._initializeCarousel();
  }

  updated(changedProperties) {
    if (
      changedProperties.has("clickPanels") ||
      changedProperties.has("panelLinkSelector") ||
      changedProperties.has("trackSelector") ||
      changedProperties.has("viewportSelector")
    ) {
      this._initializeCarousel();
    }
  }

  disconnectedCallback() {
    this._teardownCarousel();
    super.disconnectedCallback();
  }

  _onDefaultSlotChange() {
    this._syncPaginationElements();
    this._initializeCarousel();
  }

  _getPaginationElements() {
    return Array.from(this.querySelectorAll("mdb-pagination"));
  }

  _getSlottedPaginationElements() {
    const slot = this.shadowRoot.querySelector('slot[name="pagination"]');
    return slot?.assignedElements({ flatten: true }) || [];
  }

  _hasPersistentPaginationSlotContent(slottedElements = []) {
    return slottedElements.some(
      (element) =>
        element.hasAttribute?.(STATIC_PAGINATION_CONTROL_ATTRIBUTE) ||
        element.querySelector?.(`[${STATIC_PAGINATION_CONTROL_ATTRIBUTE}]`)
    );
  }

  _syncPaginationContainerVisibility(shouldHide = false) {
    const paginationElement = this.shadowRoot.querySelector(".pagination");
    if (!paginationElement) {
      return;
    }

    const slottedElements = this._getSlottedPaginationElements();
    const hasPersistentControls =
      this._hasPersistentPaginationSlotContent(slottedElements);

    paginationElement.hidden =
      slottedElements.length === 0 || (shouldHide && !hasPersistentControls);
  }

  _findCarouselElements() {
    const slot = this.shadowRoot.querySelector("slot:not([name])");
    const assignedElements = slot?.assignedElements({ flatten: true }) || [];

    for (const rootElement of assignedElements) {
      const viewportElement = rootElement.matches?.(this.viewportSelector)
        ? rootElement
        : rootElement.querySelector?.(this.viewportSelector);

      if (!viewportElement) {
        continue;
      }

      const trackElement = viewportElement.matches?.(this.trackSelector)
        ? viewportElement
        : viewportElement.querySelector?.(this.trackSelector);

      if (trackElement) {
        return { viewportElement, trackElement };
      }
    }

    return { viewportElement: null, trackElement: null };
  }

  _resolveViewportElement(viewportElement, trackElement) {
    if (!viewportElement || !trackElement) {
      return null;
    }

    if (viewportElement.firstElementChild === trackElement) {
      return viewportElement;
    }

    const existingRuntimeViewport = trackElement.parentElement;
    if (existingRuntimeViewport?.hasAttribute(RUNTIME_VIEWPORT_ATTRIBUTE)) {
      return existingRuntimeViewport;
    }

    const runtimeViewportElement = document.createElement("div");
    runtimeViewportElement.setAttribute(RUNTIME_VIEWPORT_ATTRIBUTE, "");
    trackElement.before(runtimeViewportElement);
    runtimeViewportElement.append(trackElement);

    return runtimeViewportElement;
  }

  _syncViewportStyles(viewportElement) {
    if (!viewportElement) {
      return;
    }

    if (this._viewportStyleSnapshot?.element !== viewportElement) {
      this._viewportStyleSnapshot = {
        element: viewportElement,
        boxSizing: viewportElement.style.boxSizing,
        paddingInlineStart: viewportElement.style.paddingInlineStart,
        paddingInlineEnd: viewportElement.style.paddingInlineEnd,
      };
    }

    viewportElement.style.boxSizing = "border-box";
    viewportElement.style.paddingInlineStart = `var(${VIEWPORT_PADDING_INLINE_START_PROPERTY})`;
    viewportElement.style.paddingInlineEnd = `var(${VIEWPORT_PADDING_INLINE_END_PROPERTY})`;
  }

  _initializeCarousel() {
    const { viewportElement, trackElement } = this._findCarouselElements();
    const scrollViewportElement = this._resolveViewportElement(
      viewportElement,
      trackElement
    );

    if (!scrollViewportElement || !trackElement) {
      this._teardownCarousel();
      return;
    }

    const isSameCarousel =
      this._viewportEl === scrollViewportElement &&
      this._trackEl === trackElement;

    if (!isSameCarousel) {
      this._teardownCarousel();

      this._viewportEl = scrollViewportElement;
      this._trackEl = trackElement;
      this._runtimeViewportEl = scrollViewportElement.hasAttribute(
        RUNTIME_VIEWPORT_ATTRIBUTE
      )
        ? scrollViewportElement
        : null;
      this._syncPaginationElements();
    }

    this._syncViewportStyles(scrollViewportElement);
    scrollViewportElement.classList.add(VIEWPORT_CLASS_NAME);
    trackElement.classList.add(TRACK_CLASS_NAME);
    this._syncPanelElements();
    this._syncClickablePanels();
    this._syncCarouselStateObservers();
    this._activeIndex = clamp(this._activeIndex, 0, this._getLastPanelIndex());
    this._updatePagination();
  }

  _syncPanelElements() {
    this._panelEls.forEach((element) => {
      element.classList.remove(PANEL_CLASS_NAME);
    });

    this._panelEls = this._trackEl ? Array.from(this._trackEl.children) : [];

    this._panelEls.forEach((element) => {
      element.classList.add(PANEL_CLASS_NAME);
      element.querySelectorAll("a, button, img").forEach((childElement) => {
        childElement.setAttribute("draggable", "false");
      });
    });
  }

  _syncClickablePanels() {
    if (!this._trackEl) {
      return;
    }

    if (this._panelClickHandlers.length) {
      this._panelClickHandlers.forEach(([element, handleClick]) => {
        element.removeEventListener("click", handleClick);
      });
      this._panelClickHandlers = [];
    }

    if (!this.clickPanels || !this.panelLinkSelector) {
      return;
    }

    this._panelClickHandlers = this._panelEls.map((element) => {
      const handleClick = (event) => {
        if (
          event.defaultPrevented ||
          event.target.closest(
            "a, button, input, label, select, summary, textarea"
          )
        ) {
          return;
        }

        const linkElement = element.querySelector(this.panelLinkSelector);
        if (linkElement instanceof HTMLElement) {
          linkElement.click();
        }
      };

      element.addEventListener("click", handleClick);
      return [element, handleClick];
    });
  }

  _syncCarouselStateObservers() {
    this._disconnectCarouselStateObservers();

    if (!this._viewportEl || !this._panelEls.length) {
      return;
    }

    if ("onscrollsnapchange" in HTMLElement.prototype) {
      this._viewportEl.addEventListener(
        "scrollsnapchange",
        this._onScrollSnapChange
      );
    } else if ("IntersectionObserver" in window) {
      this._intersectionObserver = new IntersectionObserver(
        this._syncFromVisiblePanels,
        {
          root: this._viewportEl,
          threshold: [0, 0.25, 0.5, 0.75, 1],
        }
      );
      this._panelEls.forEach((element) =>
        this._intersectionObserver.observe(element)
      );
    } else {
      this._viewportEl.addEventListener("scroll", this._onScroll, {
        passive: true,
      });
    }

    if ("ResizeObserver" in window) {
      this._resizeObserver = new ResizeObserver(() => {
        this._syncPanelElements();
        this._setActiveIndex(this._getClosestPanelIndex());
      });
      this._resizeObserver.observe(this._viewportEl);
      this._resizeObserver.observe(this._trackEl);
    }
  }

  _disconnectCarouselStateObservers() {
    if (this._intersectionObserver) {
      this._intersectionObserver.disconnect();
      this._intersectionObserver = null;
    }

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    if (this._viewportEl) {
      this._viewportEl.removeEventListener("scroll", this._onScroll);
      this._viewportEl.removeEventListener(
        "scrollsnapchange",
        this._onScrollSnapChange
      );
    }

    if (this._scrollSyncFrame) {
      cancelAnimationFrame(this._scrollSyncFrame);
      this._scrollSyncFrame = null;
    }
  }

  _teardownCarousel() {
    this._disconnectCarouselStateObservers();

    if (this._mutationObserver) {
      this._mutationObserver.disconnect();
      this._mutationObserver = null;
    }

    if (this._paginationEls) {
      this._paginationEls.forEach((element) => {
        element.removeEventListener("previous", this._onPaginationEvent);
        element.removeEventListener("next", this._onPaginationEvent);
        element.removeEventListener("goto", this._onPaginationEvent);
      });
      this._paginationEls = null;
    }

    if (this._panelClickHandlers.length) {
      this._panelClickHandlers.forEach(([element, handleClick]) => {
        element.removeEventListener("click", handleClick);
      });
      this._panelClickHandlers = [];
    }

    this._panelEls.forEach((element) => {
      element.classList.remove(PANEL_CLASS_NAME);
    });
    this._panelEls = [];

    this._trackEl?.classList.remove(TRACK_CLASS_NAME);
    this._viewportEl?.classList.remove(VIEWPORT_CLASS_NAME);

    if (this._viewportStyleSnapshot?.element) {
      const { element, boxSizing, paddingInlineStart, paddingInlineEnd } =
        this._viewportStyleSnapshot;
      element.style.boxSizing = boxSizing;
      element.style.paddingInlineStart = paddingInlineStart;
      element.style.paddingInlineEnd = paddingInlineEnd;
      this._viewportStyleSnapshot = null;
    }

    if (
      this._runtimeViewportEl &&
      this._trackEl?.parentElement === this._runtimeViewportEl
    ) {
      this._runtimeViewportEl.replaceWith(this._trackEl);
    }

    this._runtimeViewportEl = null;
    this._viewportEl = null;
    this._trackEl = null;
    this._activeIndex = 0;
  }

  _getLastPanelIndex() {
    return Math.max(0, this._panelEls.length - 1);
  }

  _setActiveIndex(index) {
    const nextIndex = clamp(index, 0, this._getLastPanelIndex());

    if (nextIndex === this._activeIndex) {
      this._updatePagination();
      return;
    }

    this._activeIndex = nextIndex;
    this._updatePagination();
  }

  _updatePagination() {
    const shouldHidePagination = this._panelEls.length <= 1;

    this._paginationEls?.forEach((element) => {
      element.hidden = shouldHidePagination;
    });

    this._syncPaginationContainerVisibility(shouldHidePagination);

    requestAnimationFrame(() => {
      this._syncPaginationFromCarousel();
    });
  }

  _scrollPanelIntoView(index) {
    const targetPanel = this._panelEls[index];

    if (!targetPanel) {
      return;
    }

    targetPanel.scrollIntoView({
      behavior: this._prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "start",
    });
    this._setActiveIndex(index);
  }

  prev() {
    if (this._activeIndex > 0) {
      this._scrollPanelIntoView(this._activeIndex - 1);
    }
  }

  next() {
    if (this._activeIndex < this._getLastPanelIndex()) {
      this._scrollPanelIntoView(this._activeIndex + 1);
    }
  }

  goTo(index) {
    const nextIndex = Number(index);
    if (!Number.isNaN(nextIndex)) {
      this._scrollPanelIntoView(nextIndex);
    }
  }

  _onPaginationEvent(event) {
    if (event.type === "previous") {
      this.prev();
    } else if (event.type === "next") {
      this.next();
    } else if (event.type === "goto") {
      const detail = event.detail || {};
      const page = Number(detail.page) - 1;
      if (!Number.isNaN(page)) {
        this.goTo(page);
      }
    }
  }

  _onPaginationSlotChange() {
    this._syncPaginationElements();
  }

  _syncPaginationElements() {
    const paginationElements = this._getPaginationElements();

    if (this._paginationEls) {
      this._paginationEls.forEach((element) => {
        element.removeEventListener("previous", this._onPaginationEvent);
        element.removeEventListener("next", this._onPaginationEvent);
        element.removeEventListener("goto", this._onPaginationEvent);
      });
    }

    this._paginationEls = paginationElements;

    paginationElements.forEach((element) => {
      element.addEventListener("previous", this._onPaginationEvent);
      element.addEventListener("next", this._onPaginationEvent);
      element.addEventListener("goto", this._onPaginationEvent);
    });

    if (this._mutationObserver) {
      this._mutationObserver.disconnect();
      this._mutationObserver = null;
    }

    if (paginationElements.length) {
      this._mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (
            mutation.type === "attributes" &&
            (mutation.attributeName === "current" ||
              mutation.attributeName === "pages")
          ) {
            this._syncCarouselFromPagination();
          }
        }
      });

      paginationElements.forEach((element) =>
        this._mutationObserver.observe(element, { attributes: true })
      );
      this._syncPaginationFromCarousel();
      this._syncCarouselFromPagination();
    }

    this._syncPaginationContainerVisibility();
  }

  _syncPaginationFromCarousel() {
    if (!this._paginationEls || !this._paginationEls.length) {
      return;
    }

    const pages = String(this._panelEls.length || 1);
    const currentPage = String(this._activeIndex + 1);
    this._paginationEls.forEach((element) => {
      if (element.getAttribute?.("pages") !== pages) {
        element.setAttribute("pages", pages);
      }
      if (element.getAttribute?.("current") !== currentPage) {
        element.setAttribute("current", currentPage);
      }
    });
  }

  _syncCarouselFromPagination() {
    if (!this._paginationEls || !this._paginationEls.length) {
      return;
    }

    for (const element of this._paginationEls) {
      const currentAttribute = element.getAttribute?.("current");
      if (currentAttribute !== null) {
        const index = Number(currentAttribute) - 1;
        if (!Number.isNaN(index) && index !== this._activeIndex) {
          this.goTo(index);
        }
        return;
      }
    }
  }

  _onScrollSnapChange(event) {
    const target = event.snapTargetInline || event.snapTargetBlock;
    const index = this._panelEls.indexOf(target);

    if (index >= 0) {
      this._setActiveIndex(index);
    }
  }

  _syncFromVisiblePanels(entries = []) {
    const visibleEntries = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    const target = visibleEntries[0]?.target;
    const index = this._panelEls.indexOf(target);

    if (index >= 0) {
      this._setActiveIndex(index);
    }
  }

  _onScroll() {
    if (this._scrollSyncFrame) {
      return;
    }

    this._scrollSyncFrame = requestAnimationFrame(() => {
      this._scrollSyncFrame = null;
      this._setActiveIndex(this._getClosestPanelIndex());
    });
  }

  _getClosestPanelIndex() {
    if (!this._viewportEl || !this._panelEls.length) {
      return 0;
    }

    const viewportRect = this._viewportEl.getBoundingClientRect();
    const viewportStart = viewportRect.left;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    this._panelEls.forEach((element, index) => {
      const distance = Math.abs(
        element.getBoundingClientRect().left - viewportStart
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  }

  render() {
    return html`
      <slot @slotchange=${this._onDefaultSlotChange}></slot>
      <div class="pagination" part="pagination">
        <slot
          name="pagination"
          @slotchange=${this._onPaginationSlotChange}
        ></slot>
      </div>
    `;
  }
}

if (globalThis.customElements && !customElements.get("mdb-carousel")) {
  customElements.define("mdb-carousel", MdbCarousel);
}
