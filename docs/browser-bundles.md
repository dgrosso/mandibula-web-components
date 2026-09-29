# Browser bundles

A browser bundle combines selected Mandíbula workspace packages and the executable dependencies they use into one JavaScript file. It is intended for browser pages that do not run a consumer-side npm install or bundler. The generated file registers the selected custom elements when loaded.

Build one or more packages by their short names or canonical package names:

```sh
npm run build:browser -- video
npm run build:browser -- video slider
npm run build:browser -- @mandibula/video @mandibula/slider
```

Package selection is normalized and sorted, so input ordering does not change artifact names or metadata. By default the command creates a minified IIFE bundle without a source map in `dist/browser/`.

Filenames use `mandibula-<sorted-package-slugs>.<format>[.min].js`; multiple package slugs are joined with `+`. The matching metadata sidecar uses `.json`, and a requested source map uses `.js.map`.

Choose ESM, change minification, or request a source map with:

```sh
npm run build:browser -- slider video --format esm
npm run build:browser -- video --no-minify
npm run build:browser -- media-slot --sourcemap
npm run build:browser -- video --format esm --out-dir ./build/browser
```

The supported options are `--format iife|esm`, `--out-dir <path>`, `--minify`, `--no-minify`, `--sourcemap`, and `--no-sourcemap`. IIFE is the default for a classic script element; ESM can be loaded with a module script. Source maps are off by default.

For example, an IIFE bundle can be loaded without resolving imports in the consuming page:

```html
<script src="./mandibula-video.iife.min.js"></script>
<mdb-video src="/media/example.mp4"></mdb-video>
```

Each build writes the JavaScript bundle, a deterministic JSON metadata sidecar, and—when requested—a source map next to it. The metadata records the selected packages, included workspace versions, third-party dependency identities, build options, filenames, JavaScript byte size, and SHA-256 digest. It contains no timestamps or local filesystem paths.

The browser-bundle contract requires exactly one executable JavaScript file and no external runtime imports, dynamic chunks, extracted styles, or companion runtime assets. Dependencies used by the selected components are included in the bundle. Rebuilding the same selection and options replaces only those artifact files; other bundles in the output directory are left in place.
