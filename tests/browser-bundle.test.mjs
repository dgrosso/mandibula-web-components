import assert from "node:assert/strict";
import { lstatSync, readlinkSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  buildBrowserBundle,
  discoverBrowserBundlePackages,
  normalizeBrowserBundleSelection,
  summarizeBrowserBundleDependencies,
  validateBrowserBundleOutput,
} from "../scripts/browser-bundle-lib.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

function fileState(path) {
  try {
    const stat = lstatSync(path);
    return {
      directory: stat.isDirectory(),
      symlink: stat.isSymbolicLink(),
      target: stat.isSymbolicLink() ? readlinkSync(path) : null,
    };
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function outputChunk(overrides = {}) {
  return {
    type: "chunk",
    fileName: "bundle.js",
    isEntry: true,
    code: "customElements.define('mdb-test', class {});",
    imports: [],
    dynamicImports: [],
    modules: {},
    ...overrides,
  };
}

async function createWorkspace(root, packageName, exports, files) {
  const packageDirectory = join(root, "packages", packageName);
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ private: true, workspaces: ["packages/*"] })
  );
  await writeFile(
    join(packageDirectory, "package.json"),
    JSON.stringify({
      name: `@mandibula/${packageName}`,
      version: "1.0.0",
      license: "MIT",
      files: ["src"],
      exports,
    })
  );
  for (const [path, contents] of Object.entries(files)) {
    const filePath = join(packageDirectory, path);
    await mkdir(join(filePath, ".."), { recursive: true });
    await writeFile(filePath, contents);
  }
  return packageDirectory;
}

