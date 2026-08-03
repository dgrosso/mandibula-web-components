import { LitElement, css, html } from "lit";
import "@mandibula/modal";

export class MdbDocumentPreviewButton extends LitElement {
  static properties = {
    closeLabel: { type: String, attribute: "close-label" },
    documentLabel: { type: String, attribute: "document-label" },
    downloadLabel: { type: String, attribute: "download-label" },
    downloadUrl: { type: String, attribute: "download-url" },
    embedSrc: { type: String, attribute: "embed-src" },
    embedSandbox: { type: String, attribute: "embed-sandbox" },
    excerpt: { type: String },
    heading: { type: String },
    previewLabel: { type: String, attribute: "preview-label" },
  };

  constructor() {
    super();
    this.closeLabel = "Close preview";
    this.documentLabel = "";
    this.downloadLabel = "Download";
    this.downloadUrl = "";
    this.embedSrc = "";
    this.embedSandbox = "allow-downloads allow-same-origin allow-scripts";
    this.excerpt = "";
    this.heading = "";
    this.previewLabel = "Preview document";
    this._handleTriggerClick = this._handleTriggerClick.bind(this);
  }

  static styles = css`
    :host {
      display: block;
    }
  `;

  render() {
    return html`
      <slot name="trigger" @slotchange=${this._bindTrigger}></slot>
      <mdb-modal
        id="mdb-document-preview-modal"
        content-class="mdb-document-preview"
        close-label=${this.closeLabel}
        label=${this.heading || this.previewLabel}
      ></mdb-modal>
    `;
  }

  firstUpdated() {
    this.modal = this.renderRoot.querySelector("#mdb-document-preview-modal");
    if (this.modal) {
      this.modal.addEventListener("mdb-modal-opened", (event) => {
        const { modalContainer } = event.detail;

        requestAnimationFrame(() => {
          modalContainer.contentEl.appendChild(this._getModalContent());
        });
      });
    }

    this._bindTrigger();
  }

  disconnectedCallback() {
    this._unbindTrigger();
    super.disconnectedCallback();
  }
  _bindTrigger() {
    this._unbindTrigger();

    const trigger = this.querySelector('[slot="trigger"]');
    if (!(trigger instanceof HTMLElement)) {
      return;
    }

    trigger.addEventListener("click", this._handleTriggerClick);
    this._trigger = trigger;
  }

  _unbindTrigger() {
    if (!(this._trigger instanceof HTMLElement)) {
      return;
    }

    this._trigger.removeEventListener("click", this._handleTriggerClick);
    this._trigger = null;
  }

  _handleTriggerClick(event) {
    event.preventDefault();
    this._openModal();
  }

  _openModal() {
    if (!this.modal) {
      return;
    }

    this.modal.open = true;
  }

  _getModalContent() {
    if (this._contentEl) {
      return this._contentEl;
    }

    const wrapperEl = document.createElement("section");
    wrapperEl.className = "mdb-document-preview__inner";

    const contentEl = document.createElement("div");
    contentEl.className = "mdb-document-preview__content";
    wrapperEl.appendChild(contentEl);

    if (this.documentLabel) {
      const badgeEl = document.createElement("p");
      badgeEl.className = "mdb-document-preview__badge";
      badgeEl.textContent = this.documentLabel;
      contentEl.appendChild(badgeEl);
    }

    if (this.heading) {
      const headingEl = document.createElement("h2");
      headingEl.className = "mdb-document-preview__title";
      headingEl.textContent = this.heading;
      contentEl.appendChild(headingEl);
    }

    if (this.excerpt) {
      const excerptEl = document.createElement("p");
      excerptEl.className = "mdb-document-preview__excerpt";
      excerptEl.textContent = this.excerpt;
      contentEl.appendChild(excerptEl);
    }

    if (this.downloadUrl) {
      const actionsEl = document.createElement("div");
      actionsEl.className = "mdb-document-preview__actions";

      const buttonWrapEl = document.createElement("div");
      buttonWrapEl.className = "mdb-document-preview__download";

      const linkEl = document.createElement("a");
      linkEl.className = "mdb-document-preview__download-link";
      linkEl.href = this.downloadUrl;
      linkEl.target = "_blank";
      linkEl.rel = "noopener noreferrer";
      linkEl.textContent = this.downloadLabel;

      buttonWrapEl.appendChild(linkEl);
      actionsEl.appendChild(buttonWrapEl);
      contentEl.appendChild(actionsEl);
    }

    if (this.embedSrc) {
      const previewEl = document.createElement("div");
      previewEl.className = "mdb-document-preview__embed";

      const iframeEl = document.createElement("iframe");
      iframeEl.className = "mdb-document-preview__iframe";
      iframeEl.src = this.embedSrc;
      iframeEl.loading = "lazy";
      iframeEl.sandbox.value = this.embedSandbox;
      iframeEl.title = this.heading
        ? `Preview of ${this.heading}`
        : this.previewLabel;

      previewEl.appendChild(iframeEl);
      wrapperEl.appendChild(previewEl);
    }

    this._contentEl = wrapperEl;

    return wrapperEl;
  }
}

if (
  globalThis.customElements &&
  !customElements.get("mdb-document-preview-button")
) {
  customElements.define(
    "mdb-document-preview-button",
    MdbDocumentPreviewButton
  );
}
