import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { normalizeBrowserBundleSelection } from "../scripts/browser-bundle-lib.mjs";
import {
  browserBundleHelp,
  parseBrowserBundleArguments,
  resolveBrowserBundleOutputDirectory,
  runBrowserBundleCommand,
} from "../scripts/browser-bundle-cli-lib.mjs";
import { getBrowserBundleArtifactNames } from "../scripts/browser-bundle-artifacts.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const cliPath = join(repositoryRoot, "scripts", "browser-bundle.mjs");

function captureOutput() {
  let value = "";
  return {
    stream: {
      write(chunk) {
        value += chunk;
        return true;
      },
    },
    read: () => value,
  };
}

function runCli(args, cwd = repositoryRoot) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 30000,
  });
}

async function createWorkspaceFixture(root) {
  const packageDirectory = join(root, "packages", "failure-fixture");
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ private: true, workspaces: ["packages/*"] })
  );
  await writeFile(
    join(packageDirectory, "package.json"),
    JSON.stringify({
      name: "@mandibula/failure-fixture",
      version: "1.0.0",
      license: "MIT",
      files: ["src"],
      exports: { ".": "./src/index.js" },
    })
  );
  await mkdir(join(packageDirectory, "src"), { recursive: true });
  await writeFile(
    join(packageDirectory, "src", "index.js"),
    "globalThis.fixtureLoaded = true;\n"
  );
  return join(packageDirectory, "src", "index.js");
}

test("normalizes package ordering into one stable artifact name", async () => {
  const forward = parseBrowserBundleArguments(["video", "slider"]);
  const reverse = parseBrowserBundleArguments(["slider", "video", "video"]);
  const forwardPackages = await normalizeBrowserBundleSelection(
    forward.packages
  );
  const reversePackages = await normalizeBrowserBundleSelection(
    reverse.packages
  );

  assert.deepEqual(forwardPackages, ["@mandibula/slider", "@mandibula/video"]);
  assert.deepEqual(reversePackages, forwardPackages);
  assert.deepEqual(
    getBrowserBundleArtifactNames({
      selectedPackages: forwardPackages,
      format: forward.format,
      minified: forward.minify,
    }),
    {
      javascriptFile: "mandibula-slider+video.iife.min.js",
      sourceMapFile: "mandibula-slider+video.iife.min.js.map",
      metadataFile: "mandibula-slider+video.iife.min.json",
    }
  );
});

test("uses documented defaults and supports explicit build options", () => {
  const defaults = parseBrowserBundleArguments(["video"]);
  assert.deepEqual(
    {
      format: defaults.format,
      minify: defaults.minify,
      sourcemap: defaults.sourcemap,
    },
    { format: "iife", minify: true, sourcemap: false }
  );
  assert.equal(
    resolveBrowserBundleOutputDirectory(undefined, {
      root: repositoryRoot,
      cwd: tmpdir(),
    }),
    join(repositoryRoot, "dist", "browser")
  );
  assert.equal(
    resolveBrowserBundleOutputDirectory("artifacts", {
      root: repositoryRoot,
      cwd: "/tmp/browser-cli-test",
    }),
    "/tmp/browser-cli-test/artifacts"
  );

  const esm = parseBrowserBundleArguments([
    "video",
    "--format",
    "esm",
    "--no-minify",
    "--sourcemap",
  ]);
  assert.equal(esm.format, "esm");
  assert.equal(esm.minify, false);
  assert.equal(esm.sourcemap, true);
  assert.equal(parseBrowserBundleArguments(["video", "--minify"]).minify, true);
  assert.equal(
    parseBrowserBundleArguments(["video", "--no-sourcemap"]).sourcemap,
    false
  );
  assert.equal(
    getBrowserBundleArtifactNames({
      selectedPackages: ["@mandibula/video"],
      format: esm.format,
      minified: esm.minify,
    }).javascriptFile,
    "mandibula-video.esm.js"
  );
});

