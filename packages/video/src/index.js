import { LitElement, css, html } from "lit";

class VideoRenderer {
  constructor(host) {
    this.host = host;
  }
  render(/* src, attrs = {} */) {
    throw new Error("render() must be implemented");
  }
  play() {}
  pause() {}
  stop() {}
  seek(/* time */) {}
}

class NativeVideoRenderer extends VideoRenderer {
  render(src, attrs = {}) {
    const video = document.createElement("video");
    video.classList.add("video");
    video.style.width = "100%";
    video.style.height = "100%";
    const label = attrs.alt ?? "";
    const flags = {
      autoplay: !!attrs.autoplay,
      muted: !!attrs.muted,
      loop: !!attrs.loop,
      controls: !!attrs.controls,
      playsinline: !!attrs.playsinline,
    };

    if (label) {
      video.setAttribute("aria-label", label);
      video.setAttribute("title", label);
      video.textContent = label;
    }

    // Set properties before src to ensure autoplay/muted are honored.
    video.muted = flags.muted;
    video.autoplay = flags.autoplay;
    video.loop = flags.loop;
    video.controls = flags.controls;
    video.playsInline = flags.playsinline;

    Object.entries(flags).forEach(([key, value]) => {
      if (value) {
        video.setAttribute(key, "");
      } else {
        video.removeAttribute(key);
      }
    });

    video.src = src;

    if (attrs.captionsSrc) {
      const track = document.createElement("track");
      track.kind = "captions";
      track.src = attrs.captionsSrc;
      track.srclang = attrs.captionsLang || "en";
      track.label = attrs.captionsLabel || "Captions";
      track.default = true;
      video.append(track);
    }

    video.addEventListener("play", () =>
      this.host.dispatchEvent(new Event("play"))
    );
    video.addEventListener("pause", () =>
      this.host.dispatchEvent(new Event("pause"))
    );
    video.addEventListener("ended", () =>
      this.host.dispatchEvent(new Event("ended"))
    );
    video.addEventListener("loadeddata", () =>
      this.host.dispatchEvent(new Event("load"))
    );
    video.addEventListener("canplay", () => {
      this.host.isReady = true;
      this.host.dispatchEvent(new Event("ready"));
    });

    this.video = video;
    return video;
  }
  play() {
    this.video?.play();
  }
  pause() {
    this.video?.pause();
  }
  stop() {
    if (this.video) {
      this.video.pause();
      this.video.currentTime = 0;
    }
  }
  seek(time) {
    if (this.video) {
      this.video.currentTime = time;
    }
  }
}

class YouTubeRenderer extends VideoRenderer {
  render(src, attrs = {}) {
    const id = this._extractID(src);
    const params = new URLSearchParams();
    params.set("enablejsapi", "1");
    params.set("playsinline", "1");
    if (attrs.autoplay) {
      params.set("autoplay", "1");
    }
    if (attrs.muted) {
      params.set("mute", "1");
    }
    const iframe = document.createElement("iframe");
    iframe.classList.add("video");
    iframe.src = `https://www.youtube.com/embed/${id}?${params.toString()}`;
    iframe.allow = "autoplay; encrypted-media";
    iframe.style.border = "0";
    iframe.setAttribute("allowfullscreen", "");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    if (attrs.alt) {
      iframe.setAttribute("title", attrs.alt);
      iframe.setAttribute("aria-label", attrs.alt);
    }

    iframe.addEventListener("load", () => {
      this.host.dispatchEvent(new Event("load"));
      this.host.isReady = true;
      this.host.dispatchEvent(new Event("ready"));
    });

    this.iframe = iframe;
    return iframe;
  }
  play() {
    this._postCommand("playVideo");
  }
  pause() {
    this._postCommand("pauseVideo");
  }
  stop() {
    this._postCommand("stopVideo");
  }
  seek(time) {
    this._postCommand("seekTo", [Number(time) || 0, true]);
  }
  _postCommand(func, args = []) {
    this.iframe?.contentWindow?.postMessage(
      JSON.stringify({
        event: "command",
        func,
        args,
      }),
      "https://www.youtube.com"
    );
  }
  _extractID(url) {
    const match = url.match(
      /(?:youtube\.com\/(?:.*[?&]v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]+)/
    );
    return match ? match[1] : "";
  }
}

