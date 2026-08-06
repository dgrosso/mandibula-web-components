# Mandíbula Web Components

Framework-agnostic custom elements built with Lit. Every component is an independent npm workspace package under `packages/` and registers only its own `mdb-*` element(s).

[Interactive demos](https://dgrosso.github.io/mandibula-web-components/) · [Implementation and accessibility audit](docs/component-audit.md)

## Install one component

```sh
npm install @mandibula/spinner
```

The project supports two independent distribution targets. GitHub Release tarballs are usable even when a package has not been published to npm; npm installation works only for packages that maintainers have explicitly published under the `@mandibula` scope.

### Install from a GitHub Release

Release assets use the `mandibula-<package>-<version>.tgz` filename convention. Find the release tag and exact asset filename in the repository’s Releases page or its `release-manifest.json`, then install the tarball:

```sh
npm install https://github.com/dgrosso/mandibula-web-components/releases/download/<release-tag>/mandibula-spinner-<version>.tgz
npm install https://github.com/dgrosso/mandibula-web-components/releases/download/<release-tag>/mandibula-web-components-<version>.tgz
```

GitHub artifacts rewrite internal `@mandibula/*` dependencies to tarballs from the same release, so the aggregate package does not depend on npm availability. A lockfile pins those GitHub tarball URLs.

### Install from npm

```sh
npm install @mandibula/spinner
npm install @mandibula/web-components
```

Npm artifacts retain normal semver dependencies between `@mandibula/*` packages. Their resolved versions are pinned in a lockfile. Publishing requires authorization to the `@mandibula` npm scope; no claim is made here that every package is currently available on npm.

Import an individual package or the aggregate collection as follows:

```js
import "@mandibula/spinner";
import "@mandibula/web-components";
```

The same imports work after installing the corresponding GitHub tarball. GitHub and npm package metadata share the checked-in workspace versions, while only temporary GitHub packaging metadata contains release asset URLs.

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
| `@mandibula/responsive-text`   | `mdb-responsive-text`   |
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

### Pre-1.0 release policy

During initial development, public packages remain in the `0.x` range. This repository’s chosen convention is:

- breaking changes before `1.0.0` use a `minor` Changeset;
- backward-compatible features also use `minor`;
- fixes use `patch`;
- `major` Changesets are blocked for packages whose current version is below `1.0.0`.

Moving to `1.0.0` requires an explicit release-policy decision and a corresponding validator update. The repository is not currently using Changesets prerelease mode or versions such as `0.2.0-beta.0`.

The project is licensed under MIT.
