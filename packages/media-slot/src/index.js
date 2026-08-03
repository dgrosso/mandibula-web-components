import { LitElement, css, html } from "lit";
import "@mandibula/suspense";
import "@mandibula/video";
import "@mandibula/scoped-inline-svg";

export class MdbMediaSlot extends LitElement {
  static properties = {
    src: { type: String },
    srcset: { type: String },
    sizes: { type: String },
    alt: { type: String },
    loading: { type: String },
    background: { type: Boolean, reflect: true },
    mediaType: { type: String, attribute: "media-type" },
    autoplay: { type: Boolean, reflect: true },
    muted: { type: Boolean, reflect: true },
    loop: { type: Boolean, reflect: true },
    controls: { type: Boolean, reflect: true },
    playsinline: { type: Boolean, reflect: true },
    svgOverrideFill: {
      type: Boolean,
      attribute: "svg-override-fill",
      reflect: true,
    },
    svgOverrideStroke: {
      type: Boolean,
      attribute: "svg-override-stroke",
      reflect: true,
    },
    debug: { type: Boolean, reflect: true },
    _mediaState: { state: true },
  };

  static get observedAttributes() {
    return [...super.observedAttributes, "width", "height"];
  }

  constructor() {
    super();
    this.src = "";
    this.srcset = "";
    this.sizes = "";
    this.alt = "";
    this.loading = "lazy";
    this.background = false;
    this.mediaType = "image";
    this.autoplay = false;
    this.muted = false;
    this.loop = false;
    this.controls = false;
    this.playsinline = false;
    this.svgOverrideFill = false;
    this.svgOverrideStroke = false;
    this.debug = false;
    this._mediaState = "loading";
    this._suspenseEl = null;
    this._mediaEl = null;
    this._onMediaLoad = () => this._handleMediaSuccess();
    this._onMediaError = () => this._handleMediaError();
  }

