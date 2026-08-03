# Mandíbula Web Components

Framework-agnostic custom elements built with Lit. Every component is an independent npm workspace package under `packages/` and registers only its own `mdb-*` element(s).

[Interactive demos](https://dgrosso.github.io/mandibula-web-components/) · [Implementation and accessibility audit](docs/component-audit.md)

## Install one component

```sh
npm install @mandibula/counter
```

```html
<script type="module">
  import "https://esm.sh/@mandibula/counter";
</script>

<mdb-counter value="1200" duration="800"></mdb-counter>
```

Bundlers can use `import "@mandibula/counter"`. The optional `@mandibula/web-components` package registers the full collection.

## Frameworks

The components use standard attributes, properties, slots, CSS custom properties, methods, and composed DOM events.

React 19+ renders custom elements directly:

```jsx
import "@mandibula/counter";

export function Total() {
  return <mdb-counter value={1200}></mdb-counter>;
}
```

For custom events in any framework, attach a native listener to the element. In React, use a ref when the framework version does not map that event automatically.

See [framework interoperability](docs/frameworks.md) for React, Vue, and plain HTML event examples. Components with light-DOM layout styles expose them as package subpaths, such as `@mandibula/carousel/styles.css` and `@mandibula/modal/styles.css`.

## Packages

| Package                              | Elements                                                             |
| ------------------------------------ | -------------------------------------------------------------------- |
| `@mandibula/accessible-menu`         | `mdb-accessible-menu`                                                |
| `@mandibula/carousel`                | `mdb-carousel`                                                       |
| `@mandibula/clickable-area`          | `mdb-clickable-area`                                                 |
| `@mandibula/collapsible`             | `mdb-collapsible`                                                    |
| `@mandibula/counter`                 | `mdb-counter`                                                        |
| `@mandibula/document-preview-button` | `mdb-document-preview-button`                                        |
| `@mandibula/fader`                   | `mdb-fader`                                                          |
| `@mandibula/media-slot`              | `mdb-media-slot`                                                     |
| `@mandibula/modal`                   | `mdb-modal`, `mdb-modal-container`                                   |
| `@mandibula/pagination`              | `mdb-pagination`                                                     |
| `@mandibula/paper`                   | `mdb-paper`                                                          |
| `@mandibula/pointer`                 | `mdb-pointer`                                                        |
| `@mandibula/post-loop`               | `mdb-post-loop`, `mdb-post-loop-filters`, `mdb-post-loop-pagination` |
| `@mandibula/responsive-text`         | `mdb-responsive-text`                                                |
| `@mandibula/scoped-inline-svg`       | `mdb-scoped-inline-svg`                                              |
| `@mandibula/spinner`                 | `mdb-spinner`                                                        |
| `@mandibula/suspense`                | `mdb-suspense`                                                       |
| `@mandibula/video`                   | `mdb-video`                                                          |
| `@mandibula/video-modal-button`      | `mdb-video-modal-button`                                             |

## Development

```sh
npm install
npm test
npm run check
npm run demo
```

Package releases use Changesets. Public APIs are described by generated Custom Elements Manifests.

The project is licensed under MIT.