test("builds deterministic artifacts, maps, and metadata without disturbing neighbors", async (t) => {
  const outDir = await mkdtemp(join(tmpdir(), "mandibula-browser-cli-output-"));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  const unrelatedPath = join(outDir, "keep.txt");
  await writeFile(unrelatedPath, "leave this file alone\n");
  const names = {
    javascriptFile: "mandibula-slider+video.iife.min.js",
    sourceMapFile: "mandibula-slider+video.iife.min.js.map",
    metadataFile: "mandibula-slider+video.iife.min.json",
  };
  await writeFile(join(outDir, names.sourceMapFile), "stale map\n");

  const firstOutput = captureOutput();
  const first = await runBrowserBundleCommand(
    ["video", "slider", "--out-dir", outDir],
    { root: repositoryRoot, cwd: repositoryRoot, stdout: firstOutput.stream }
  );
  const javascriptPath = join(outDir, names.javascriptFile);
  const metadataPath = join(outDir, names.metadataFile);
  const firstJavaScript = await readFile(javascriptPath);
  const firstMetadataBytes = await readFile(metadataPath);
  const metadata = JSON.parse(firstMetadataBytes.toString("utf8"));

  assert.equal(first.result.format, "iife");
  assert.equal(first.result.minified, true);
  assert.equal(metadata.schemaVersion, 1);
  assert.deepEqual(metadata.selectedPackages, [
    "@mandibula/slider",
    "@mandibula/video",
  ]);
  assert.deepEqual(
    metadata.workspacePackages.map((pkg) => pkg.name),
    ["@mandibula/slider", "@mandibula/video"]
  );
  assert.deepEqual(metadata.workspacePackages, first.result.workspacePackages);
  assert.ok(
    metadata.workspacePackages.every((pkg) => typeof pkg.version === "string")
  );
  assert.deepEqual(metadata.dependencies, first.result.dependencies);
  assert.ok(
    metadata.dependencies.some((dependency) => dependency.name === "lit")
  );
  assert.equal(metadata.format, "iife");
  assert.equal(metadata.minified, true);
  assert.equal(metadata.sourcemap, false);
  assert.equal(metadata.javascriptFile, names.javascriptFile);
  assert.equal(metadata.sourceMapFile, null);
  assert.equal(metadata.byteSize, firstJavaScript.byteLength);
  assert.equal(
    metadata.sha256,
    createHash("sha256").update(firstJavaScript).digest("hex")
  );
  assert.ok(!Object.hasOwn(metadata, "timestamp"));
  assert.ok(!firstMetadataBytes.toString("utf8").includes(repositoryRoot));
  assert.ok(!firstMetadataBytes.toString("utf8").includes(outDir));
  assert.ok(
    firstOutput.read().includes("Built @mandibula/slider + @mandibula/video")
  );
  assert.equal(firstOutput.read().split("\n")[1], names.javascriptFile);
  assert.ok(!firstOutput.read().includes(outDir));
  assert.equal(
    await readFile(unrelatedPath, "utf8"),
    "leave this file alone\n"
  );
  await assert.rejects(readFile(join(outDir, names.sourceMapFile)), {
    code: "ENOENT",
  });

  await writeFile(javascriptPath, "old complete artifact\n");
  await writeFile(metadataPath, "old metadata\n");
  const second = await runBrowserBundleCommand(
    ["slider", "video", "--out-dir", outDir],
    {
      root: repositoryRoot,
      cwd: repositoryRoot,
      stdout: captureOutput().stream,
    }
  );
  assert.equal(second.artifacts.javascriptFile, names.javascriptFile);
  assert.deepEqual(await readFile(javascriptPath), firstJavaScript);
  assert.deepEqual(await readFile(metadataPath), firstMetadataBytes);

  const esmOutput = captureOutput();
  const esm = await runBrowserBundleCommand(
    [
      "slider",
      "video",
      "--format",
      "esm",
      "--no-minify",
      "--sourcemap",
      "--out-dir",
      outDir,
    ],
    { root: repositoryRoot, cwd: repositoryRoot, stdout: esmOutput.stream }
  );
  const esmNames = {
    javascriptFile: "mandibula-slider+video.esm.js",
    sourceMapFile: "mandibula-slider+video.esm.js.map",
    metadataFile: "mandibula-slider+video.esm.json",
  };
  const esmJavaScript = await readFile(
    join(outDir, esmNames.javascriptFile),
    "utf8"
  );
  const esmMap = await readFile(join(outDir, esmNames.sourceMapFile), "utf8");
  const esmMetadataBytes = await readFile(join(outDir, esmNames.metadataFile));
  const esmMetadata = JSON.parse(esmMetadataBytes.toString("utf8"));
  assert.equal(esm.artifacts.javascriptFile, esmNames.javascriptFile);
  assert.equal(esmMetadata.format, "esm");
  assert.equal(esmMetadata.minified, false);
  assert.equal(esmMetadata.sourcemap, true);
  assert.equal(esmMetadata.sourceMapFile, esmNames.sourceMapFile);
  assert.ok(
    esmJavaScript.includes(`sourceMappingURL=${esmNames.sourceMapFile}`)
  );
  assert.ok(!esmMap.includes(repositoryRoot));
  assert.ok(!esmMap.includes(outDir));
  assert.equal(esmOutput.read().split("\n")[1], esmNames.javascriptFile);
  assert.ok(!esmOutput.read().includes(outDir));
  assert.deepEqual(await readFile(javascriptPath), firstJavaScript);
  assert.deepEqual(await readFile(metadataPath), firstMetadataBytes);
  assert.equal(
    await readFile(unrelatedPath, "utf8"),
    "leave this file alone\n"
  );
  await runBrowserBundleCommand(["video", "slider", "--out-dir", outDir], {
    root: repositoryRoot,
    cwd: repositoryRoot,
    stdout: captureOutput().stream,
  });
  assert.deepEqual(
    await readFile(join(outDir, esmNames.javascriptFile)),
    Buffer.from(esmJavaScript)
  );
  assert.deepEqual(
    await readFile(join(outDir, esmNames.sourceMapFile)),
    Buffer.from(esmMap)
  );
  assert.deepEqual(
    await readFile(join(outDir, esmNames.metadataFile)),
    esmMetadataBytes
  );
  assert.ok(
    (await readdir(outDir)).every(
      (name) => !name.startsWith(".mandibula-browser-bundle-")
    )
  );
});

