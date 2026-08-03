import { LitElement } from "lit";

export class MdbPointer extends LitElement {
  createRenderRoot() {
    return this.shadowRoot;
  }
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    // Create a container to hold the pointer content
    this.container = document.createElement("div");
    this.container.style.position = "fixed";
    this.container.style.pointerEvents = "none";
    this.container.style.zIndex = "9999";
    this.container.style.display = "none";

    this.shadowRoot.append(this.container);

    // Bind methods
    this._onMove = this._onMove.bind(this);
    this._onEnter = this._onEnter.bind(this);
    this._onLeave = this._onLeave.bind(this);

    // Will be enabled only if a fine pointer (e.g., mouse) is detected
    this.enabled = false;
  }

  connectedCallback() {
    super.connectedCallback();
    // Check for fine pointer support (mouse, not touch or pen)
    const hasMouse = matchMedia("(pointer: fine)").matches;
    const prefersReducedMotion = matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (!hasMouse || prefersReducedMotion) {
      return;
    }

    this.enabled = true;

    // Attach global event listeners
    document.addEventListener("pointermove", this._onMove);
    document.addEventListener("pointerover", this._onEnter);
    document.addEventListener("pointerout", this._onLeave);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (!this.enabled) {
      return;
    }

    // Clean up listeners
    document.removeEventListener("pointermove", this._onMove);
    document.removeEventListener("pointerover", this._onEnter);
    document.removeEventListener("pointerout", this._onLeave);
  }

  _onMove(e) {
    if (!this.enabled || e.pointerType !== "mouse") {
      return;
    }

    // Move the pointer container to the current cursor position
    this.container.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  }

  _onEnter(e) {
    if (!this.enabled || e.pointerType !== "mouse") {
      return;
    }

    const target = e.target.closest("[data-pointer]");
    if (!target) {
      return;
    }

    const [type, value] = target.dataset.pointer.split(":");
    const template = document.getElementById(`mdb-pointer-${type}`);
    if (!template) {
      return;
    }

    // Clear previous content and clone template
    this.container.innerHTML = "";
    const clone = template.content.cloneNode(true);

    // If there's an element with part text inside the template, populate it
    const textEl = clone.querySelector("[part=text]");
    if (textEl) {
      textEl.textContent = value;
    }

    // Insert the new content
    this.container.appendChild(clone);
    this.container.style.display = "block";
  }

  _onLeave(e) {
    if (!this.enabled || e.pointerType !== "mouse") {
      return;
    }

    const related = e.relatedTarget;
    // Only hide if the related target doesn't also have a data-pointer
    if (!related || !related.closest("[data-pointer]")) {
      this.container.style.display = "none";
    }
  }
}

if (globalThis.customElements && !customElements.get("mdb-pointer")) {
  customElements.define("mdb-pointer", MdbPointer);
}
