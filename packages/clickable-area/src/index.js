import { LitElement } from "lit";

export class MdbClickableArea extends LitElement {
  createRenderRoot() {
    return this;
  }
  constructor() {
    super();
    this.addEventListener("click", this._onClick.bind(this));
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this.hasAttribute("preserve-layout")) {
      // Apply the display: contents style via inline style because native CSS is not supported in plain custom elements
      this.style.display = "contents";
    } else {
      this.style.removeProperty("display");
    }

    this._syncCursor();
  }

  /**
   * Click handler that delegates clicks to the child element
   * with the data attribute [data-clickable-area-target], or
   * the only inner link when [auto-single-link] is enabled.
   * It ignores clicks inside that target element to preserve
   * native link behavior, and ignores clicks on other interactive
   * elements to avoid
   * interfering with other interactive children.
   *
   * @param {MouseEvent} event
   */
  _onClick(event) {
    const clickableTarget = this._getClickableTarget();

    if (!clickableTarget) {
      // No target with the attribute found, ignore click
      return;
    }

    for (const el of event.composedPath()) {
      if (!(el instanceof HTMLElement)) {
        continue;
      }
      if (el === clickableTarget) {
        return;
      }
      if (
        el.dataset.clickableArea === "skip" ||
        ((el.tagName === "A" || el.tagName === "BUTTON") &&
          el !== clickableTarget)
      ) {
        return;
      }
    }

    // Delegate the click event to the clickableTarget element
    clickableTarget.click();
  }

  _syncCursor() {
    if (this._getClickableTarget()) {
      this.style.cursor = "pointer";
      return;
    }

    this.style.removeProperty("cursor");
  }

  _getClickableTarget() {
    const explicitTarget = this.querySelector("[data-clickable-area=target]");
    if (explicitTarget instanceof HTMLElement) {
      return explicitTarget;
    }

    if (!this.hasAttribute("auto-single-link")) {
      return null;
    }

    const linkTargets = Array.from(
      this.querySelectorAll("a[href]:not([data-clickable-area='skip'])")
    );
    if (linkTargets.length !== 1) {
      return null;
    }

    const [singleLink] = linkTargets;
    const interactiveElements = Array.from(
      this.querySelectorAll(
        [
          "a[href]",
          "button:not([disabled])",
          "input:not([disabled]):not([type='hidden'])",
          "select:not([disabled])",
          "textarea:not([disabled])",
          "summary",
          "[role='button']",
          "[tabindex]:not([tabindex='-1'])",
        ].join(", ")
      )
    ).filter(
      (element) =>
        element instanceof HTMLElement &&
        element.dataset.clickableArea !== "skip"
    );
    const hasCompetingInteractiveElement = interactiveElements.some(
      (element) => element !== singleLink && !singleLink.contains(element)
    );

    if (hasCompetingInteractiveElement) {
      return null;
    }

    return singleLink;
  }
}

if (globalThis.customElements && !customElements.get("mdb-clickable-area")) {
  customElements.define("mdb-clickable-area", MdbClickableArea);
}