test("discovers Mandíbula packages from workspace metadata", async (t) => {
  const packages = await discoverBrowserBundlePackages();
  assert.ok(packages.some((pkg) => pkg.name === "@mandibula/slider"));
  assert.ok(packages.some((pkg) => pkg.name === "@mandibula/video"));

  const root = await mkdtemp(join(tmpdir(), "mandibula-bundle-discovery-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ private: true, workspaces: ["components/*"] })
  );
  const directory = join(
    root,
    "components",
    "directory-name-is-not-the-package-name"
  );
  await mkdir(join(directory, "src"), { recursive: true });
  const packageManifest = {
    name: "@mandibula/metadata-name",
    version: "1.2.3",
    license: "MIT",
    files: ["src"],
    exports: {
      ".": {
        browser: ["./src/missing-entry.js", "./src/index.js"],
        import: "./src/index.js",
      },
    },
  };
  const packageManifestPath = join(directory, "package.json");
  await writeFile(packageManifestPath, JSON.stringify(packageManifest));
  await writeFile(join(directory, "src", "index.js"), "export {};\n");

  assert.deepEqual(await discoverBrowserBundlePackages(root), [
    {
      name: "@mandibula/metadata-name",
      shortName: "metadata-name",
      version: "1.2.3",
      packagePath: "components/directory-name-is-not-the-package-name",
      rootExport: "./src/index.js",
    },
  ]);
  assert.equal(
    (await discoverBrowserBundlePackages(root))[0].rootExport,
    "./src/index.js"
  );
  await writeFile(
    packageManifestPath,
    JSON.stringify({
      ...packageManifest,
      exports: {
        ".": {
          browser: "./src/missing-entry.js",
          import: "./src/index.js",
        },
      },
    })
  );
  await assert.rejects(
    discoverBrowserBundlePackages(root),
    /must expose a compatible public root/
  );
});

test("conditional export null blocks active browser targets terminally", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "mandibula-conditional-exports-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const checkExports = async (exports, expected) => {
    await createWorkspace(root, "condition-fixture", exports, {
      "src/browser.js": "export {};\n",
      "src/fallback.js": "export {};\n",
    });
    if (expected) {
      const [pkg] = await discoverBrowserBundlePackages(root);
      assert.equal(pkg.rootExport, expected);
    } else {
      await assert.rejects(
        discoverBrowserBundlePackages(root),
        /must expose a compatible public root/
      );
    }
  };

  await checkExports(
    { ".": { browser: null, default: "./src/fallback.js" } },
    null
  );
  await checkExports(
    {
      ".": {
        browser: { import: null, default: "./src/fallback.js" },
        default: "./src/fallback.js",
      },
    },
    null
  );
  await checkExports(
    {
      ".": {
        "custom-condition": null,
        browser: "./src/browser.js",
        default: "./src/fallback.js",
      },
    },
    "./src/browser.js"
  );
  await checkExports(
    { ".": { browser: "./src/browser.js", import: "./src/fallback.js" } },
    "./src/browser.js"
  );
  await checkExports(
    { ".": { import: "./src/fallback.js", default: "./src/browser.js" } },
    "./src/fallback.js"
  );
  await checkExports(
    {
      ".": {
        "custom-condition": "./src/missing.js",
        default: "./src/fallback.js",
      },
    },
    "./src/fallback.js"
  );
});

test("export pattern matching uses suffix specificity independent of order", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "mandibula-export-patterns-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = {
    "src/index.js":
      'import "@mandibula/pattern-fixture/widget.js"; import "@mandibula/pattern-fixture/only.js"; import "@mandibula/pattern-fixture/theme";\n',
    "src/exact/widget.js": "globalThis.patternTarget = 'exact';\n",
    "src/specific/only.js": "globalThis.patternTarget = 'specific';\n",
    "src/general/only.js": "globalThis.patternTarget = 'general';\n",
    "src/general/theme": "globalThis.patternTarget = 'wildcard';\n",
  };
  const buildAndAssert = async (exports) => {
    await createWorkspace(root, "pattern-fixture", exports, files);
    const result = await buildBrowserBundle({
      packages: ["pattern-fixture"],
      root,
      format: "esm",
    });
    const moduleIds = result.moduleGraph.modules.map((module) => module.id);
    assert.ok(
      moduleIds.includes("@mandibula/pattern-fixture@1.0.0/src/exact/widget.js")
    );
    assert.ok(
      moduleIds.includes(
        "@mandibula/pattern-fixture@1.0.0/src/specific/only.js"
      )
    );
    assert.ok(
      moduleIds.includes("@mandibula/pattern-fixture@1.0.0/src/general/theme")
    );
    assert.ok(
      !moduleIds.includes(
        "@mandibula/pattern-fixture@1.0.0/src/general/only.js"
      )
    );
  };

  await buildAndAssert({
    ".": "./src/index.js",
    "./*": "./src/general/*",
    "./*.js": "./src/specific/*.js",
    "./widget.js": "./src/exact/widget.js",
  });
  await buildAndAssert({
    ".": "./src/index.js",
    "./*.js": "./src/specific/*.js",
    "./*": "./src/general/*",
    "./widget.js": "./src/exact/widget.js",
  });
});

test("normalizes short and canonical names deterministically", async () => {
  const shortNames = await normalizeBrowserBundleSelection(["video", "slider"]);
  const canonicalNames = await normalizeBrowserBundleSelection([
    "@mandibula/slider",
    "@mandibula/video",
  ]);
  const duplicates = await normalizeBrowserBundleSelection([
    "slider",
    "video",
    "video",
  ]);

  assert.deepEqual(shortNames, ["@mandibula/slider", "@mandibula/video"]);
  assert.deepEqual(canonicalNames, shortNames);
  assert.deepEqual(duplicates, shortNames);
});

test("preserves dependency versions and rejects multiple Lit runtime versions", () => {
  assert.deepEqual(
    summarizeBrowserBundleDependencies([
      { packageName: "shared-library", version: "2.0.0" },
      { packageName: "shared-library", version: "1.0.0" },
      { packageName: "unversioned-library", version: null },
      { packageName: "@mandibula/local-package", version: "1.0.0" },
    ]),
    [
      { name: "shared-library", version: "1.0.0" },
      { name: "shared-library", version: "2.0.0" },
      { name: "unversioned-library", version: null },
    ]
  );
  assert.deepEqual(
    summarizeBrowserBundleDependencies([
      { packageName: "@lit-labs/build-tools", version: "1.0.0" },
      { packageName: "@lit-labs/build-tools", version: "2.0.0" },
    ]),
    [
      { name: "@lit-labs/build-tools", version: "1.0.0" },
      { name: "@lit-labs/build-tools", version: "2.0.0" },
    ]
  );

  for (const packageName of [
    "lit",
    "lit-element",
    "lit-html",
    "@lit/reactive-element",
    "@lit/context",
    "@lit-labs/ssr-dom-shim",
  ]) {
    assert.throws(
      () =>
        summarizeBrowserBundleDependencies([
          { packageName, version: "1.0.0" },
          { packageName, version: "2.0.0" },
        ]),
      (error) =>
        error.message.includes(packageName) &&
        error.message.includes("1.0.0") &&
        error.message.includes("2.0.0")
    );
  }
  assert.throws(
    () =>
      summarizeBrowserBundleDependencies([
        {
          id: "@lit/reactive-element@2.1.2/src/decorators.js",
          packageName: "@lit/reactive-element",
          version: "2.1.2",
        },
        {
          id: "@lit/reactive-element@2.1.2/src/decorators.js",
          packageName: "@lit/reactive-element",
          version: "2.1.2",
        },
      ]),
    /Duplicate Lit runtime module identity/
  );
});

test("rejects invalid package selections with actionable messages", async () => {
  await assert.rejects(normalizeBrowserBundleSelection([]), /one or more/);
  await assert.rejects(
    normalizeBrowserBundleSelection(["unknown"]),
    /Unknown Mandíbula workspace package.*Choose one of/
  );
  await assert.rejects(
    normalizeBrowserBundleSelection(["mdb-video"]),
    /Use "video"/
  );
  await assert.rejects(
    normalizeBrowserBundleSelection(["packages/slider/src/index.js"]),
    /Source paths and package subpaths/
  );
  await assert.rejects(
    normalizeBrowserBundleSelection(["@mandibula/video/unresolved.css"]),
    /Package subpaths are not selectable/
  );
  await assert.rejects(
    normalizeBrowserBundleSelection(["https://example.com/video.js"]),
    /URLs are not valid/
  );
  await assert.rejects(
    normalizeBrowserBundleSelection(["lit"]),
    /Unknown Mandíbula workspace package/
  );
});

test("IIFE build bundles local slider and video without creating a workspace link", async () => {
  const sliderLink = join(
    repositoryRoot,
    "node_modules",
    "@mandibula",
    "slider"
  );
  const before = fileState(sliderLink);
  const result = await buildBrowserBundle({
    packages: ["slider", "video"],
    format: "iife",
    minify: true,
  });

  assert.deepEqual(fileState(sliderLink), before);
  assert.deepEqual(result.selectedPackages, [
    "@mandibula/slider",
    "@mandibula/video",
  ]);
  assert.deepEqual(result.resolvedWorkspacePackages, [
    "@mandibula/slider",
    "@mandibula/video",
  ]);
  assert.deepEqual(
    result.workspacePackages.map((pkg) => pkg.name),
    ["@mandibula/slider", "@mandibula/video"]
  );
  assert.equal(result.format, "iife");
  assert.equal(result.minified, true);
  assert.ok(result.byteSize > 0);
  assert.deepEqual(result.moduleGraph.staticImports, []);
  assert.deepEqual(result.moduleGraph.dynamicImports, []);
  assert.deepEqual(result.outputContract, {
    javascriptChunks: 1,
    runtimeAssets: [],
  });
  assert.ok(!result.code.includes(repositoryRoot));
  assert.ok(
    result.moduleGraph.modules.every(
      (module) => !module.id.includes(repositoryRoot)
    )
  );
  assertLitRuntimeIsDeduplicated(result.moduleGraph.modules);
});

test("ESM build is a self-contained single entry", async () => {
  const result = await buildBrowserBundle({
    packages: ["video", "slider"],
    format: "esm",
  });

  assert.equal(result.format, "esm");
  assert.equal(result.minified, false);
  assert.deepEqual(result.resolvedWorkspacePackages, [
    "@mandibula/slider",
    "@mandibula/video",
  ]);
  assert.deepEqual(result.moduleGraph.staticImports, []);
  assert.deepEqual(result.moduleGraph.dynamicImports, []);
  assert.deepEqual(result.outputContract, {
    javascriptChunks: 1,
    runtimeAssets: [],
  });
  assertLitRuntimeIsDeduplicated(result.moduleGraph.modules);
});

test("returns requested sourcemaps in memory without absolute paths", async () => {
  const result = await buildBrowserBundle({
    packages: ["slider"],
    format: "esm",
    sourcemap: true,
  });
  const sourceMap = JSON.parse(result.sourceMap);

  assert.ok(result.sourceMap.length > 0);
  assert.ok(!result.sourceMap.includes(repositoryRoot));
  assert.ok(
    sourceMap.sources.some((source) => source.startsWith("@mandibula/slider/"))
  );
});

test("transitive Mandíbula imports resolve from workspace exports", async () => {
  const result = await buildBrowserBundle({ packages: ["media-slot"] });
  const resolved = new Set(result.resolvedWorkspacePackages);

  for (const name of [
    "@mandibula/media-slot",
    "@mandibula/scoped-inline-svg",
    "@mandibula/spinner",
    "@mandibula/suspense",
    "@mandibula/video",
  ]) {
    assert.ok(
      resolved.has(name),
      `${name} was not resolved from the workspace`
    );
  }
  assert.ok(result.workspacePackages.length >= 5);
  assert.deepEqual(result.moduleGraph.staticImports, []);
  assert.deepEqual(result.moduleGraph.dynamicImports, []);
  assert.deepEqual(result.outputContract, {
    javascriptChunks: 1,
    runtimeAssets: [],
  });
});

test("rejects Vite browser-compatibility replacement modules", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "mandibula-browser-external-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const packageDirectory = join(root, "packages", "node-builtin-fixture");
  await mkdir(join(packageDirectory, "src"), { recursive: true });
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ private: true, workspaces: ["packages/*"] })
  );
  await writeFile(
    join(packageDirectory, "package.json"),
    JSON.stringify({
      name: "@mandibula/node-builtin-fixture",
      version: "1.0.0",
      license: "MIT",
      files: ["src"],
      exports: { ".": "./src/index.js" },
    })
  );
  await writeFile(
    join(packageDirectory, "src", "index.js"),
    'import { readFileSync } from "node:fs"; globalThis.fixtureRead = readFileSync;\n'
  );

  await assert.rejects(
    buildBrowserBundle({ packages: ["node-builtin-fixture"], root }),
    (error) =>
      error.message.includes("__vite-browser-external") &&
      error.message.includes(
        "@mandibula/node-builtin-fixture@1.0.0/src/index.js"
      )
  );

  await writeFile(
    join(packageDirectory, "package.json"),
    JSON.stringify({
      name: "@mandibula/node-builtin-fixture",
      version: "1.0.0",
      license: "MIT",
      files: ["src"],
      exports: { ".": "./src/index.js" },
      peerDependencies: { "missing-optional-peer": "^1.0.0" },
      peerDependenciesMeta: {
        "missing-optional-peer": { optional: true },
      },
    })
  );
  await writeFile(
    join(packageDirectory, "src", "index.js"),
    'import optionalPeer from "missing-optional-peer"; globalThis.fixturePeer = optionalPeer;\n'
  );
  await assert.rejects(
    buildBrowserBundle({ packages: ["node-builtin-fixture"], root }),
    (error) =>
      error.message.includes("__vite-optional-peer-dep") &&
      error.message.includes(
        "@mandibula/node-builtin-fixture@1.0.0/src/index.js"
      )
  );
});

test("validates output-contract failures instead of accepting companion files", () => {
  const validated = validateBrowserBundleOutput([
    outputChunk({
      modules: { [join(repositoryRoot, "packages/video/src/index.js")]: {} },
    }),
  ]);
  assert.equal("moduleIds" in validated, false);

  assert.throws(
    () => validateBrowserBundleOutput([outputChunk({ imports: ["lit"] })]),
    /static runtime imports or external modules/
  );
  assert.throws(
    () =>
      validateBrowserBundleOutput([
        outputChunk({ dynamicImports: ["lazy.js"] }),
      ]),
    /dynamic runtime imports/
  );
  assert.throws(
    () =>
      validateBrowserBundleOutput([
        outputChunk(),
        outputChunk({ isEntry: false }),
      ]),
    /exactly one executable JavaScript chunk/
  );
  assert.throws(
    () =>
      validateBrowserBundleOutput([
        outputChunk(),
        { type: "asset", fileName: "style.css", source: ".x{}" },
      ]),
    /does not allow runtime assets/
  );
});

function assertLitRuntimeIsDeduplicated(modules) {
  const identities = modules.map((module) => module.id);
  assert.equal(new Set(identities).size, identities.length);
  const litEntryModules = modules.filter(
    (module) => module.packageName === "lit" && module.id.endsWith("/index.js")
  );
  assert.equal(litEntryModules.length, 1);
  assert.ok(
    modules.some((module) => module.packageName === "@lit/reactive-element")
  );
}
