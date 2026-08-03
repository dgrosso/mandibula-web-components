import { LitElement, css, html, nothing } from "lit";

const DEFAULT_EMPTY_SELECTIONS = {};

const parseJsonAttribute = (value, fallback = DEFAULT_EMPTY_SELECTIONS) => {
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch (error) {
    console.error("mdb-post-loop: failed to parse JSON attribute.", error);
    return fallback;
  }
};

const normalizeSelectionValues = (values) => {
  const valueList = Array.isArray(values) ? values : [values];

  return [
    ...new Set(
      valueList.map((value) => String(value || "").trim()).filter(Boolean)
    ),
  ];
};

const normalizeSelections = (selections) => {
  if (!selections || typeof selections !== "object") {
    return {};
  }

  return Object.entries(selections).reduce((accumulator, [key, values]) => {
    const normalizedKey = String(key || "").trim();
    const normalizedValues = normalizeSelectionValues(values);

    if (normalizedKey && normalizedValues.length > 0) {
      accumulator[normalizedKey] = normalizedValues;
    }

    return accumulator;
  }, {});
};

const mergeSelections = (fixedSelections, selectedSelections) => {
  const mergedSelections = {
    ...normalizeSelections(selectedSelections),
  };

  Object.entries(normalizeSelections(fixedSelections)).forEach(
    ([key, values]) => {
      mergedSelections[key] = values;
    }
  );

  return mergedSelections;
};