  static styles = css`
    :host {
      position: relative;
      display: flex;
      width: 100%;
      aspect-ratio: var(
        --mdb-media-slot-aspect-ratio,
        var(--mdb-media-slot-natural-aspect-ratio, auto)
      );
      background: var(--mdb-media-slot-background-color, transparent);
      overflow: hidden;
      border-radius: inherit;
    }

    :host([background]) {
      position: absolute;
      inset: 0;
      z-index: var(--mdb-media-slot-background-zindex, 0);
      pointer-events: none;
      width: 100%;
      height: 100%;
      aspect-ratio: auto;
    }

    mdb-suspense {
      display: contents;
    }

    img,
    mdb-scoped-inline-svg,
    mdb-video {
      width: 100%;
      height: 100%;
      display: block;
      border-radius: inherit;
      transition: opacity var(--mdb-media-slot-transition-duration, 300ms) ease;
      opacity: 0;
    }

    img {
      object-fit: var(--mdb-media-slot-object-fit, cover);
      object-position: var(--mdb-media-slot-focal-point, center);
    }

    mdb-video {
      &::part(video) {
        object-fit: var(--mdb-media-slot-object-fit, cover);
        object-position: var(--mdb-media-slot-focal-point, center);
      }
    }

    img[data-media-state="success"],
    mdb-scoped-inline-svg[data-media-state="success"],
    mdb-video[data-media-state="success"] {
      opacity: 1;
    }

    img[data-media-state="error"],
    mdb-scoped-inline-svg[data-media-state="error"],
    mdb-video[data-media-state="error"] {
      opacity: 0.3;
    }

    @media (prefers-reduced-motion: reduce) {
      img,
      mdb-scoped-inline-svg,
      mdb-video {
        transition: none !important;
      }
    }

    :host([debug]) {
      outline: 1px dashed var(--mdb-media-slot-debug-outline, red);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    if (window.__MDB_DEBUG__ && !this.hasAttribute("debug")) {
      this.setAttribute("debug", "");
    }
    this._syncNaturalAspectRatio();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (name === "width" || name === "height") {
      this._syncNaturalAspectRatio();
    }
  }

  firstUpdated() {
    this._suspenseEl = this.renderRoot.querySelector("mdb-suspense");
    this._setupMedia();
  }

  updated(changed) {
    if (
      changed.has("mediaType") ||
      changed.has("src") ||
      changed.has("srcset") ||
      changed.has("sizes") ||
      changed.has("alt") ||
      changed.has("loading") ||
      changed.has("autoplay") ||
      changed.has("muted") ||
      changed.has("loop") ||
      changed.has("controls") ||
      changed.has("playsinline") ||
      changed.has("svgOverrideFill") ||
      changed.has("svgOverrideStroke") ||
      changed.has("background")
    ) {
      this._setupMedia();
    }
  }

  _syncNaturalAspectRatio() {
    const width = Number(this.getAttribute("width"));
    const height = Number(this.getAttribute("height"));
    const hasNaturalSize =
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width > 0 &&
      height > 0;

    if (hasNaturalSize) {
      this.style.setProperty(
        "--mdb-media-slot-natural-aspect-ratio",
        `${width} / ${height}`
      );
    } else {
      this.style.removeProperty("--mdb-media-slot-natural-aspect-ratio");
    }
  }

  render() {
    const type = this._mediaType();
    const media = type === "video" ? this._renderVideo() : this._renderImage();

    return html`
      <mdb-suspense part="suspense" ?debug=${this.debug}>
        ${media}
        <slot name="loader" slot="loader">
          <mdb-spinner></mdb-spinner>
        </slot>
        <slot name="fallback" slot="fallback"></slot>
      </mdb-suspense>
    `;
  }

  load() {
    if (!this._suspenseEl) {
      return Promise.reject(
        new Error("No suspense instance available to load")
      );
    }
    return this._suspenseEl.waitForLoad();
  }

  _renderImage() {
    if (this._isSvg()) {
      return html`
        <mdb-scoped-inline-svg
          part="media svg"
          exportparts="svg: svg-element"
          src=${this.src || ""}
          ?override-fill=${this.svgOverrideFill}
          ?override-stroke=${this.svgOverrideStroke}
          role=${this.alt ? "img" : "presentation"}
          aria-label=${this.alt || ""}
          ?aria-hidden=${!this.alt}
          data-media-state=${this._mediaState}
        ></mdb-scoped-inline-svg>
      `;
    }

    return html`
      <img
        part="media image"
        src=${this.src || ""}
        srcset=${this.srcset || ""}
        sizes=${this.sizes || ""}
        alt=${this.alt || ""}
        loading=${this.loading === "eager" ? "eager" : "lazy"}
        decoding="async"
        draggable="false"
        data-media-state=${this._mediaState}
      />
    `;
  }

  _renderVideo() {
    const flags = this._videoFlags();
    return html`
      <mdb-video
        part="media video"
        src=${this.src || ""}
        alt=${this.alt || ""}
        ?autoplay=${flags.autoplay}
        ?muted=${flags.muted}
        ?loop=${flags.loop}
        ?controls=${flags.controls}
        ?playsinline=${flags.playsinline}
        data-media-state=${this._mediaState}
      ></mdb-video>
    `;
  }

  _setupMedia() {
    if (!this._suspenseEl) {
      return;
    }
    const type = this._mediaType();
    let selector = "img";
    if (type === "video") {
      selector = "mdb-video";
    } else if (this._isSvg()) {
      selector = "mdb-scoped-inline-svg";
    }
    const media = this.renderRoot.querySelector(selector);

    if (!media) {
      return;
    }

    if (this._mediaEl && this._mediaEl !== media) {
      this._detachMediaListeners(this._mediaEl);
    }

    this._mediaEl = media;
    this._attachMediaListeners(this._mediaEl, type);
    this._startMediaLoading();
  }

  _attachMediaListeners(media, type) {
    media.removeEventListener("load", this._onMediaLoad);
    media.removeEventListener("error", this._onMediaError);

    if (type === "video") {
      ["load", "ready", "loadeddata", "canplay"].forEach((evt) =>
        media.addEventListener(evt, this._onMediaLoad)
      );
    } else {
      media.addEventListener("load", this._onMediaLoad);
    }
    media.addEventListener("error", this._onMediaError);
  }

  _detachMediaListeners(media) {
    ["load", "ready", "loadeddata", "canplay"].forEach((evt) =>
      media.removeEventListener(evt, this._onMediaLoad)
    );
    media.removeEventListener("error", this._onMediaError);
  }

  _startMediaLoading() {
    if (!this._suspenseEl || !this._mediaEl) {
      return;
    }
    if (this._mediaType() === "video" && this.background) {
      const flags = this._videoFlags();
      Object.entries(flags).forEach(([key, val]) => {
        if (val) {
          this._mediaEl.setAttribute(key, "");
        } else {
          this._mediaEl.removeAttribute(key);
        }
      });
    }
    this._mediaState = "loading";
    this._updateMediaStateAttr();
    this._suspenseEl.watch(this._mediaEl);
    this._suspenseEl.setLoading(this._mediaEl);
  }

  _handleMediaSuccess() {
    this._mediaState = "success";
    this._updateMediaStateAttr();
    this._suspenseEl?.setSuccess(this._mediaEl);
  }

  _handleMediaError() {
    this._mediaState = "error";
    this._updateMediaStateAttr();
    this._suspenseEl?.setError(
      new Error("Media failed to load"),
      this._mediaEl
    );
  }

  _updateMediaStateAttr() {
    if (this._mediaEl) {
      this._mediaEl.setAttribute("data-media-state", this._mediaState);
    }
  }

  _mediaType() {
    const type = (this.mediaType || "image").toLowerCase();
    return type === "video" ? "video" : "image";
  }

  _isSvg() {
    if (this._mediaType() === "video") {
      return false;
    }

    const src = (this.src || "").split("#")[0].split("?")[0].toLowerCase();
    return src.endsWith(".svg");
  }

  _videoFlags() {
    if (this.background) {
      return {
        autoplay: true,
        muted: true,
        loop: true,
        controls: false,
        playsinline: true,
      };
    }
    return {
      autoplay: this.autoplay,
      muted: this.muted,
      loop: this.loop,
      controls: this.controls,
      playsinline: this.playsinline,
    };
  }
}

if (globalThis.customElements && !customElements.get("mdb-media-slot")) {
  customElements.define("mdb-media-slot", MdbMediaSlot);
}
