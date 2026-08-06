import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import {
  discoverWorkspaces,
  packageFilename,
  packDistribution,
  planRelease,
  releaseTag,
} from "../../scripts/release-lib.mjs";

async function fixture({ dependency = false, unknown = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), "mandibula-release-test-"));
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ private: true, workspaces: ["packages/*"] })
  );
  const packages = [
    { name: "@mandibula/spinner", version: "0.1.0" },
    {
      name: "@mandibula/web-components",
      version: "0.1.0",
      dependencies: dependency ? { "@mandibula/spinner": "^0.1.0" } : undefined,
    },
  ];
  if (unknown) packages[1].dependencies = { "@mandibula/missing": "^0.1.0" };
  for (const pkg of packages) {
    const directory = join(
      root,
      "packages",
      pkg.name.slice("@mandibula/".length)
    );
    await mkdir(join(directory, "src"), { recursive: true });
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({
        name: pkg.name,
        version: pkg.version,
        type: "module",
        main: "./src/index.js",
        exports: { ".": "./src/index.js" },
        files: ["src", "README.md"],
        license: "MIT",
        dependencies: pkg.dependencies,
      })
    );
    await writeFile(
      join(directory, "src/index.js"),
      `export const name = ${JSON.stringify(pkg.name)};\n`
    );
    await writeFile(join(directory, "README.md"), `# ${pkg.name}\n`);
  }
  return root;
}

test("discovers public workspaces and ignores private workspaces", async () => {
  const root = await fixture();
  await mkdir(join(root, "packages", "private"), { recursive: true });
  await writeFile(
    join(root, "packages", "private", "package.json"),
    JSON.stringify({ private: true, name: "private-fixture", version: "1.0.0" })
  );
  const discovery = await discoverWorkspaces(root);
  assert.deepEqual(
    discovery.packages.map((pkg) => pkg.name),
    ["@mandibula/spinner", "@mandibula/web-components"]
  );
  assert.equal(discovery.packages[1].isAggregate, true);
  await rm(root, { recursive: true, force: true });
});

test("converts scoped names and creates safe deterministic release tags", () => {
  assert.equal(
    packageFilename("@mandibula/spinner", "0.1.0"),
    "mandibula-spinner-0.1.0.tgz"
  );
  assert.equal(releaseTag("ABCDEF1234567890/unsafe"), "release-abcdef123456");
});

test("workspace repository metadata points at the canonical repository", async () => {
  const discovery = await discoverWorkspaces(process.cwd());
  for (const pkg of discovery.packages) {
    assert.equal(
      pkg.configuration.repository.url,
      "git+https://github.com/dgrosso/mandibula-web-components.git"
    );
    assert.equal(
      pkg.configuration.repository.directory,
      `packages/${pkg.name.slice("@mandibula/".length)}`
    );
  }
});

test("unknown internal dependencies are rejected", async () => {
  const root = await fixture({ unknown: true });
  await assert.rejects(
    () => discoverWorkspaces(root),
    /unknown public workspace/
  );
  await rm(root, { recursive: true, force: true });
});

test("release planning ignores all-zero bases and ordinary source changes", async () => {
  const plan = await planRelease(process.cwd(), "0".repeat(40));
  assert.equal(plan.releaseRequired, false);
  assert.equal(plan.changedPackages.length, 0);
  assert.match(plan.releaseTag, /^release-[0-9a-f]{12}$/);
});

test("release planning reports only workspace version changes", async () => {
  const root = await fixture();
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "release-tests@example.test"], {
    cwd: root,
  });
  execFileSync("git", ["config", "user.name", "Release tests"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });
  const base = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const packagePath = join(root, "packages", "spinner", "package.json");
  const configuration = JSON.parse(await readFile(packagePath, "utf8"));
  configuration.version = "0.2.0";
  await writeFile(packagePath, JSON.stringify(configuration));
  await writeFile(join(root, "notes.md"), "ordinary source change\n");
  const plan = await planRelease(root, base);
  assert.deepEqual(plan.changedPackages, [
    { name: "@mandibula/spinner", version: "0.2.0" },
  ]);
  assert.equal(plan.releaseRequired, true);
  await rm(root, { recursive: true, force: true });
});

test("produces npm and GitHub variants without changing canonical metadata", async () => {
  const root = process.cwd();
  const discovery = await discoverWorkspaces(root);
  const before = new Map(
    await Promise.all(
      discovery.packages.map(async (pkg) => [
        pkg.name,
        await readFile(join(pkg.path, "package.json"), "utf8"),
      ])
    )
  );
  const npmOutput = await mkdtemp(join(tmpdir(), "mandibula-npm-artifacts-"));
  const githubOutput = await mkdtemp(
    join(tmpdir(), "mandibula-github-artifacts-")
  );
  await writeFile(join(npmOutput, "stale.tgz"), "stale");
  const npm = await packDistribution({ root, mode: "npm", output: npmOutput });
  const github = await packDistribution({
    root,
    mode: "github",
    tag: "release-test-123",
    output: githubOutput,
  });
  const npmAggregate = npm.assets.find(
    ({ pkg }) => pkg.name === "@mandibula/web-components"
  );
  const githubAggregate = github.assets.find(
    ({ pkg }) => pkg.name === "@mandibula/web-components"
  );
  assert.equal(
    npmAggregate.archivedConfig.dependencies["@mandibula/spinner"],
    "^0.1.0"
  );
  assert.match(
    githubAggregate.archivedConfig.dependencies["@mandibula/spinner"],
    /releases\/download\/release-test-123\/mandibula-spinner-0\.1\.0\.tgz$/
  );
  assert.equal(github.manifest.packages.length, npm.manifest.packages.length);
  assert.equal(
    await readFile(join(npmOutput, "stale.tgz")).catch(() => null),
    null
  );
  for (const pkg of discovery.packages) {
    assert.equal(
      await readFile(join(pkg.path, "package.json"), "utf8"),
      before.get(pkg.name)
    );
  }
  for (const asset of npm.assets) {
    const checksum = createHash("sha256")
      .update(await readFile(join(npmOutput, asset.filename)))
      .digest("hex");
    assert.equal(checksum, asset.checksum);
    assert.doesNotMatch(
      JSON.stringify(asset.archivedConfig),
      /releases\/download/
    );
  }
  const githubAssets = new Set(github.assets.map((asset) => asset.filename));
  for (const asset of github.manifest.packages) {
    for (const url of Object.values(asset.internalDependencyUrls))
      assert.ok(githubAssets.has(url.split("/").pop()));
  }
  await rm(npmOutput, { recursive: true, force: true });
  await rm(githubOutput, { recursive: true, force: true });
});

test("incompatible internal dependency ranges are rejected", async () => {
  const root = await fixture({ dependency: true });
  const configPath = join(root, "packages", "web-components", "package.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.dependencies["@mandibula/spinner"] = "^2.0.0";
  await writeFile(configPath, JSON.stringify(config));
  await assert.rejects(
    () =>
      packDistribution({
        root,
        mode: "github",
        tag: "release-test",
        output: join(root, "out"),
      }),
    /incompatible/
  );
  await rm(root, { recursive: true, force: true });
});
