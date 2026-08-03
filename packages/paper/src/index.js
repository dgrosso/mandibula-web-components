import { LitElement } from "lit";

// mdb-paper.js
// Plain JS Web Component.
// Background-only paper surface.
// Private members are prefixed with "_".

const DEFAULTS = {
  seed: 7,
  radius: 5,
  roughness: 1.5,
  frequency: 6,
  fallbackRadius: 5,
};
const BORDER_SIDE_TOP = "top";
const BORDER_SIDE_RIGHT = "right";
const BORDER_SIDE_BOTTOM = "bottom";
const BORDER_SIDE_LEFT = "left";
const BORDER_SIDES = [
  BORDER_SIDE_TOP,
  BORDER_SIDE_RIGHT,
  BORDER_SIDE_BOTTOM,
  BORDER_SIDE_LEFT,
];
const BORDER_SCOPE_ALL = "all";
const BORDER_SCOPE_TOP_BOTTOM = "top-bottom";

const normalizeBorderScope = (value) =>
  value === BORDER_SCOPE_TOP_BOTTOM
    ? BORDER_SCOPE_TOP_BOTTOM
    : BORDER_SCOPE_ALL;

const normalizeBorderSideTokens = (tokens) => {
  if (tokens.includes(BORDER_SCOPE_ALL)) {
    return { isProvided: true, isValid: true, sides: [...BORDER_SIDES] };
  }

  if (tokens.includes("none")) {
    return { isProvided: true, isValid: true, sides: [] };
  }

  const sideSet = new Set();
  tokens.forEach((token) => {
    if (token === BORDER_SCOPE_TOP_BOTTOM) {
      sideSet.add(BORDER_SIDE_TOP);
      sideSet.add(BORDER_SIDE_BOTTOM);
      return;
    }

    if (token === "left-right") {
      sideSet.add(BORDER_SIDE_LEFT);
      sideSet.add(BORDER_SIDE_RIGHT);
      return;
    }

    if (BORDER_SIDES.includes(token)) {
      sideSet.add(token);
    }
  });

  return {
    isProvided: true,
    isValid: sideSet.size > 0,
    sides: BORDER_SIDES.filter((side) => sideSet.has(side)),
  };
};

const normalizeBorderSidesInput = (value) => {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { isProvided: true, isValid: true, sides: [] };
    }

    return normalizeBorderSideTokens(
      value.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
    );
  }

  if (typeof value !== "string") {
    return { isProvided: false, isValid: false, sides: [] };
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return { isProvided: false, isValid: false, sides: [] };
  }

  return normalizeBorderSideTokens(trimmed.split(/[,\s]+/).filter(Boolean));
};

const getBorderSidesFromScope = (scope) =>
  normalizeBorderScope(scope) === BORDER_SCOPE_TOP_BOTTOM
    ? [BORDER_SIDE_TOP, BORDER_SIDE_BOTTOM]
    : [...BORDER_SIDES];

const resolveBorderSides = (borderSidesValue, borderScopeValue) => {
  const normalized = normalizeBorderSidesInput(borderSidesValue);
  if (normalized.isProvided && normalized.isValid) {
    return normalized.sides;
  }

  return getBorderSidesFromScope(borderScopeValue);
};

const serializeBorderSides = (sides) => {
  if (sides.length === 0) {
    return "none";
  }

  if (sides.length === BORDER_SIDES.length) {
    return BORDER_SCOPE_ALL;
  }

  return BORDER_SIDES.filter((side) => sides.includes(side)).join(" ");
};

const PATH_CACHE = new Map();
const PATH_CACHE_MAX = 400;