test("a failed build leaves existing artifacts and unrelated files untouched", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "mandibula-browser-cli-failure-"));
  const outDir = join(root, "output");
  t.after(() => rm(root, { recursive: true, force: true }));
  const fixtureEntry = await createWorkspaceFixture(root);
  await mkdir(outDir, { recursive: true });
  const names = getBrowserBundleArtifactNames({
    selectedPackages: ["@mandibula/failure-fixture"],
    format: "iife",
    minified: true,
  });
  await writeFile(join(outDir, "keep.txt"), "unrelated\n");
  await runBrowserBundleCommand(
    ["failure-fixture", "--sourcemap", "--out-dir", outDir],
    { root, cwd: root, stdout: captureOutput().stream }
  );
  const existingFiles = new Map(
    await Promise.all(
      [
        names.javascriptFile,
        names.sourceMapFile,
        names.metadataFile,
        "keep.txt",
      ].map(async (fileName) => [
        fileName,
        await readFile(join(outDir, fileName)),
      ])
    )
  );
  assert.ok(existingFiles.get(names.javascriptFile).length > 0);
  const originalMetadata = JSON.parse(existingFiles.get(names.metadataFile));
  assert.equal(
    originalMetadata.sha256,
    createHash("sha256")
      .update(existingFiles.get(names.javascriptFile))
      .digest("hex")
  );
  await writeFile(fixtureEntry, 'import "node:fs";\n');

  await assert.rejects(
    runBrowserBundleCommand(["failure-fixture", "--out-dir", outDir], {
      root,
      cwd: root,
      stdout: captureOutput().stream,
    }),
    /browser-compatibility replacement module/
  );
  for (const [fileName, expected] of existingFiles) {
    assert.deepEqual(await readFile(join(outDir, fileName)), expected);
  }
  assert.deepEqual(
    new Set(await readdir(outDir)),
    new Set(existingFiles.keys())
  );
});

test("invalid CLI usage fails cleanly and help succeeds", async (t) => {
  const outDir = await mkdtemp(
    join(tmpdir(), "mandibula-browser-cli-invalid-")
  );
  t.after(() => rm(outDir, { recursive: true, force: true }));
  await writeFile(join(outDir, "keep.txt"), "unrelated\n");
  const invalidArguments = [
    ["--out-dir", outDir],
    ["not-a-package", "--out-dir", outDir],
    ["video", "--unknown", "--out-dir", outDir],
    ["video", "--format", "--out-dir", outDir],
    ["video", "--format", "umd", "--out-dir", outDir],
    ["packages/slider/src/index.js", "--out-dir", outDir],
    ["@mandibula/video/styles.css", "--out-dir", outDir],
  ];
  for (const args of invalidArguments) {
    const result = runCli(args);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /Browser bundle failed:/);
  }
  assert.deepEqual(await readdir(outDir), ["keep.txt"]);

  const help = runCli(["--help"]);
  assert.equal(help.status, 0, help.stderr);
  assert.ok(help.stdout.includes("Usage: npm run build:browser --"));
  assert.ok(help.stdout.includes("--format iife|esm"));
  assert.equal(browserBundleHelp.includes("@mandibula"), false);

  const success = runCli(["video", "--out-dir", outDir]);
  assert.equal(success.status, 0, success.stderr);
  assert.ok(success.stdout.includes("Built @mandibula/video"));
  assert.ok(success.stdout.includes("mandibula-video.iife.min.js"));
  assert.ok((await readdir(outDir)).includes("mandibula-video.iife.min.json"));

  assert.throws(
    () => parseBrowserBundleArguments([]),
    /one or more Mandíbula packages/
  );
  assert.throws(
    () => parseBrowserBundleArguments(["--mystery"]),
    /Unknown browser bundle option/
  );
  assert.throws(
    () => parseBrowserBundleArguments(["video", "--out-dir"]),
    /requires a value/
  );
  assert.throws(
    () => parseBrowserBundleArguments(["video", "--format", "cjs"]),
    /Invalid --format/
  );
  assert.equal(
    resolveBrowserBundleOutputDirectory("./build", {
      root: repositoryRoot,
      cwd: resolve(repositoryRoot, "packages"),
    }),
    resolve(repositoryRoot, "packages", "build")
  );
});