export class MdbPostLoop extends LitElement {
  createRenderRoot() {
    return this;
  }
  constructor() {
    super();

    this._selectedSelections = {};
    this._fixedSelections = {};
    this._abortController = null;
    this._currentPage = 1;
    this._totalPages = 1;
    this._loading = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this._postsEl =
      this.querySelector("[data-ajax-post-loop='posts']") ||
      this.querySelector("[data-post-feed-results]");

    this._selectedSelections = normalizeSelections(
      parseJsonAttribute(
        this.getAttribute("initial-selections"),
        DEFAULT_EMPTY_SELECTIONS
      )
    );
    this._fixedSelections = normalizeSelections(
      parseJsonAttribute(
        this.getAttribute("fixed-selections"),
        DEFAULT_EMPTY_SELECTIONS
      )
    );

    if (this.hasAttribute("disable-fetch")) {
      return;
    }

    this.addEventListener("mdb-post-loop-filter-change", this._onFilterChange);
    this.addEventListener("mdb-page-selected", this._onPageSelected);

    this._syncSelectionState();
    this.fetchPosts();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener(
      "mdb-post-loop-filter-change",
      this._onFilterChange
    );
    this.removeEventListener("mdb-page-selected", this._onPageSelected);

    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  get currentPage() {
    return this._currentPage;
  }

  get totalPages() {
    return this._totalPages;
  }

  getSelections() {
    return mergeSelections(this._fixedSelections, this._selectedSelections);
  }

  setSelections(selections = {}) {
    this._selectedSelections = normalizeSelections(selections);
    this._currentPage = 1;
    this._syncSelectionState();
    this.fetchPosts();
  }

  _onFilterChange = (event) => {
    const { key, values } = event.detail || {};
    const normalizedKey = String(key || "").trim();

    if (!normalizedKey) {
      return;
    }

    const normalizedValues = normalizeSelectionValues(values);

    if (normalizedValues.length > 0) {
      this._selectedSelections[normalizedKey] = normalizedValues;
    } else {
      delete this._selectedSelections[normalizedKey];
    }

    this._currentPage = 1;
    this._syncSelectionState();
    this.fetchPosts();
  };

  _onPageSelected = (event) => {
    const nextPage = Number.parseInt(event.detail?.page, 10) || 1;
    this._currentPage = Math.max(1, nextPage);
    this.fetchPosts({ mode: event.detail?.mode || "replace" });
  };

  _syncSelectionState() {
    const mergedSelections = this.getSelections();
    const currentMode = mergedSelections["resource-mode"]?.[0] || "";

    if (currentMode) {
      this.dataset.currentMode = currentMode;
    } else {
      delete this.dataset.currentMode;
    }

    this.dispatchEvent(
      new CustomEvent("mdb-post-loop-selections", {
        detail: { selections: mergedSelections },
        bubbles: true,
        composed: true,
      })
    );
  }

  _setLoadingState(isLoading) {
    this._loading = Boolean(isLoading);
    this.toggleAttribute("data-loading", this._loading);

    if (this._postsEl) {
      this._postsEl.setAttribute("aria-busy", this._loading ? "true" : "false");
    }
  }

  async fetchPosts({ mode = "replace" } = {}) {
    if (this.hasAttribute("disable-fetch")) {
      return;
    }

    const action = String(
      this.getAttribute("action") || "theme_filtered_posts"
    ).trim();
    const endpoint = String(
      this.getAttribute("endpoint") || "/wp-admin/admin-ajax.php"
    ).trim();
    const postsPerPage =
      Number.parseInt(this.getAttribute("posts-per-page"), 10) || 1;
    const feed = String(this.getAttribute("feed") || "").trim();
    const postType = String(this.getAttribute("post-type") || "").trim();
    const requestSelections = this.getSelections();
    const params = new URLSearchParams();

    params.set("action", action);
    params.set("page", String(this._currentPage));
    params.set("posts_per_page", String(postsPerPage));
    params.set("filters", JSON.stringify(requestSelections));

    if (feed) {
      params.set("feed", feed);
    }

    if (postType) {
      params.set("post_type", postType);
    }

    if (this._abortController) {
      this._abortController.abort();
    }

    this._abortController = new AbortController();
    this._setLoadingState(true);

    const renderPosts = async () => {
      try {
        const requestUrl = new URL(endpoint, document.baseURI);
        params.forEach((value, key) => requestUrl.searchParams.set(key, value));
        const response = await fetch(requestUrl, {
          signal: this._abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const postsHtml = await response.text();
        const totalPages =
          Number.parseInt(response.headers.get("X-WP-TotalPages"), 10) || 1;

        if (this._postsEl) {
          if (mode === "append") {
            this._postsEl.insertAdjacentHTML("beforeend", postsHtml);
          } else {
            this._postsEl.innerHTML = postsHtml;
          }
        }

        this._totalPages = totalPages;
        this.dispatchEvent(
          new CustomEvent("mdb-pagination-data", {
            detail: {
              currentPage: this._currentPage,
              totalPages: this._totalPages,
            },
            bubbles: true,
            composed: true,
          })
        );
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }

        console.error("mdb-post-loop: failed to load posts.", error);

        if (this._postsEl && mode !== "append") {
          this._postsEl.innerHTML =
            '<p class="mdb-post-loop__empty" data-post-feed-empty>Unable to load results right now.</p>';
        }
      } finally {
        this._setLoadingState(false);
      }
    };

    await renderPosts();
  }
}

if (globalThis.customElements && !customElements.get("mdb-post-loop")) {
  customElements.define("mdb-post-loop", MdbPostLoop);
}

export class MdbPostLoopFilters extends LitElement {
  static properties = {
    allLabel: { type: String, attribute: "all-label" },
    filterKey: { type: String, attribute: "filter-key" },
    isMultiple: { type: Boolean, attribute: "multiple" },
    options: { type: String },
    placeholder: { type: String },
    taxonomy: { type: String },
    terms: { state: true },
    ui: { type: String },
  };

  static styles = css`
    :host {
      display: block;
    }

    button,
    select {
      font: inherit;
    }
  `;

  constructor() {
    super();

    this.allLabel = "";
    this.filterKey = "";
    this.isMultiple = false;
    this.options = "";
    this.placeholder = "";
    this.taxonomy = "";
    this.terms = [];
    this.ui = "buttons";
    this._selectedValues = new Set();
  }

  connectedCallback() {
    super.connectedCallback();

    this._loop = this.closest("mdb-post-loop");
    this._loop?.addEventListener(
      "mdb-post-loop-selections",
      this._onSelectionsUpdated
    );
    this._syncFromLoop();

    if (this.taxonomy) {
      this._loadTerms();
    }
  }

  disconnectedCallback() {
    this._loop?.removeEventListener(
      "mdb-post-loop-selections",
      this._onSelectionsUpdated
    );
    super.disconnectedCallback();
  }

  _onSelectionsUpdated = (event) => {
    const selections = event.detail?.selections || {};
    const selectedValues = selections[this._selectionKey()] || [];

    this._selectedValues = new Set(normalizeSelectionValues(selectedValues));
    this.requestUpdate();
  };

  _selectionKey() {
    return String(this.filterKey || this.taxonomy || "").trim();
  }

  _syncFromLoop() {
    if (!this._loop || typeof this._loop.getSelections !== "function") {
      return;
    }

    const selectedValues =
      this._loop.getSelections()[this._selectionKey()] || [];
    this._selectedValues = new Set(normalizeSelectionValues(selectedValues));
  }

  async _loadTerms() {
    try {
      const endpoint = String(
        this.getAttribute("terms-endpoint") || `/wp-json/wp/v2/${this.taxonomy}`
      ).trim();
      const requestUrl = new URL(endpoint, document.baseURI);
      requestUrl.searchParams.set("per_page", "100");
      requestUrl.searchParams.set("context", "view");
      requestUrl.searchParams.set("_fields", "id,name,slug");
      const response = await fetch(requestUrl);

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const terms = await response.json();
      this.terms = Array.isArray(terms)
        ? terms.filter((term) => term?.slug && term.slug !== "uncategorized")
        : [];
    } catch (error) {
      console.error(
        `mdb-post-loop-filters: failed to load "${this.taxonomy}" terms.`,
        error
      );
      this.terms = [];
    }
  }

  _staticOptions() {
    const parsedOptions = parseJsonAttribute(this.options, []);
    if (!Array.isArray(parsedOptions)) {
      return [];
    }

    return parsedOptions
      .map((option) => {
        if (typeof option === "string") {
          return {
            label: option,
            value: option,
          };
        }

        if (!option || typeof option !== "object") {
          return null;
        }

        const value = String(option.value || "").trim();
        const label = String(option.label || value).trim();

        return value && label
          ? {
              label,
              value,
            }
          : null;
      })
      .filter(Boolean);
  }

  _optionsList() {
    if (this.taxonomy) {
      return this.terms.map((term) => ({
        label: term.name,
        value: term.slug,
      }));
    }

    return this._staticOptions();
  }

  _dispatchSelectionChange(nextValues) {
    this.dispatchEvent(
      new CustomEvent("mdb-post-loop-filter-change", {
        detail: {
          key: this._selectionKey(),
          values: normalizeSelectionValues(nextValues),
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  _toggleValue(value) {
    const normalizedValue = String(value || "").trim();
    if (!normalizedValue) {
      this.clear();
      return;
    }

    if (this.ui === "tabs" && this._selectedValues.has(normalizedValue)) {
      return;
    }

    if (!this.isMultiple) {
      this._selectedValues.clear();
    }

    if (this._selectedValues.has(normalizedValue)) {
      this._selectedValues.delete(normalizedValue);
    } else {
      this._selectedValues.add(normalizedValue);
    }

    this._dispatchSelectionChange([...this._selectedValues]);
    this.requestUpdate();
  }

  clear() {
    this._selectedValues.clear();
    this._dispatchSelectionChange([]);
    this.requestUpdate();
  }

  _renderButtons(options, { isTabs = false } = {}) {
    return html`
      <div
        part="filters ${isTabs ? "tabs" : "buttons"}"
        role=${isTabs ? "tablist" : "group"}
      >
        ${
          this.allLabel
            ? html`
                <button
                  type="button"
                  part="button ${this._selectedValues.size === 0 ? "active" : ""}"
                  @click=${this.clear}
                >
                  <slot name="">${this.allLabel}</slot>
                </button>
              `
            : null
        }
        ${options.map(
          (option) => html`
            <button
              type="button"
              role=${isTabs ? "tab" : "button"}
              aria-selected=${isTabs ? String(this._selectedValues.has(option.value)) : nothing}
              part="button ${this._selectedValues.has(option.value) ? "active" : ""}"
              @click=${() => this._toggleValue(option.value)}
            >
              <slot name=${option.value}>${option.label}</slot>
            </button>
          `
        )}
      </div>
    `;
  }

  _renderSelect(options) {
    const currentValue = [...this._selectedValues][0] || "";
    const emptyLabel = this.allLabel || this.placeholder || "All";

    return html`
      <label part="control select-wrapper">
        <span part="label" class="screen-reader-text">${emptyLabel}</span>
        <select
          part="select"
          aria-label=${emptyLabel}
          @change=${(event) => {
            const nextValue = event.target.value;
            this._selectedValues = nextValue ? new Set([nextValue]) : new Set();
            this._dispatchSelectionChange(nextValue ? [nextValue] : []);
            this.requestUpdate();
          }}
        >
          <option value="" ?selected=${currentValue === ""}>
            ${emptyLabel}
          </option>
          ${options.map(
            (option) => html`
              <option
                value=${option.value}
                ?selected=${currentValue === option.value}
              >
                ${option.label}
              </option>
            `
          )}
        </select>
      </label>
    `;
  }

  render() {
    const options = this._optionsList();

    if (this.ui === "select") {
      return this._renderSelect(options);
    }

    if (this.ui === "tabs") {
      return this._renderButtons(options, { isTabs: true });
    }

    return this._renderButtons(options);
  }
}

if (globalThis.customElements && !customElements.get("mdb-post-loop-filters")) {
  customElements.define("mdb-post-loop-filters", MdbPostLoopFilters);
}

export class MdbPostLoopPagination extends LitElement {
  static properties = {
    currentPage: { state: true },
    limit: { type: Number },
    mode: { type: String },
    totalPages: { state: true },
  };

  static styles = css`
    button {
      all: unset;
      cursor: pointer;
    }
  `;

  constructor() {
    super();

    this.currentPage = 1;
    this.limit = 5;
    this.mode = "classic";
    this.totalPages = 1;
    this._hasPaginationData = false;
  }

  connectedCallback() {
    super.connectedCallback();

    this._loop = this.closest("mdb-post-loop");
    this._loop?.addEventListener("mdb-pagination-data", this._onPaginationData);
    this._loop?.addEventListener(
      "mdb-post-loop-selections",
      this._onSelectionsUpdated
    );
    this._syncExhaustedState();
  }

  disconnectedCallback() {
    this._loop?.removeEventListener(
      "mdb-pagination-data",
      this._onPaginationData
    );
    this._loop?.removeEventListener(
      "mdb-post-loop-selections",
      this._onSelectionsUpdated
    );
    super.disconnectedCallback();
  }

  updated(changedProperties) {
    if (
      changedProperties.has("currentPage") ||
      changedProperties.has("mode") ||
      changedProperties.has("totalPages")
    ) {
      this._syncExhaustedState();
    }
  }

  _onPaginationData = (event) => {
    this.currentPage = Number.parseInt(event.detail?.currentPage, 10) || 1;
    this.totalPages = Number.parseInt(event.detail?.totalPages, 10) || 1;
    this._hasPaginationData = true;
    this._syncExhaustedState();
  };

  _onSelectionsUpdated = () => {
    this._hasPaginationData = false;
    this._syncExhaustedState();
  };

  _isExhausted() {
    return (
      this.mode === "load-more" &&
      this._hasPaginationData &&
      this.totalPages >= 1 &&
      this.currentPage >= this.totalPages
    );
  }

  _syncExhaustedState() {
    this.toggleAttribute("exhausted", this._isExhausted());
  }

  _goTo(page) {
    this.dispatchEvent(
      new CustomEvent("mdb-page-selected", {
        detail: {
          page,
          mode: this.mode === "load-more" ? "append" : "replace",
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  _getPageRange() {
    const pageRange = [];
    const halfRange = Math.floor(this.limit / 2);
    let start = Math.max(1, this.currentPage - halfRange);
    const end = Math.min(this.totalPages, start + this.limit - 1);

    if (end - start < this.limit - 1) {
      start = Math.max(1, end - this.limit + 1);
    }

    for (let page = start; page <= end; page += 1) {
      pageRange.push(page);
    }

    return pageRange;
  }

  _renderLoadMorePagination() {
    if (this.totalPages <= 1 || this.currentPage >= this.totalPages) {
      return null;
    }

    return html`
      <nav part="pagination">
        <button part="button" @click=${() => this._goTo(this.currentPage + 1)}>
          <slot name="next">Load More</slot>
        </button>
      </nav>
    `;
  }

  _renderClassicPagination() {
    if (this.totalPages <= 1) {
      return null;
    }

    const pages = this._getPageRange();

    return html`
      <nav part="pagination">
        <button
          part="button"
          ?disabled=${this.currentPage === 1}
          @click=${() => this._goTo(this.currentPage - 1)}
        >
          <slot name="prev">‹</slot>
        </button>

        ${pages.map((page) =>
          page === this.currentPage
            ? html`<span part="button active">${page}</span>`
            : html`
                <button part="button" @click=${() => this._goTo(page)}>
                  ${page}
                </button>
              `
        )}

        <button
          part="button"
          ?disabled=${this.currentPage === this.totalPages}
          @click=${() => this._goTo(this.currentPage + 1)}
        >
          <slot name="next">›</slot>
        </button>
      </nav>
    `;
  }

  render() {
    return this.mode === "load-more"
      ? this._renderLoadMorePagination()
      : this._renderClassicPagination();
  }
}

if (
  globalThis.customElements &&
  !customElements.get("mdb-post-loop-pagination")
) {
  customElements.define("mdb-post-loop-pagination", MdbPostLoopPagination);
}
