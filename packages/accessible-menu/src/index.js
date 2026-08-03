import { LitElement } from "lit";

export class MdbAccessibleMenu extends LitElement {
  createRenderRoot() {
    return this;
  }
  constructor() {
    super();
    this._animationDuration = 500;
    this._animationTimers = new WeakMap();
    this._focusableSelector = [
      "a[href]",
      "area[href]",
      "button",
      "input",
      "select",
      "textarea",
      "iframe",
      "summary",
      "[tabindex]",
      "[contenteditable='true']",
    ].join(", ");
    this._onToggleClick = this._onToggleClick.bind(this);
    this._onKeydown = this._onKeydown.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    this._toggleSelector = this.getAttribute("toggle-selector");
    if (!this._toggleSelector) {
      console.warn(
        "[mdb-accessible-menu] Missing required attribute: toggle-selector"
      );
      this._buttons = [];
      return;
    }

    this._animationDuration = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
      ? 0
      : 500;

    if (this._buttons) {
      this._buttons.forEach((button) => {
        button.removeEventListener("click", this._onToggleClick);
      });
    }

    this._buttons = Array.from(this.querySelectorAll(this._toggleSelector));
    this.addEventListener("keydown", this._onKeydown);
    this._buttons.forEach((button) => {
      button.addEventListener("click", this._onToggleClick);
      this._syncSubmenuState(button);
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("keydown", this._onKeydown);
    if (this._buttons) {
      this._buttons.forEach((button) => {
        button.removeEventListener("click", this._onToggleClick);
        const submenu = this._getSubmenu(button);
        if (submenu) {
          this._clearAnimationTimeout(submenu);
        }
      });
    }
  }

  _onToggleClick(event) {
    const button = event.currentTarget;
    if (!(button instanceof HTMLElement)) {
      return;
    }

    const expanded = button.getAttribute("aria-expanded") === "true";
    const submenu = this._getSubmenu(button);
    if (!submenu) {
      return;
    }

    this._closeSiblingSubmenus(button);

    button.setAttribute("aria-expanded", String(!expanded));
    submenu.setAttribute("aria-hidden", String(expanded));

    if (expanded) {
      this._closeSubmenu(button, submenu);
    } else {
      this._setSubmenuTabbable(submenu, true);
      this._animateOpen(submenu);
    }
  }

  _onKeydown(event) {
    if (event.key !== "Escape") {
      return;
    }

    const button = this._buttons?.find((candidate) => {
      const submenu = this._getSubmenu(candidate);
      return (
        candidate.getAttribute("aria-expanded") === "true" &&
        submenu?.contains(event.target)
      );
    });
    const submenu = button ? this._getSubmenu(button) : null;

    if (button && submenu) {
      event.preventDefault();
      button.setAttribute("aria-expanded", "false");
      submenu.setAttribute("aria-hidden", "true");
      this._closeSubmenu(button, submenu);
      button.focus();
    }
  }

  _syncSubmenuState(button) {
    const submenu = this._getSubmenu(button);
    if (!submenu) {
      console.warn(
        "[mdb-accessible-menu] Toggle button is missing a valid aria-controls target",
        button
      );
      return;
    }

    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(expanded));
    submenu.setAttribute("aria-hidden", String(!expanded));
    submenu.setAttribute("data-accessible-menu", expanded ? "open" : "closed");
    this._setSubmenuTabbable(submenu, expanded);
  }

  _getSubmenu(button) {
    if (!(button instanceof HTMLElement)) {
      return null;
    }

    const submenuId = button.getAttribute("aria-controls");
    if (!submenuId) {
      return null;
    }

    return this.ownerDocument.getElementById(submenuId);
  }

  _closeSiblingSubmenus(activeButton) {
    const parentLi = activeButton.closest("li");
    const parentList = parentLi ? parentLi.parentElement : null;
    if (!parentList) {
      return;
    }

    const siblingButtons = Array.from(
      parentList.querySelectorAll(this._toggleSelector)
    ).filter((button) => {
      if (button === activeButton) {
        return false;
      }

      const buttonLi = button.closest("li");
      return buttonLi && buttonLi.parentElement === parentList;
    });

    siblingButtons.forEach((button) => {
      const submenu = this._getSubmenu(button);
      if (!submenu) {
        return;
      }

      button.setAttribute("aria-expanded", "false");
      submenu.setAttribute("aria-hidden", "true");
      this._closeSubmenu(button, submenu);
    });
  }

  _closeSubmenu(button, submenu) {
    this._setSubmenuTabbable(submenu, false);
    this._moveFocusToToggleIfNeeded(button, submenu);
    this._animateClose(submenu);
  }

  _moveFocusToToggleIfNeeded(button, submenu) {
    const activeElement = this.ownerDocument.activeElement;
    if (!(activeElement instanceof HTMLElement)) {
      return;
    }

    if (submenu.contains(activeElement)) {
      button.focus();
    }
  }

  _getFocusableElements(submenu) {
    return Array.from(submenu.querySelectorAll(this._focusableSelector)).filter(
      (element) =>
        element instanceof HTMLElement && !element.hasAttribute("disabled")
    );
  }

  _setSubmenuTabbable(submenu, isTabbable) {
    const focusableElements = this._getFocusableElements(submenu);

    focusableElements.forEach((element) => {
      if (isTabbable) {
        if (this._isInsideClosedNestedSubmenu(element, submenu)) {
          return;
        }

        const previousTabIndex = element.getAttribute(
          "data-accessible-menu-tabindex"
        );
        if (previousTabIndex === null) {
          return;
        }

        if (previousTabIndex === "") {
          element.removeAttribute("tabindex");
        } else {
          element.setAttribute("tabindex", previousTabIndex);
        }
        element.removeAttribute("data-accessible-menu-tabindex");
        return;
      }

      if (!element.hasAttribute("data-accessible-menu-tabindex")) {
        const existingTabIndex = element.getAttribute("tabindex");
        element.setAttribute(
          "data-accessible-menu-tabindex",
          existingTabIndex === null ? "" : existingTabIndex
        );
      }
      element.setAttribute("tabindex", "-1");
    });
  }

  _isInsideClosedNestedSubmenu(element, rootSubmenu) {
    let currentSubmenu = element.closest("[data-accessible-menu]");

    while (currentSubmenu && currentSubmenu !== rootSubmenu) {
      if (currentSubmenu.getAttribute("data-accessible-menu") !== "open") {
        return true;
      }

      currentSubmenu = currentSubmenu.parentElement
        ? currentSubmenu.parentElement.closest("[data-accessible-menu]")
        : null;
    }

    return false;
  }

  _clearAnimationTimeout(submenu) {
    const timeoutId = this._animationTimers.get(submenu);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this._animationTimers.delete(submenu);
    }
  }