class VimeoRenderer extends VideoRenderer {
  render(src, attrs = {}) {
    const id = this._extractID(src);
    const params = new URLSearchParams();
    if (attrs.autoplay) {
      params.set("autoplay", "1");
    }
    if (attrs.muted) {
      params.set("muted", "1");
    }
    const iframe = document.createElement("iframe");
    iframe.classList.add("video");
    iframe.src = `https://player.vimeo.com/video/${id}?${params.toString()}`;
    iframe.allow = "autoplay; fullscreen";
    iframe.style.border = "0";
    iframe.setAttribute("allowfullscreen", "");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    if (attrs.alt) {
      iframe.setAttribute("title", attrs.alt);
      iframe.setAttribute("aria-label", attrs.alt);
    }

    iframe.addEventListener("load", () => {
      this.host.dispatchEvent(new Event("load"));
      this.host.isReady = true;
      this.host.dispatchEvent(new Event("ready"));
    });

    this.iframe = iframe;
    return iframe;
  }
  _extractID(url) {
    const match = url.match(/^https:\/\/vimeo\.com\/(\d+)/);
    return match ? match[1] : "";
  }
}

export class MdbVideo extends LitElement {
  static properties = {
    src: { type: String },
    alt: { type: String, reflect: true },
    autoplay: { type: Boolean, reflect: true },
    muted: { type: Boolean, reflect: true },
    loop: { type: Boolean, reflect: true },
    controls: { type: Boolean, reflect: true },
    playsinline: { type: Boolean, reflect: true },
    captionsSrc: { type: String, attribute: "captions-src" },
    captionsLang: { type: String, attribute: "captions-lang" },
    captionsLabel: { type: String, attribute: "captions-label" },
    isReady: { type: Boolean, attribute: false },
  };

  constructor() {
    super();
    this.src = "";
    this.alt = "";
    this.autoplay = false;
    this.muted = false;
    this.loop = false;
    this.controls = false;
    this.playsinline = false;
    this.captionsSrc = "";
    this.captionsLang = "en";
    this.captionsLabel = "Captions";
    this.isReady = false;
    this._renderer = null;
  }

  static styles = css`
    :host {
      display: inline-block;
    }
    .video {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `;

  updated(changed) {
    if (changed.has("src") || this._rendererNeedsUpdate(changed)) {
      this._renderVideo();
    }
  }

  render() {
    return html`<slot></slot>`;
  }

  play() {
    this._renderer?.play();
  }
  pause() {
    this._renderer?.pause();
  }
  stop() {
    this._renderer?.stop();
  }
  seek(time) {
    this._renderer?.seek(time);
  }

  _rendererNeedsUpdate(changed) {
    return [
      "autoplay",
      "muted",
      "loop",
      "controls",
      "playsinline",
      "alt",
      "captionsSrc",
      "captionsLang",
      "captionsLabel",
    ].some((key) => changed.has(key));
  }

  _renderVideo() {
    const src = this.src;
    this.isReady = false;
    if (!src) {
      this.shadowRoot.innerHTML = "";
      return;
    }

    const type = this._getSourceType(src);
    const attrs = {
      autoplay: this.autoplay,
      muted: this.muted,
      loop: this.loop,
      controls: this.controls,
      playsinline: this.playsinline,
      alt: this.alt,
      captionsSrc: this.captionsSrc,
      captionsLang: this.captionsLang,
      captionsLabel: this.captionsLabel,
    };

    if (type === "youtube") {
      this._renderer = new YouTubeRenderer(this);
    } else if (type === "vimeo") {
      this._renderer = new VimeoRenderer(this);
    } else {
      this._renderer = new NativeVideoRenderer(this);
    }

    const content = this._renderer.render(src, attrs);
    content.setAttribute("part", "video");

    this.shadowRoot.innerHTML = "";
    const styleEl = document.createElement("style");
    styleEl.textContent = MdbVideo.styles.cssText;
    this.shadowRoot.append(styleEl, content);
  }

  _getSourceType(url) {
    if (/youtube\.com|youtu\.be/.test(url)) {
      return "youtube";
    }
    if (/^https:\/\/vimeo\.com/.test(url)) {
      return "vimeo";
    }
    return "video";
  }
}

if (globalThis.customElements && !customElements.get("mdb-video")) {
  customElements.define("mdb-video", MdbVideo);
}
