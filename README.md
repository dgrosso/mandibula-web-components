# Mandíbula Web Components

Framework-agnostic custom elements built with Lit. Every component is an independent npm workspace package under `packages/` and registers only its own `mdb-*` element(s).

[Interactive demos](https://dgrosso.github.io/mandibula-web-components/) · [Implementation and accessibility audit](docs/component-audit.md)

## Install one component

```sh
npm install @mandibula/spinner
```

```html
<script type="module">
  import "https://esm.sh/@mandibula/spinner";
</script>

<span role="status">
  <mdb-spinner aria-hidden="true"></mdb-spinner>
  Loading
</span>
```

Bundlers can use `import "@mandibula/spinner"`. The optional `@mandibula/web-components` package registers the full collection.

## Frameworks

The components use standard attributes, properties, slots, CSS custom properties, methods, and composed DOM events.

React 19+ renders custom elements directly:

```jsx
import "@mandibula/spinner";

export function Loading() {
  return (
    <span role="status">
      <mdb-spinner aria-hidden="true"></mdb-spinner>
      Loading
    </span>
  );
}
```

For custom events in any framework, attach a native listener to the element. In React, use a ref when the framework version does not map that event automatically.

See [framework interoperability](docs/frameworks.md) for React, Vue, and plain HTML examples.

## Packages

| Package                        | Elements                |
| ------------------------------ | ----------------------- |
| `@mandibula/fader`             | `mdb-fader`             |
| `@mandibula/media-slot`        | `mdb-media-slot`        |
| `@mandibula/pointer`           | `mdb-pointer`           |
| `@mandibula/scoped-inline-svg` | `mdb-scoped-inline-svg` |
| `@mandibula/spinner`           | `mdb-spinner`           |
| `@mandibula/suspense`          | `mdb-suspense`          |
| `@mandibula/video`             | `mdb-video`             |

## Development

```sh
npm install
npm test
npm run check
npm run storybook
```

Run `npm run demo:build` to validate and produce the static Storybook in `site/`.
To open the development Storybook from another device, allow its hostname:

```sh
STORYBOOK_ALLOWED_HOSTS=100.119.211.103 npm run storybook -- --host 0.0.0.0 --no-open
```

Package releases use Changesets. Public APIs are described by generated Custom Elements Manifests.

The project is licensed under MIT.
