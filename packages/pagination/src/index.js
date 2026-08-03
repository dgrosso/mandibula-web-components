import { LitElement } from "lit";

export class MdbPagination extends LitElement {
  createRenderRoot() {
    return this.shadowRoot;
  }
  static get observedAttributes() {
    return ["pages", "current", "circular"];
  }

  constructor() {
    super();
    this._pages = 0;
    this._current = 1;
    this._circular = false;
    this._onClick = this._onClick.bind(this);

    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <nav part="nav" role="navigation" aria-label="Pagination">
        <slot name="previous" part="previous"></slot>
        <div part="indicators" role="list"></div>
        <slot name="next" part="next"></slot>
      </nav>
    `;
    this._indicatorsContainer = shadow.querySelector('[part="indicators"]');
  }

  connectedCallback() {
    super.connectedCallback();
    this._upgradeProperty("pages");
    this._upgradeProperty("current");
    this._upgradeProperty("circular");
    this._renderIndicators();
    this._updateDisabled();

    this.addEventListener("click", this._onClick);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this._onClick);
    super.disconnectedCallback();
  }

  _onClick(event) {
    const control = this._getPaginationControl(event.target);

    if (control?.slot === "previous") {
      this._handlePrevious();
    } else if (control?.slot === "next") {
      this._handleNext();
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }

    if (name === "pages") {
      this._pages = parseInt(newValue, 10) || 0;
      this._renderIndicators();
    }
    if (name === "current") {
      this._current = parseInt(newValue, 10) || 1;
      this._updateIndicators();
    }
    if (name === "circular") {
      this._circular = newValue !== null;
    }

    this._updateDisabled();
  }

  get pages() {
    return this._pages;
  }
  set pages(value) {
    this.setAttribute("pages", value);
  }

  get current() {
    return this._current;
  }
  set current(value) {
    this.setAttribute("current", value);
  }

  get circular() {
    return this._circular;
  }
  set circular(value) {
    if (value) {
      this.setAttribute("circular", "");
    } else {
      this.removeAttribute("circular");
    }
  }

  _handlePrevious() {
    if (this._current > 1) {
      this._emit("previous");
    } else if (this._circular && this._pages > 0) {
      this._emit("goto", { page: this._pages });
    }
  }

  _handleNext() {
    if (this._current < this._pages) {
      this._emit("next");
    } else if (this._circular && this._pages > 0) {
      this._emit("goto", { page: 1 });
    }
  }

  _getPaginationControl(target) {
    if (!(target instanceof Element)) {
      return null;
    }

    const control = target.closest('[slot="previous"], [slot="next"]');

    return control?.parentElement === this ? control : null;
  }

  _emit(type, detail = {}) {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail,
        bubbles: true,
        composed: true,
      })
    );
  }

  _renderIndicators() {
    this._indicatorsContainer.innerHTML = "";

    const template = this.querySelector('template[slot="indicator"]');
    if (!template) {
      this._indicatorsContainer.hidden = true;
      this._indicatorsContainer.setAttribute("aria-hidden", "true");
      this._indicatorsContainer.removeAttribute("role");
      return;
    }

    this._indicatorsContainer.hidden = false;
    this._indicatorsContainer.removeAttribute("aria-hidden");
    this._indicatorsContainer.setAttribute("role", "group");

    for (let i = 1; i <= this._pages; i++) {
      const node = template.content.cloneNode(true);
      const el = node.firstElementChild;
      if (!el) {
        continue;
      }

      // Make sure indicator is accessible
      const tag = el.tagName.toLowerCase();
      if (tag !== "button" && tag !== "a") {
        el.setAttribute("role", "button");
        el.tabIndex = 0;
        el.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            this._emit("goto", { page: i });
          }
        });
      }

      el.dataset.paginationIndicator = "";
      el.dataset.page = i;
      el.setAttribute("part", "indicator"); // <-- expose indicator part

      if (!el.getAttribute("aria-label") && !el.textContent.trim()) {
        el.setAttribute("aria-label", `Go to page ${i}`);
      }

      if (i === this._current) {
        el.setAttribute("aria-current", "page");
        el.setAttribute("part", "indicator indicator-current");
      } else {
        el.removeAttribute("aria-current");
      }

      el.addEventListener("click", () => {
        this._emit("goto", { page: i });
      });

      this._indicatorsContainer.appendChild(el);
    }
  }

  _updateIndicators() {
    const previous = this._indicatorsContainer.querySelector(
      '[part~="indicator-current"]'
    );
    previous?.setAttribute("part", "indicator");
    previous?.removeAttribute("aria-current");

    const current = this._indicatorsContainer.children[this._current - 1];
    current?.setAttribute("part", "indicator indicator-current");
    current?.setAttribute("aria-current", "page");
  }

  _updateDisabled() {
    const prev = this.querySelector('[slot="previous"]');
    const next = this.querySelector('[slot="next"]');

    if (!this._circular) {
      if (prev) {
        prev.disabled = this._current <= 1;
      }
      if (next) {
        next.disabled = this._current >= this._pages;
      }
    } else {
      if (prev) {
        prev.disabled = false;
      }
      if (next) {
        next.disabled = false;
      }
    }
  }

  _upgradeProperty(prop) {
    if (Object.hasOwn(this, prop)) {
      const value = this[prop];
      delete this[prop];
      this[prop] = value;
    }
  }
}

if (globalThis.customElements && !customElements.get("mdb-pagination")) {
  customElements.define("mdb-pagination", MdbPagination);
}
