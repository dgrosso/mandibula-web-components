import { LitElement, html, css } from "lit";
import "@mandibula/spinner";

export class MdbSuspense extends LitElement {
  static properties = {
    debug: { type: Boolean, reflect: true },
    _state: { state: true },
    _loaderVisible: { state: true },
  };

  constructor() {
    super();
    this._state = "idle"; // idle | loading | success | error
    this._loaderVisible = false;
    this._loaderTimeout = null;
    this._target = null;
    this._resolveLoad = null;
    this._rejectLoad = null;
  }

  static styles = css`
    :host {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
    }

    ::slotted(*) {
      width: 100%;
      height: 100%;
      display: block;
    }

    .overlay {
      position: absolute;
      inset: 0;
      display: none;
      place-content: center;
      background: inherit;
      z-index: 1;
      pointer-events: none;
    }

    .overlay[active] {
      display: grid;
    }

    ::slotted([slot="loader"]),
    ::slotted([slot="fallback"]) {
      width: 100%;
      height: 100%;
      display: grid;
      place-content: center;
    }

    .fallback .default-error {
      font-size: 0.85em;
      color: var(--mdb-media-slot-error-color, #900);
      text-align: center;
    }

    .debug-panel {
      position: absolute;
      bottom: 0;
      left: 0;
      font-family: monospace;
      font-size: 10px;
      background: var(--mdb-media-slot-debug-bg, rgba(255, 255, 255, 0.9));
      color: var(--mdb-media-slot-debug-color, #000);
      padding: 2px 4px;
      z-index: 10;
      pointer-events: none;
      white-space: pre;
      border-top-right-radius: 4px;
      display: none;
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    :host([debug]) .debug-panel {
      display: block;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    if (window.__MDB_DEBUG__ && !this.hasAttribute("debug")) {
      this.setAttribute("debug", "");
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._reset();
  }

  /**
   * Manually set which target we are observing (for debug + waitForLoad resolution).
   */
  watch(target) {
    this._target = target;
  }

  /**
   * Manually drive state changes from host logic.
   */
  setLoading(target = this._target) {
    this._target = target;
    this._setState("loading");
    this._loaderVisible = false;
    clearTimeout(this._loaderTimeout);
    this._loaderTimeout = setTimeout(() => {
      if (this._state === "loading") {
        this._loaderVisible = true;
        this.requestUpdate();
      }
    }, 500);
    this._dispatch("loadstart", { target: this._target });
  }

  setSuccess(target = this._target) {
    if (!target) return;
    this._target = target;
    clearTimeout(this._loaderTimeout);
    this._loaderVisible = false;
    this._setState("success");
    this._dispatch("loadsuccess", { target: this._target });
    if (this._resolveLoad) this._resolveLoad(this._target);
    this._resolveLoad = this._rejectLoad = null;
  }

  setError(error = new Error("Media failed to load"), target = this._target) {
    if (!target) return;
    this._target = target;
    clearTimeout(this._loaderTimeout);
    this._loaderVisible = false;
    this._setState("error");
    this._dispatch("loaderror", { target: this._target, error });
    if (this._rejectLoad) this._rejectLoad(error);
    this._resolveLoad = this._rejectLoad = null;
  }

  waitForLoad() {
    return new Promise((resolve, reject) => {
      if (this._state === "success") {
        resolve(this._target);
        return;
      }
      if (this._state === "error") {
        reject(new Error("Media failed to load"));
        return;
      }
      this._resolveLoad = resolve;
      this._rejectLoad = reject;
    });
  }

  render() {
    const showFallback = this._state === "error";
    return html`
      <slot></slot>
      <div
        class="overlay loader"
        role="status"
        aria-live="polite"
        ?active=${this._loaderVisible}
      >
        <slot name="loader">
          <mdb-spinner aria-hidden="true"></mdb-spinner>
          <span class="visually-hidden">Loading</span>
        </slot>
      </div>
      <div class="overlay fallback" role="alert" ?active=${showFallback}>
        <slot name="fallback">
          <div class="default-error">⚠️ Media failed to load</div>
        </slot>
      </div>
      <div class="debug-panel">${this._debugText()}</div>
    `;
  }

  _reset() {
    clearTimeout(this._loaderTimeout);
    this._loaderTimeout = null;
    this._resolveLoad = null;
    this._rejectLoad = null;
    this._loaderVisible = false;
    this._target = null;
    this._setState("idle");
  }

  _setState(state) {
    this._state = state;
    this.requestUpdate();
  }

  _dispatch(name, detail = {}) {
    this.dispatchEvent(
      new CustomEvent(name, {
        detail,
        bubbles: true,
        composed: true,
      })
    );
  }

  _debugText() {
    if (!this.debug) return "";
    const target = this._target;
    const src =
      target?.getAttribute?.("src") ||
      target?.getAttribute?.("srcset") ||
      "n/a";
    return (
      `mdb-suspense (debug)\n` +
      `state: ${this._state}\n` +
      `target: ${target ? target.tagName.toLowerCase() : "none"}\n` +
      `src: ${src}`
    );
  }
}

if (globalThis.customElements && !customElements.get("mdb-suspense")) {
  customElements.define("mdb-suspense", MdbSuspense);
}