export class MdbPaper extends LitElement {
  createRenderRoot() {
    return this.shadowRoot;
  }
  static get observedAttributes() {
    return [
      "seed",
      "radius",
      "roughness",
      "frequency",
      "disabled",
      "border-scope",
      "border-sides",
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this._styleEl = document.createElement("style");
    this._styleEl.textContent = this._getStyles();

    this._rootEl = document.createElement("div");
    this._rootEl.className = "paper";
    this._rootEl.setAttribute("part", "paper");
    this._rootEl.innerHTML = `
      <svg class="surface" part="surface" aria-hidden="true" focusable="false">
        <path class="shape" part="shape"></path>
      </svg>
      <div class="content" part="content">
        <slot></slot>
      </div>
    `;

    this.shadowRoot.append(this._styleEl, this._rootEl);

    this._surfaceEl = this.shadowRoot.querySelector(".surface");
    this._shapeEl = this.shadowRoot.querySelector(".shape");

    this._ro = null;
    this._raf = 0;
    this._resizeHandler = () => this._scheduleRender();
    this._movedHostBackground = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this._upgradeProperty("seed");
    this._upgradeProperty("radius");
    this._upgradeProperty("roughness");
    this._upgradeProperty("frequency");
    this._upgradeProperty("borderScope");
    this._upgradeProperty("borderSides");

    this._startObservers();
    this._scheduleRender();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }

    window.removeEventListener("resize", this._resizeHandler);

    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
  }

  attributeChangedCallback() {
    this._scheduleRender();
  }

  get seed() {
    return this._toNumber(this.getAttribute("seed"), DEFAULTS.seed);
  }

  set seed(value) {
    this.setAttribute("seed", String(value));
  }

  get radius() {
    return this._toNumber(this.getAttribute("radius"), DEFAULTS.radius);
  }

  set radius(value) {
    this.setAttribute("radius", String(value));
  }

  get roughness() {
    return this._toNumber(this.getAttribute("roughness"), DEFAULTS.roughness);
  }

  set roughness(value) {
    this.setAttribute("roughness", String(value));
  }

  get frequency() {
    return this._toNumber(this.getAttribute("frequency"), DEFAULTS.frequency);
  }

  set frequency(value) {
    this.setAttribute("frequency", String(value));
  }

  get borderScope() {
    return normalizeBorderScope(this.getAttribute("border-scope"));
  }

  set borderScope(value) {
    this.setAttribute("border-scope", normalizeBorderScope(value));
  }

  get borderSides() {
    return serializeBorderSides(
      resolveBorderSides(
        this.getAttribute("border-sides"),
        this.getAttribute("border-scope")
      )
    );
  }

  set borderSides(value) {
    const normalized = normalizeBorderSidesInput(value);
    if (!normalized.isProvided) {
      this.removeAttribute("border-sides");
      return;
    }

    if (!normalized.isValid) {
      this.removeAttribute("border-sides");
      return;
    }

    this.setAttribute("border-sides", serializeBorderSides(normalized.sides));
  }

  _getStyles() {
    return `
:host {
  display: block;
  position: relative;
  --mdb-paper-bg: transparent;
  --mdb-paper-gap: 0px;
  --mdb-paper-content-gap: var(--mdb-paper-gap);
  --mdb-paper-padding: 0px;
  --mdb-paper-fallback-radius: 14px;
}

.paper {
  position: relative;
  display: block;
  min-height: 1px;
  height: 100%;
}

.surface {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  z-index: 0;
  pointer-events: none;
  overflow: visible;
}

.shape {
  fill: var(--mdb-paper-bg);
}

.content {
  position: relative;
  z-index: 1;
  display: block;
  --mdb-paper-content-gap: var(--mdb-paper-gap);
  padding: var(--mdb-paper-padding);
}

/* Fallback strategy: plain rounded block when procedural shape is unavailable. */
:host([disabled]) .surface,
:host([data-shape-disabled]) .surface {
  display: none;
}

:host([disabled]) .paper,
:host([data-shape-disabled]) .paper {
  border-radius: var(--mdb-paper-fallback-radius);
  overflow: hidden;
  background: var(--mdb-paper-bg);
}
`;
  }

