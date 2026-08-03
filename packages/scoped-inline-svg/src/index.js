import { LitElement, css, html } from "lit";

export class MdbScopedInlineSvg extends LitElement {
  static properties = {
    src: { type: String },
    overrideFill: { type: Boolean, attribute: "override-fill", reflect: true },
    overrideStroke: {
      type: Boolean,
      attribute: "override-stroke",
      reflect: true,
    },
  };

  static svgCache = new Map();

  static styles = css`
    :host {
      display: inline-block;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    :host([override-fill])
      svg
      :is(path, rect, circle, ellipse, polygon, polyline, text, tspan, use):not(
        [fill="none"]
      )[fill] {
      fill: currentColor !important;
    }

    :host([override-stroke])
      svg
      :is(
        path,
        rect,
        circle,
        ellipse,
        polygon,
        polyline,
        line,
        text,
        tspan,
        use
      ):not([stroke="none"])[stroke] {
      stroke: currentColor !important;
    }
  `;

  constructor() {
    super();
    this.uniqueId = `svg-${Math.random().toString(36).slice(2, 8)}`;
    this.src = "";
    this.overrideFill = false;
    this.overrideStroke = false;
    this._svgElement = null;
  }

  updated(changedProps) {
    if (changedProps.has("src") && this.src) {
      this._loadSvg(this.src);
    }
  }

  async _loadSvg(src) {
    try {
      let text = MdbScopedInlineSvg.svgCache.get(src);

      if (!text) {
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error("Failed to fetch SVG");
        }
        text = await response.text();
      }

      this._renderScopedSvg(text);
      MdbScopedInlineSvg.svgCache.set(src, text);
    } catch (error) {
      console.error("Error loading SVG:", error);
      this._svgElement = null;
      this.requestUpdate();
      this.dispatchEvent(new Event("error"));
    }
  }

  _renderScopedSvg(svgText) {
    const svg = this._sanitizeSvg(svgText);
    if (!svg) {
      throw new Error("Invalid or unsafe SVG document");
    }

    this._scopeIds(svg);
    this._ensureViewportAttributes(svg);

    svg.setAttribute("part", "svg");
    svg.querySelectorAll("[data-part]").forEach((el) => {
      const part = el.getAttribute("data-part");
      if (part) {
        el.setAttribute("part", part);
      }
    });

    this._svgElement = svg;
    this.requestUpdate();
    this.dispatchEvent(new Event("load"));
  }

  _sanitizeSvg(svgText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svg = doc.documentElement;

    if (
      svg.tagName?.toLowerCase() !== "svg" ||
      doc.querySelector("parsererror")
    ) {
      return null;
    }

    svg
      .querySelectorAll(
        "script, foreignObject, iframe, object, embed, audio, video, link, style"
      )
      .forEach((element) => element.remove());

    [svg, ...svg.querySelectorAll("*")].forEach((element) => {
      for (const attribute of [...element.attributes]) {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim();
        const isEventHandler = name.startsWith("on");
        const isExternalReference =
          (name === "href" || name === "xlink:href") &&
          value &&
          !value.startsWith("#");
        const hasUnsafeProtocol = /(?:javascript|data\s*:\s*text\/html)/i.test(
          value
        );
        const hasExternalCssUrl = /url\(\s*["']?(?!#)/i.test(value);

        if (
          name === "style" ||
          isEventHandler ||
          isExternalReference ||
          hasUnsafeProtocol ||
          hasExternalCssUrl
        ) {
          element.removeAttribute(attribute.name);
        }
      }
    });

    return svg;
  }

  _scopeIds(svg) {
    const idMap = new Map();
    const uid = this.uniqueId;

    [svg, ...svg.querySelectorAll("[id]")]
      .filter((element) => element.hasAttribute("id"))
      .forEach((element) => {
        const id = element.id;
        const newId = `${id}-${uid}`;
        idMap.set(id, newId);
        element.id = newId;
      });

    [svg, ...svg.querySelectorAll("*")].forEach((element) => {
      for (const attribute of [...element.attributes]) {
        const value = attribute.value
          .replace(/url\(\s*#([^)\s]+)\s*\)/g, (_, id) => {
            return `url(#${idMap.get(id) || id})`;
          })
          .replace(/^#(.+)$/, (_, id) => `#${idMap.get(id) || id}`);

        if (value !== attribute.value) {
          element.setAttribute(attribute.name, value);
        }
      }
    });
  }

  _ensureViewportAttributes(svg) {
    if (!svg || svg.tagName?.toLowerCase() !== "svg") {
      return;
    }

    const viewBox = svg.getAttribute("viewBox");
    const width = this._parseSvgLength(svg.getAttribute("width"));
    const height = this._parseSvgLength(svg.getAttribute("height"));

    if (!viewBox && width && height) {
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      return;
    }

    const hasOnlyViewBox =
      !!viewBox && !svg.hasAttribute("width") && !svg.hasAttribute("height");

    if (!hasOnlyViewBox) {
      return;
    }

    const parts = viewBox
      .trim()
      .replace(/,/g, " ")
      .split(/\s+/)
      .map((value) => Number(value));

    if (parts.length !== 4 || !parts.every(Number.isFinite)) {
      return;
    }

    const viewBoxWidth = parts[2];
    const viewBoxHeight = parts[3];

    if (viewBoxWidth <= 0 || viewBoxHeight <= 0) {
      return;
    }

    svg.setAttribute("width", String(viewBoxWidth));
    svg.setAttribute("height", String(viewBoxHeight));
  }

  _parseSvgLength(value) {
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }

    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return parsed;
  }

  render() {
    return html`
      ${
        this._svgElement
          ? html`${this._svgElement.cloneNode(true)}`
          : html`<!-- SVG not loaded -->`
      }
    `;
  }
}

if (globalThis.customElements && !customElements.get("mdb-scoped-inline-svg")) {
  customElements.define("mdb-scoped-inline-svg", MdbScopedInlineSvg);
}
