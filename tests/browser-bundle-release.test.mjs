import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { prepareBrowserBundleRelease } from "../scripts/browser-bundle-release-lib.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const cliPath = join(repositoryRoot, "scripts/browser-bundle-release.mjs");
const commitSha = "7904aee857efe26a8e3a66e3c2d0f20be3437624";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "mandibula-browser-release-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ private: true, workspaces: ["packages/*"] })
  );
  await symlink(
    join(repositoryRoot, "node_modules"),
    join(root, "node_modules"),
    "dir"
  );
  async function pkg(shortName, source, dependencies = {}) {
    const directory = join(root, "packages", shortName);
    await mkdir(join(directory, "src"), { recursive: true });
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({
        name: `@mandibula/${shortName}`,
        version: "1.2.3",
        license: "MIT",
        files: ["src"],
        exports: { ".": "./src/index.js" },
        ...(Object.keys(dependencies).length ? { dependencies } : {}),
      })
    );
    await writeFile(join(directory, "src/index.js"), source);
  }
  await pkg(
    "base",
    'import { LitElement } from "lit";\nexport class Base extends LitElement {}\n'
  );
  await pkg(
    "outer",
    'import { Base } from "@mandibula/base";\nexport class Outer extends Base {}\n',
    { "@mandibula/base": "^1.0.0" }
  );
  await pkg("zeta", "globalThis.zetaLoaded = true;\n");
  return root;
}

test("builds one sorted, deterministic release bundle per eligible package with exact manifest integrity", async (t) => {
  const root = await fixture(t);
  const output = join(root, "release-artifacts/browser");
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "keep.txt"), "preserve\n");
  const first = await prepareBrowserBundleRelease({
    root,
    tag: "release-pinned",
    output,
    commitSha,
  });
  const firstNames = await readdir(output);
  const firstBytes = new Map(
    await Promise.all(
      first.assets.map(async (name) => [
        name,
        await readFile(join(output, name)),
      ])
    )
  );
  const firstManifestBytes = await readFile(
    join(output, "browser-bundle-manifest.json")
  );
  const second = await prepareBrowserBundleRelease({
    root,
    tag: "release-pinned",
    output,
    commitSha,
  });
  const secondManifestBytes = await readFile(
    join(output, "browser-bundle-manifest.json")
  );
  assert.deepEqual(
    first.assets.filter((name) => name.endsWith(".js")),
    [
      "mandibula-base.iife.min.js",
      "mandibula-outer.iife.min.js",
      "mandibula-zeta.iife.min.js",
    ]
  );
  assert.deepEqual(second.assets, first.assets);
  assert.deepEqual(secondManifestBytes, firstManifestBytes);
  assert.deepEqual(await readdir(output), firstNames);
  assert.equal(await readFile(join(output, "keep.txt"), "utf8"), "preserve\n");
  const manifest = JSON.parse(firstManifestBytes);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.distributionTarget, "github-release-browser-bundles");
  assert.equal(manifest.releaseTag, "release-pinned");
  assert.equal(manifest.commitSha, commitSha);
  assert.deepEqual(
    manifest.bundles.map((bundle) => bundle.package.name),
    ["@mandibula/base", "@mandibula/outer", "@mandibula/zeta"]
  );
  assert.equal(Object.hasOwn(manifest, "generatedAt"), false);
  assert.ok(
    manifest.thirdPartyLicenses.some(
      (license) => license.name === "lit" && license.license === "BSD-3-Clause"
    )
  );
  const outer = manifest.bundles.find(
    (bundle) => bundle.package.name === "@mandibula/outer"
  );
  assert.deepEqual(outer.workspacePackages, [
    { name: "@mandibula/base", version: "1.2.3" },
    { name: "@mandibula/outer", version: "1.2.3" },
  ]);
  assert.ok(
    outer.dependencies.some(
      (dependency) => dependency.name === "lit" && dependency.version
    )
  );
  for (const bundle of manifest.bundles) {
    assert.equal(bundle.format, "iife");
    assert.equal(bundle.minified, true);
    assert.equal(bundle.sourcemap, false);
    assert.equal(
      bundle.assetUrl,
      `https://github.com/dgrosso/mandibula-web-components/releases/download/release-pinned/${bundle.filename}`
    );
    const bytes = await readFile(join(output, bundle.filename));
    assert.equal(bytes.byteLength, bundle.byteSize);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      bundle.sha256
    );
    assert.deepEqual(bytes, firstBytes.get(bundle.filename));
    assert.equal(bundle.filename.endsWith(".map"), false);
    assert.equal(JSON.stringify(bundle).includes(root), false);
  }
  const notices = await readFile(
    join(output, manifest.licenseNotices.filename)
  );
  assert.equal(notices.byteLength, manifest.licenseNotices.byteSize);
  assert.equal(
    createHash("sha256").update(notices).digest("hex"),
    manifest.licenseNotices.sha256
  );
  assert.ok(
    notices.includes(
      Buffer.from("Redistribution and use in source and binary forms")
    )
  );
  assert.equal(
    (await readdir(output)).some(
      (name) => name.endsWith(".map") || name.startsWith(".")
    ),
    false
  );
  assert.deepEqual(await readdir(join(root, "release-artifacts")), ["browser"]);
  assert.equal(second.outputPath, output);
});

test("a failed package leaves prior release output and manifest untouched", async (t) => {
  const root = await fixture(t);
  const output = join(root, "out");
  await mkdir(output);
  await writeFile(
    join(output, "browser-bundle-manifest.json"),
    "old manifest\n"
  );
  await writeFile(join(output, "keep.txt"), "keep\n");
  await assert.rejects(
    prepareBrowserBundleRelease({
      root,
      tag: "release-pinned",
      output,
      commitSha,
      build: async (options) => {
        if (options.packages[0] === "@mandibula/zeta")
          throw new Error("controlled build failure");
        const { buildBrowserBundle } =
          await import("../scripts/browser-bundle-lib.mjs");
        return buildBrowserBundle(options);
      },
    }),
    /controlled build failure/
  );
  assert.equal(
    await readFile(join(output, "browser-bundle-manifest.json"), "utf8"),
    "old manifest\n"
  );
  assert.deepEqual(await readdir(output), [
    "browser-bundle-manifest.json",
    "keep.txt",
  ]);
});

test("duplicate artifact names fail without publishing a consolidated manifest", async (t) => {
  const root = await mkdtemp(
    join(tmpdir(), "mandibula-browser-release-duplicate-")
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  const output = join(root, "out");
  await assert.rejects(
    prepareBrowserBundleRelease({
      root,
      tag: "release-pinned",
      output,
      commitSha,
      discover: async () => [
        { name: "@mandibula/one", shortName: "duplicate", version: "1.0.0" },
        { name: "@mandibula/two", shortName: "duplicate", version: "1.0.0" },
      ],
      build: async ({ packages }) => ({
        selectedPackages: packages,
        workspacePackages: [{ name: packages[0], version: "1.0.0" }],
        dependencies: [],
        format: "iife",
        minified: true,
        sourceMap: null,
        code: "globalThis.ready=true;",
      }),
      writeArtifacts: async (_result, { outDir }) => {
        await writeFile(
          join(outDir, "mandibula-duplicate.iife.min.js"),
          "globalThis.ready=true;"
        );
        return {
          javascriptFile: "mandibula-duplicate.iife.min.js",
          metadataFile: "mandibula-duplicate.iife.min.json",
          byteSize: 22,
          sha256: createHash("sha256")
            .update("globalThis.ready=true;")
            .digest("hex"),
        };
      },
    }),
    /Duplicate release browser asset filename/
  );
  assert.deepEqual(await readdir(output), []);
});

test("release builder rejects invalid CLI arguments", () => {
  for (const args of [
    ["--output", "out"],
    ["--tag", "release-x", "--output"],
    ["--tag", "release-x", "--output", "out", "--unknown"],
  ]) {
    const result = spawnSync(process.execPath, [cliPath, ...args], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.length < 1000);
  }
});