  _startObservers() {
    if ("ResizeObserver" in window) {
      this._ro = new ResizeObserver(() => this._scheduleRender());
      this._ro.observe(this);
      return;
    }

    window.addEventListener("resize", this._resizeHandler);
  }

  _upgradeProperty(prop) {
    if (Object.prototype.hasOwnProperty.call(this, prop)) {
      const value = this[prop];
      delete this[prop];
      this[prop] = value;
    }
  }

  _toNumber(value, fallback) {
    if (value === null || value === undefined || value === "") {
      return fallback;
    }

    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  _readSetting(attributeName, cssVarName, fallback, computedStyle) {
    if (this.hasAttribute(attributeName)) {
      return this._toNumber(this.getAttribute(attributeName), fallback);
    }

    const raw = computedStyle.getPropertyValue(cssVarName).trim();
    return this._toNumber(raw, fallback);
  }

  _ensureBackgroundSource(computedStyle) {
    const hasCustomBackground =
      this.style.getPropertyValue("--mdb-paper-bg").trim() !== "";
    if (hasCustomBackground || this._movedHostBackground) {
      return;
    }

    const backgroundImage = computedStyle.backgroundImage;
    const backgroundColor = computedStyle.backgroundColor;
    const hasImage = backgroundImage && backgroundImage !== "none";
    const hasColor =
      backgroundColor &&
      backgroundColor !== "rgba(0, 0, 0, 0)" &&
      backgroundColor !== "transparent";

    if (!hasImage && !hasColor) {
      return;
    }

    this.style.setProperty("--mdb-paper-bg", computedStyle.background);
    this.style.background = "transparent";
    this._movedHostBackground = true;
  }

  _scheduleRender() {
    if (this._raf) {
      cancelAnimationFrame(this._raf);
    }

    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._render();
    });
  }

  _hash(value) {
    const x = Math.sin(value) * 43758.5453123;
    return x - Math.floor(x);
  }

  _noise(sample, seed) {
    const s0 = Math.floor(sample);
    const s1 = s0 + 1;
    const t = sample - s0;
    const smooth = t * t * (3 - 2 * t);

    const n0 = this._hash(s0 * 12.9898 + seed * 78.233) * 2 - 1;
    const n1 = this._hash(s1 * 12.9898 + seed * 78.233) * 2 - 1;

    return n0 + (n1 - n0) * smooth;
  }

  _edgePoints(
    length,
    baseCoord,
    edgeSeed,
    settings,
    orientation,
    startInset = 0
  ) {
    const step = settings.frequency;
    const normalizedLength = Math.max(0, length);
    const count = Math.max(2, Math.ceil(normalizedLength / step) + 1);
    const points = [];

    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1);
      const coord = t * normalizedLength;
      const envelope = Math.sin(Math.PI * t) ** 0.82;
      const sample = coord / step;
      const offset =
        this._noise(sample, edgeSeed) * settings.roughness * envelope;

      if (orientation === "top") {
        points.push([coord + startInset, baseCoord + offset]);
      } else if (orientation === "right") {
        points.push([baseCoord + offset, coord + startInset]);
      } else if (orientation === "bottom") {
        points.push([settings.width - startInset - coord, baseCoord + offset]);
      } else {
        points.push([baseCoord + offset, settings.height - startInset - coord]);
      }
    }

    return points;
  }

  _quadPath(points) {
    if (points.length === 0) {
      return "";
    }

    if (points.length === 1) {
      return `L ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)} `;
    }

    let d = `L ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)} `;
    for (let i = 1; i < points.length - 1; i += 1) {
      const current = points[i];
      const next = points[i + 1];
      const midX = (current[0] + next[0]) * 0.5;
      const midY = (current[1] + next[1]) * 0.5;

      d += `Q ${current[0].toFixed(2)} ${current[1].toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)} `;
    }

    const last = points[points.length - 1];
    d += `T ${last[0].toFixed(2)} ${last[1].toFixed(2)} `;

    return d;
  }

  _buildPaperPath(settings) {
    const topLeftRadius =
      settings.hasTop && settings.hasLeft ? settings.radius : 0;
    const topRightRadius =
      settings.hasTop && settings.hasRight ? settings.radius : 0;
    const bottomRightRadius =
      settings.hasBottom && settings.hasRight ? settings.radius : 0;
    const bottomLeftRadius =
      settings.hasBottom && settings.hasLeft ? settings.radius : 0;

    const topLength = settings.width - topLeftRadius - topRightRadius;
    const rightLength = settings.height - topRightRadius - bottomRightRadius;
    const bottomLength = settings.width - bottomRightRadius - bottomLeftRadius;
    const leftLength = settings.height - bottomLeftRadius - topLeftRadius;

    const top = settings.hasTop
      ? this._edgePoints(
          topLength,
          0,
          settings.seed + 11,
          settings,
          "top",
          topLeftRadius
        )
      : [];
    const right = settings.hasRight
      ? this._edgePoints(
          rightLength,
          settings.width,
          settings.seed + 23,
          settings,
          "right",
          topRightRadius
        )
      : [];
    const bottom = settings.hasBottom
      ? this._edgePoints(
          bottomLength,
          settings.height,
          settings.seed + 37,
          settings,
          "bottom",
          bottomRightRadius
        )
      : [];
    const left = settings.hasLeft
      ? this._edgePoints(
          leftLength,
          0,
          settings.seed + 53,
          settings,
          "left",
          bottomLeftRadius
        )
      : [];

    let d = `M ${topLeftRadius.toFixed(2)} 0 `;

    if (settings.hasTop) {
      d += this._quadPath(top);
    } else {
      d += `L ${(settings.width - topRightRadius).toFixed(2)} 0 `;
    }

    if (topRightRadius > 0) {
      d += `Q ${settings.width.toFixed(2)} 0 ${settings.width.toFixed(2)} ${topRightRadius.toFixed(2)} `;
    }

    if (settings.hasRight) {
      d += this._quadPath(right);
    } else {
      d += `L ${settings.width.toFixed(2)} ${(settings.height - bottomRightRadius).toFixed(2)} `;
    }

    if (bottomRightRadius > 0) {
      d += `Q ${settings.width.toFixed(2)} ${settings.height.toFixed(2)} ${(settings.width - bottomRightRadius).toFixed(2)} ${settings.height.toFixed(2)} `;
    }

    if (settings.hasBottom) {
      d += this._quadPath(bottom);
    } else {
      d += `L ${bottomLeftRadius.toFixed(2)} ${settings.height.toFixed(2)} `;
    }

    if (bottomLeftRadius > 0) {
      d += `Q 0 ${settings.height.toFixed(2)} 0 ${(settings.height - bottomLeftRadius).toFixed(2)} `;
    }

    if (settings.hasLeft) {
      d += this._quadPath(left);
    } else {
      d += `L 0 ${topLeftRadius.toFixed(2)} `;
    }

    if (topLeftRadius > 0) {
      d += `Q 0 0 ${topLeftRadius.toFixed(2)} 0 `;
    }

    d += "Z";

    return d;
  }

  _cacheKey(width, height, settings) {
    const w = Math.round(width);
    const h = Math.round(height);
    const s = Math.round(settings.seed);
    const r = Number(settings.radius).toFixed(2);
    const q = Number(settings.roughness).toFixed(2);
    const f = Number(settings.frequency).toFixed(2);
    return `${w}x${h}|${s}|${r}|${q}|${f}|${settings.borderSidesValue}`;
  }

  _getCachedPath(width, height, settings) {
    const key = this._cacheKey(width, height, settings);
    if (PATH_CACHE.has(key)) {
      return PATH_CACHE.get(key);
    }

    const path = this._buildPaperPath(settings);
    PATH_CACHE.set(key, path);

    if (PATH_CACHE.size > PATH_CACHE_MAX) {
      const firstKey = PATH_CACHE.keys().next().value;
      PATH_CACHE.delete(firstKey);
    }

    return path;
  }

  _renderFallback(width, height) {
    this.setAttribute("data-shape-disabled", "");
    this._surfaceEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this._shapeEl.setAttribute("d", `M 0 0 H ${width} V ${height} H 0 Z`);
  }

  _applyFallbackRadius(borderSides) {
    const sideSet = new Set(borderSides);
    const radiusValue = "var(--mdb-paper-fallback-radius)";
    const topLeftRadius =
      sideSet.has(BORDER_SIDE_TOP) && sideSet.has(BORDER_SIDE_LEFT)
        ? radiusValue
        : "0px";
    const topRightRadius =
      sideSet.has(BORDER_SIDE_TOP) && sideSet.has(BORDER_SIDE_RIGHT)
        ? radiusValue
        : "0px";
    const bottomRightRadius =
      sideSet.has(BORDER_SIDE_BOTTOM) && sideSet.has(BORDER_SIDE_RIGHT)
        ? radiusValue
        : "0px";
    const bottomLeftRadius =
      sideSet.has(BORDER_SIDE_BOTTOM) && sideSet.has(BORDER_SIDE_LEFT)
        ? radiusValue
        : "0px";

    this._rootEl.style.borderRadius = [
      topLeftRadius,
      topRightRadius,
      bottomRightRadius,
      bottomLeftRadius,
    ].join(" ");
  }

  _render() {
    const rect = this.getBoundingClientRect();
    const width = Math.max(0, Math.round(rect.width));
    const height = Math.max(0, Math.round(rect.height));
    const borderSides = resolveBorderSides(
      this.getAttribute("border-sides"),
      this.getAttribute("border-scope")
    );

    this._applyFallbackRadius(borderSides);

    if (width < 2 || height < 2) {
      this._renderFallback(Math.max(width, 1), Math.max(height, 1));
      return;
    }

    const computedStyle = getComputedStyle(this);
    this._ensureBackgroundSource(computedStyle);

    const settings = {
      seed: this._readSetting(
        "seed",
        "--mdb-paper-seed",
        DEFAULTS.seed,
        computedStyle
      ),
      radius: this._readSetting(
        "radius",
        "--mdb-paper-radius",
        DEFAULTS.radius,
        computedStyle
      ),
      roughness: this._readSetting(
        "roughness",
        "--mdb-paper-roughness",
        DEFAULTS.roughness,
        computedStyle
      ),
      frequency: this._readSetting(
        "frequency",
        "--mdb-paper-frequency",
        DEFAULTS.frequency,
        computedStyle
      ),
      borderSidesValue: serializeBorderSides(borderSides),
      hasTop: borderSides.includes(BORDER_SIDE_TOP),
      hasRight: borderSides.includes(BORDER_SIDE_RIGHT),
      hasBottom: borderSides.includes(BORDER_SIDE_BOTTOM),
      hasLeft: borderSides.includes(BORDER_SIDE_LEFT),
      width,
      height,
    };

    settings.radius = Math.max(
      0,
      Math.min(settings.radius, width * 0.45, height * 0.45)
    );
    settings.roughness = Math.max(
      0,
      Math.min(settings.roughness, Math.min(width, height) * 0.35)
    );
    settings.frequency = Math.max(8, Math.min(settings.frequency, 80));

    if (this.hasAttribute("disabled")) {
      this._renderFallback(width, height);
      return;
    }

    const path = this._getCachedPath(width, height, settings);
    this._surfaceEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this._shapeEl.style.fill = "var(--mdb-paper-bg)";
    this._shapeEl.setAttribute("d", path);
    this.removeAttribute("data-shape-disabled");
  }
}

if (globalThis.customElements && !customElements.get("mdb-paper")) {
  customElements.define("mdb-paper", MdbPaper);
}