  _animateOpen(submenu) {
    const state = submenu.getAttribute("data-accessible-menu");
    if (state === "open" || state === "opening") {
      return;
    }

    this._clearAnimationTimeout(submenu);

    submenu.style.display = "";
    const height = submenu.scrollHeight + "px";
    submenu.style.height = "0px";
    submenu.setAttribute("data-accessible-menu", "opening");
    requestAnimationFrame(() => {
      submenu.style.height = height;
    });

    if (this._animationDuration === 0) {
      submenu.setAttribute("data-accessible-menu", "open");
      submenu.style.height = "auto";
      return;
    }

    const timeoutId = setTimeout(() => {
      submenu.setAttribute("data-accessible-menu", "open");
      submenu.style.height = "auto";
      this._animationTimers.delete(submenu);
    }, this._animationDuration);
    this._animationTimers.set(submenu, timeoutId);
  }

  _animateClose(submenu) {
    const state = submenu.getAttribute("data-accessible-menu");
    if (state === "closed" || state === "closing") {
      return;
    }

    this._clearAnimationTimeout(submenu);

    submenu.style.display = "";
    const height = submenu.scrollHeight + "px";
    submenu.style.height = height;
    void submenu.offsetHeight;
    submenu.setAttribute("data-accessible-menu", "closing");
    requestAnimationFrame(() => {
      submenu.style.height = "0px";
    });

    if (this._animationDuration === 0) {
      submenu.style.display = "none";
      submenu.setAttribute("data-accessible-menu", "closed");
      return;
    }

    const timeoutId = setTimeout(() => {
      submenu.style.display = "none";
      submenu.setAttribute("data-accessible-menu", "closed");
      this._animationTimers.delete(submenu);
    }, this._animationDuration);
    this._animationTimers.set(submenu, timeoutId);
  }
}

if (globalThis.customElements && !customElements.get("mdb-accessible-menu")) {
  customElements.define("mdb-accessible-menu", MdbAccessibleMenu);
}
