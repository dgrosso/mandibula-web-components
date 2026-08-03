import { LitElement, css, html } from "lit";
import "@mandibula/modal";

export class MdbVideoModalButton extends LitElement {
  static properties = {
    videoLoaded: { type: Boolean },
    controls: { type: Boolean },
    playLabel: { type: String, attribute: "play-label" },
  };

  constructor() {
    super();
    this.videoLoaded = false;
    this.playLabel = "Play video";
    this._handleHostClick = this._handleHostClick.bind(this);
    this._handleTriggerClick = this._handleTriggerClick.bind(this);
  }

  static styles = css`
    :host {
      display: flex;
    }

    .default-play-button {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.6);
      color: white;
      border: none;
      border-radius: 50%;
      width: 64px;
      height: 64px;
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .play-button {
      margin: 0;
      padding: 0;
      background: transparent;
      border: none;
      appearance: none;
      cursor: pointer;
    }

    .mdb-video-modal__content {
      display: flex;
      align-self: center;
      justify-self: center;
      aspect-ratio: 16 / 9;
      width: 80%;
    }
  `;

  render() {
    return html`
      <slot name="trigger" @slotchange=${this._bindTrigger}>
        <button
          class="play-button"
          part="play-button"
          aria-label=${this.playLabel || "Play video"}
          type="button"
        >
          <slot name="play-button-content">
            <span class="default-play-button" aria-hidden="true">▶</span>
          </slot>
        </button>
      </slot>
      <mdb-modal
        id="mdb-video-modal"
        content-class="mdb-video-modal"
        close-label="Close video"
        label=${this.playLabel || "Video player"}
      ></mdb-modal>
    `;
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("click", this._handleHostClick);
  }

  disconnectedCallback() {
    this._unbindTrigger();
    this.removeEventListener("click", this._handleHostClick);
    super.disconnectedCallback();
  }

  firstUpdated() {
    this._bindTrigger();
  }

  _bindTrigger() {
    this._unbindTrigger();

    const trigger =
      this.querySelector('[slot="trigger"]') ||
      this.renderRoot.querySelector(".play-button");
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

  _handleHostClick(event) {
    if (event.target !== this) {
      return;
    }

    event.preventDefault();
    this._openModal();
  }

  _openModal() {
    if (!this.videoEl || !this.wrapperEl) {
      const src = this.getAttribute("src");
      const wrapperEl = document.createElement("div");
      const videoEl = document.createElement("mdb-video");
      videoEl.setAttribute("src", src);
      videoEl.setAttribute("part", "modal-video");
      videoEl.setAttribute("controls", this.controls);
      videoEl.setAttribute("autoplay", "");
      videoEl.setAttribute("playsinline", "");
      videoEl.style.width = "100%";
      videoEl.style.height = "100%";
      this.videoEl = videoEl;

      wrapperEl.classList.add("mdb-video-modal__content");
      wrapperEl.style.alignSelf = "center";
      wrapperEl.style.justifySelf = "center";
      wrapperEl.style.width = "90%";
      wrapperEl.style.aspectRatio = "16 / 9";
      this.wrapperEl = wrapperEl;

      wrapperEl.appendChild(videoEl);
    }

    if (!this.modal) {
      this.modal = this.shadowRoot.querySelector("#mdb-video-modal");
      this.modal.addEventListener("mdb-modal-opened", (event) => {
        const { modalContainer: openedModal } = event.detail;
        requestAnimationFrame(() => {
          openedModal.contentEl.appendChild(this.wrapperEl);
          const onScreenVideo = openedModal.querySelector("mdb-video");
          if (onScreenVideo.isReady) {
            onScreenVideo.play();
          } else {
            onScreenVideo.addEventListener(
              "ready",
              () => onScreenVideo.play(),
              { once: true }
            );
          }
        });
      });
    }

    this.modal.open = true;
  }
}

if (
  globalThis.customElements &&
  !customElements.get("mdb-video-modal-button")
) {
  customElements.define("mdb-video-modal-button", MdbVideoModalButton);
}
