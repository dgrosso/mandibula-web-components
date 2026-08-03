import { LitElement, html } from "lit";

const booleanStringConverter = {
  fromAttribute: (value) => value !== null && value !== "false",
  toAttribute: (value) => String(Boolean(value)),
};

/* -------------------- GLOBAL MODAL CONTAINER -------------------- */
export class MdbModalContainer extends LitElement {
  constructor() {
    super();
    this._activeModal = null;
  }

  createRenderRoot() {
    return this;
  }

  open(modal) {
    if (modal._closeTimer) {
      clearTimeout(modal._closeTimer);
      modal._closeTimer = null;
    }
    // Close any existing modal
    if (this._activeModal && this._activeModal !== modal) {
      this._activeModal.close();
    }
    this._activeModal = modal;

    if (!this.contains(modal._contentWrapper)) {
      this.appendChild(modal._contentWrapper);
    }

    this.contentEl = modal._contentWrapper.querySelector(".mdb-modal__content");

    modal._contentWrapper.classList.remove("mdb-modal--closing");
    modal._contentWrapper.classList.add("mdb-modal--open");

    // Focus trap
    modal._contentWrapper.focus();
    this._trapFocus(modal);

    // Click outside to close
    if (modal.closeOnOutsideClick) {
      modal._outsideClickHandler = (e) => {
        if (e.target === modal._contentWrapper) {
          modal.close();
        }
      };
      modal._contentWrapper.addEventListener(
        "mousedown",
        modal._outsideClickHandler
      );
    }

    document.body.style.overflow = "hidden";

    modal._stopListeningKeyboard = this._listenKeyboard(modal);

    modal.dispatchEvent(
      new CustomEvent("mdb-modal-opened", {
        bubbles: true,
        composed: true,
        detail: { modalContainer: this },
      })
    );
  }

  close(modal) {
    if (!this._activeModal || this._activeModal !== modal) {
      return;
    }

    modal._contentWrapper.classList.remove("mdb-modal--open");
    modal._contentWrapper.classList.add("mdb-modal--closing");

    document.body.style.overflow = "";

    const removeWrapper = () => {
      if (modal.removeOnClose && modal._contentWrapper.parentNode) {
        modal._contentWrapper.parentNode.removeChild(modal._contentWrapper);
      }

      // Remove click outside handler
      if (modal._outsideClickHandler) {
        modal._contentWrapper.removeEventListener(
          "mousedown",
          modal._outsideClickHandler
        );
        modal._outsideClickHandler = null;
      }

      // Remove focus trap
      if (modal._removeFocusTrap) {
        modal._removeFocusTrap();
      }

      modal._stopListeningKeyboard();

      if (this._activeModal === modal) {
        this._activeModal = null;
      }

      modal.dispatchEvent(
        new CustomEvent("mdb-modal-closed", {
          bubbles: true,
          composed: true,
        })
      );
    };

    modal._closeTimer = setTimeout(removeWrapper, 500);
  }

  _listenKeyboard(modal) {
    const handler = (e) => {
      if (e.key === "Escape") {
        modal.close();
      }
    };

    modal._contentWrapper.addEventListener("keydown", handler);

    return () => modal._contentWrapper.removeEventListener("keydown", handler);
  }

  _trapFocus(modal) {
    const wrapper = modal._contentWrapper;
    const focusableSelectors =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableEls = wrapper.querySelectorAll(focusableSelectors);
    if (!focusableEls.length) {
      return;
    }

    const firstEl = focusableEls[0];
    const lastEl = focusableEls[focusableEls.length - 1];

    const keyHandler = (e) => {
      if (e.key === "Tab") {
        if (e.shiftKey) {
          // shift+tab
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    wrapper.addEventListener("keydown", keyHandler);
    modal._removeFocusTrap = () =>
      wrapper.removeEventListener("keydown", keyHandler);
  }
}

if (globalThis.customElements && !customElements.get("mdb-modal-container")) {
  customElements.define("mdb-modal-container", MdbModalContainer);
  if (globalThis.document?.body) {
    const container = document.createElement("mdb-modal-container");
    document.body.appendChild(container);
  }
}

/* -------------------- MDB MODAL COMPONENT -------------------- */
export class MdbModal extends LitElement {
  static properties = {
    open: { type: Boolean, reflect: true },
    contentClass: { type: String, attribute: "content-class" },
    closeLabel: { type: String, attribute: "close-label" },
    label: { type: String },
    removeOnClose: {
      converter: booleanStringConverter,
      attribute: "remove-on-close",
    },
    closeOnOutsideClick: {
      converter: booleanStringConverter,
      attribute: "close-on-outside-click",
    },
  };

  constructor() {
    super();
    this.open = false;
    this.label = "Dialog";
    this.closeLabel = "Close";
    this.removeOnClose = true;
    this.closeOnOutsideClick = true;
    this._triggerElement = null;

    this._contentWrapper = document.createElement("div");
    this._contentWrapper.className = "mdb-modal";
    this._contentWrapper.setAttribute("role", "dialog");
    this._contentWrapper.setAttribute("aria-modal", "true");
    this._contentWrapper.setAttribute("tabindex", "-1");

    this._contentSlot = document.createElement("div");
    this._contentSlot.classList.add("mdb-modal__content");
    this._closeButton = document.createElement("button");
    this._closeButton.type = "button";
    this._closeButton.classList.add("mdb-modal__close-button");
    this._closeButton.addEventListener("click", () => this.close());
    this._contentSlot.append(this._closeButton);
    this._contentWrapper.append(this._contentSlot);
  }

  connectedCallback() {
    super.connectedCallback();

    if (this.contentClass) {
      this._contentSlot.classList.add(this.contentClass);
    }

    if (this.closeLabel) {
      this._closeButton.textContent = this.closeLabel;
    }

    this._contentWrapper.setAttribute("aria-label", this.label);
  }

  createRenderRoot() {
    return this;
  }

  render() {
    return html``;
  }

  async updated(changed) {
    if (changed.has("label")) {
      this._contentWrapper.setAttribute("aria-label", this.label || "Dialog");
    }

    if (!changed.has("open")) {
      return;
    }

    // wait for container
    let container = document.querySelector("mdb-modal-container");
    if (!container) {
      await new Promise((resolve) => {
        const obs = new MutationObserver(() => {
          container = document.querySelector("mdb-modal-container");
          if (container) {
            obs.disconnect();
            resolve();
          }
        });
        obs.observe(document.body, { childList: true });
      });
    }

    if (this.open) {
      this._triggerElement = document.activeElement;
      while (this.firstChild) {
        this._contentSlot.appendChild(this.firstChild);
      }
      container.open(this);
    } else {
      container.close(this);
      if (this._triggerElement) {
        this._triggerElement.focus();
        this._triggerElement = null;
      }
    }
  }

  close() {
    this.open = false;
  }
}

if (globalThis.customElements && !customElements.get("mdb-modal")) {
  customElements.define("mdb-modal", MdbModal);
}
