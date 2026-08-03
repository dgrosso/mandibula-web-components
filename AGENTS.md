# AGENTS.md

This file is the source of truth for contributors and coding agents working in this repository.

## Project purpose

Mandíbula Web Components is an open-source npm monorepo of framework-agnostic custom elements built with Lit. Components must work in plain HTML, React, Vue, Svelte, Angular, SSR imports, and standards-based environments without requiring the complete collection.

## Repository layout

- `packages/<name>/`: one independently publishable `@mandibula/<name>` package.
- `packages/web-components/`: optional aggregate package; never import it from an individual package.
- `demo/`: multi-page Vite demo site; one page per package/component family.
- `docs/`: interoperability and audit documentation.
- `tests/`: browser, accessibility, behavior, registry, and SSR tests.
- `.github/workflows/`: CI, release, and GitHub Pages deployment.

## Naming and public API

- Custom elements: `mdb-*`.
- JavaScript classes: `Mdb*`.
- Events, CSS classes, parts, data attributes, IDs, and custom properties owned by the project: `mdb-*` or `--mdb-*`.
- npm packages: `@mandibula/*`.
- Never reintroduce `ona-*`, `Ona*`, `--ona-*`, or theme-specific `--t-*` APIs.
- Public custom events must bubble and be composed when consumers need to observe them outside a shadow root.
- Guard registrations with `globalThis.customElements` and `customElements.get()` so imports are idempotent and SSR-safe.

## Package isolation

- Every package must import only Lit and its explicit `@mandibula/*` dependencies.
- Do not make an individual package depend on `@mandibula/web-components`.
- Add internal dependencies to that package's `package.json` using the current workspace version range.
- Keep package exports, README, Custom Elements Manifest, and optional CSS subpaths synchronized.
- `npm run publint` must pass for every publishable workspace.

## Lit conventions

- All registered custom elements extend `LitElement`.
- Prefer declarative `render()` output and reactive properties.
- Preserve light DOM only when authored semantics, framework content, or WordPress interoperability requires it.
- Call Lit lifecycle super methods when overriding `connectedCallback()` or `disconnectedCallback()`.
- Clean up observers, timers, animation frames, global listeners, object URLs, and embedded players.
- Sanitize fetched markup before inserting it. Never trust remote SVG or HTML.

## HTML and accessibility

- Prefer native HTML semantics over ARIA and custom interaction code.
- Use `<button type="button">` for actions and `<a href>` for navigation.
- Preserve visible `:focus-visible` styles and logical keyboard order; never use positive `tabindex`.
- Interactive names must come from visible text, labels, `aria-labelledby`, or a documented label attribute.
- Respect `prefers-reduced-motion`; decorative motion must be removable without losing functionality.
- Use native `<dialog>.showModal()` for new modal work. The current modal container/focus-trap architecture is legacy and should be replaced in the next major version, not extended.
- Do not put list roles on buttons or otherwise overwrite native control semantics.
- Media requires useful `alt`, captions/transcripts where applicable, dimensions/aspect ratio, and no autoplay audio.
- Automated axe checks are required, but keyboard and screen-reader behavior still needs manual review.

## Modern web and browser policy

- Target Baseline Widely Available features for core behavior.
- Baseline Newly Available features may be progressive enhancements only when feature-detected and able to degrade gracefully.
- Gate scroll-driven animations with `@supports ((animation-timeline: view()) and (animation-range: entry))`; do not ship a scroll-timeline polyfill.
- Prefer native scroll snap, IntersectionObserver, ResizeObserver, logical properties, container queries, and modern media queries.
- Use passive listeners for scroll, touch, and wheel unless `preventDefault()` is required.
- Avoid layout reads and writes in the same loop; batch work with `requestAnimationFrame()` when necessary.

## Demo site

- Every package/component family has `demo/<name>/index.html` with multiple meaningful examples.
- Demo pages use semantic landmarks, a skip link, one `<h1>`, sequential headings, and shared `demo/styles.css`.
- Examples must expose important options, methods, slots, parts, states, and events without depending on a private API.
- Demo JavaScript belongs in `demo/examples.js`; avoid inline event handlers.
- The site must build with `npm run demo:build` and work under the GitHub project Pages base path.

## Testing and verification

- `npm test`: browser behavior plus isolated SSR imports.
- `npm run test:browser`: Web Test Runner in Chrome/Chromium.
- `npm run lint`: ESLint.
- `npm run format:check`: Prettier.
- `npm run manifest`: regenerate per-package Custom Elements Manifests after public API changes.
- `npm run publint`: validate npm package metadata and packed files.
- `npm run demo:build`: production-build the complete demo site.
- `npm run check`: required before completion; it must include formatting, lint, tests, manifests, package validation, and demo build.
- Do not claim success from a partial command or an earlier run.

## GitHub and releases

- The public repository is `dgrosso/mandibula-web-components`.
- Default development branch: `development` until maintainers intentionally adopt `main`.
- User-visible package changes require a Changeset.
- CI must pass before merging. Releases use npm provenance and least-privilege GitHub Actions permissions.
- GitHub Pages deploys the generated demo artifact through Actions; never commit generated `site/` output.

## Security and compatibility

- Do not expose secrets, tokens, or local paths in source or workflow output.
- Treat remote SVG, embeds, URLs, and post-loop responses as untrusted input.
- Preserve backward compatibility within a major version. Deprecate first, document migration, then remove in a major release.
- Keep the legacy theme unchanged until published packages are available and its migration is explicitly requested.
