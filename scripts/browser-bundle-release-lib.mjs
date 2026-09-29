import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  buildBrowserBundle,
  discoverBrowserBundlePackages,
} from "./browser-bundle-lib.mjs";
import { writeBrowserBundleArtifacts } from "./browser-bundle-artifacts.mjs";
import { gitOutput, RELEASE_BASE, REPOSITORY } from "./release-lib.mjs";

const compareStrings = (left, right) =>
  left < right ? -1 : left > right ? 1 : 0;

async function thirdPartyNotices(root, dependencies) {
  const require = createRequire(join(root, "package.json"));
  const identities = new Map();
  for (const dependency of dependencies) {
    const key = `${dependency.name}@${dependency.version}`;
    if (identities.has(key)) continue;
    let current;
    try {
      current = dirname(require.resolve(dependency.name));
    } catch (error) {
      throw new Error(
        `Cannot locate bundled dependency ${key} to verify its license notice: ${error.message}`
      );
    }
    let packageRoot;
    while (current !== dirname(current)) {
      try {
        const metadata = JSON.parse(
          await readFile(join(current, "package.json"), "utf8")
        );
        if (metadata.name === dependency.name) {
          if (metadata.version !== dependency.version) break;
          packageRoot = current;
          identities.set(key, { metadata, packageRoot });
          break;
        }
      } catch {
        // Keep walking until the resolved dependency's package metadata is found.
      }
      current = dirname(current);
    }
    if (!packageRoot)
      throw new Error(
        `Cannot locate package metadata for bundled dependency ${key}.`
      );
  }

  const records = [];
  const sections = [];
  for (const [key, { metadata, packageRoot }] of [...identities].sort(
    ([a], [b]) => compareStrings(a, b)
  )) {
    const license =
      typeof metadata.license === "string" ? metadata.license : "";
    if (!license)
      throw new Error(
        `Bundled dependency ${key} has no declared license identifier.`
      );
    const namedFile = license.match(/^SEE LICENSE IN (.+)$/i)?.[1];
    const candidates = [
      namedFile,
      "LICENSE",
      "LICENSE.txt",
      "LICENSE.md",
      "LICENCE",
      "COPYING",
    ].filter(Boolean);
    let noticeFile;
    let text;
    for (const candidate of candidates) {
      try {
        text = await readFile(join(packageRoot, candidate), "utf8");
        noticeFile = candidate;
        break;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    if (!text)
      throw new Error(
        `Bundled dependency ${key} declares ${license} but has no readable license notice file.`
      );
    records.push({
      name: metadata.name,
      version: metadata.version,
      license,
      noticeFile,
    });
    sections.push(
      `${metadata.name}@${metadata.version} (${license})\nSource: ${noticeFile}\n\n${text.trim()}\n`
    );
  }
  return {
    records,
    text: `Third-party license notices for Mandíbula browser bundles\n\n${sections.join("\n")}`,
  };
}

async function promoteReleaseFiles(outputPath, staging, files) {
  const backupsDirectory = join(staging, "backups");
  await mkdir(backupsDirectory, { recursive: true });
  const backups = new Map();
  const promoted = [];
  const temporaries = new Set();

  for (const [index, file] of files.entries()) {
    const destination = join(outputPath, file.filename);
    try {
      const existing = await lstat(destination);
      if (!existing.isFile() || existing.isSymbolicLink()) {
        throw new Error(
          `Refusing to replace a non-file release asset: ${file.filename}`
        );
      }
      const backup = join(backupsDirectory, `original-${index}`);
      await copyFile(destination, backup);
      backups.set(file.filename, backup);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      backups.set(file.filename, null);
    }
  }

  try {
    for (const [index, file] of files.entries()) {
      const temporary = join(
        outputPath,
        `.browser-release-${process.pid}-${index}.tmp`
      );
      temporaries.add(temporary);
      await copyFile(file.source, temporary);
      const destination = join(outputPath, file.filename);
      await rename(temporary, destination);
      temporaries.delete(temporary);
      promoted.push(file.filename);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const temporary of temporaries) {
      try {
        await rm(temporary, { force: true });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    for (const filename of promoted.reverse()) {
      const destination = join(outputPath, filename);
      const backup = backups.get(filename);
      try {
        if (backup) {
          const temporary = join(
            outputPath,
            `.browser-release-${process.pid}-rollback.tmp`
          );
          temporaries.add(temporary);
          await copyFile(backup, temporary);
          await rename(temporary, destination);
          temporaries.delete(temporary);
        } else {
          await rm(destination, { force: true });
        }
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length) {
      const failure = new AggregateError(
        [error, ...rollbackErrors],
        "Release asset promotion failed and rollback was incomplete; recovery copies remain in the temporary staging directory."
      );
      failure.recoveryRequired = true;
      throw failure;
    }
    throw error;
  } finally {
    for (const temporary of temporaries) {
      await rm(temporary, { force: true });
    }
  }
}

function validateTag(tag) {
  if (typeof tag !== "string" || !tag.trim()) {
    throw new Error("A release tag is required (--tag <release-tag>).");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(tag)) {
    throw new Error("Release tag must be a safe, single URL path segment.");
  }
  return tag;
}

export async function prepareBrowserBundleRelease({
  root = process.cwd(),
  tag,
  output,
  commitSha,
  discover = discoverBrowserBundlePackages,
  build = buildBrowserBundle,
  writeArtifacts = writeBrowserBundleArtifacts,
} = {}) {
  validateTag(tag);
  if (typeof output !== "string" || !output.trim()) {
    throw new Error("An output directory is required (--output <directory>).");
  }
  const rootPath = resolve(root);
  const outputPath = resolve(rootPath, output);
  const selectedCommit =
    commitSha ?? gitOutput(["rev-parse", "HEAD"], rootPath);
  if (!selectedCommit || !/^[0-9a-f]{40,64}$/i.test(selectedCommit)) {
    throw new Error(
      "A full repository commit SHA is required to prepare release assets."
    );
  }
  const packages = await discover(rootPath);
  if (!packages.length)
    throw new Error(
      "No eligible browser-bundle workspace packages were discovered."
    );
  const sortedPackages = [...packages].sort((left, right) =>
    compareStrings(left.name, right.name)
  );
  const names = new Set();
  await mkdir(outputPath, { recursive: true });
  const existing = await lstat(outputPath);
  if (!existing.isDirectory() || existing.isSymbolicLink()) {
    throw new Error("The output path must be a regular directory.");
  }

  const staging = await mkdtemp(join(tmpdir(), "mandibula-browser-release-"));
  const stagedAssets = [];
  let preserveStagingDirectory = false;
  try {
    for (const pkg of sortedPackages) {
      const result = await build({
        packages: [pkg.name],
        format: "iife",
        minify: true,
        sourcemap: false,
        root: rootPath,
      });
      if (
        result.format !== "iife" ||
        result.minified !== true ||
        (result.sourceMap !== undefined && result.sourceMap !== null) ||
        result.selectedPackages?.length !== 1 ||
        result.selectedPackages[0] !== pkg.name
      ) {
        throw new Error(
          `Invalid release browser-bundle profile for ${pkg.name}.`
        );
      }
      if (
        !result.workspacePackages.some(
          (included) =>
            included.name === pkg.name && included.version === pkg.version
        )
      ) {
        throw new Error(
          `Release browser-bundle metadata does not include the selected package identity for ${pkg.name}.`
        );
      }
      const written = await writeArtifacts(result, { outDir: staging });
      const filename = written.javascriptFile;
      if (names.has(filename))
        throw new Error(
          `Duplicate release browser asset filename: ${filename}`
        );
      names.add(filename);
      if (
        !filename ||
        filename.includes("/") ||
        filename.includes("\\") ||
        filename.startsWith(".")
      ) {
        throw new Error(`Unsafe release browser asset filename: ${filename}`);
      }
      const bytes = await readFile(join(staging, filename));
      const digest = createHash("sha256").update(bytes).digest("hex");
      if (bytes.byteLength !== written.byteSize || digest !== written.sha256) {
        throw new Error(
          `Finalized browser asset integrity check failed for ${filename}.`
        );
      }
      const expected = `mandibula-${pkg.shortName}.iife.min.js`;
      if (filename !== expected)
        throw new Error(
          `Unexpected release browser asset filename for ${pkg.name}: ${filename}`
        );
      stagedAssets.push({
        pkg,
        filename,
        metadataFile: written.metadataFile,
        bytes,
        digest,
        result,
      });
    }

    const stageNames = await readdir(staging);
    const expectedNames = new Set(
      stagedAssets.flatMap(({ filename, metadataFile }) => [
        filename,
        metadataFile,
      ])
    );
    if (
      stageNames.length !== expectedNames.size ||
      stageNames.some((filename) => !expectedNames.has(filename))
    ) {
      throw new Error(
        "Unexpected files were produced while preparing browser release assets."
      );
    }
    for (const filename of stageNames) {
      if (
        filename.endsWith(".map") ||
        filename.startsWith(".mandibula-browser-bundle-")
      ) {
        throw new Error(
          `Unexpected temporary or source-map artifact: ${filename}`
        );
      }
    }
    const bundles = stagedAssets.map(
      ({ pkg, filename, bytes, digest, result }) => ({
        package: { name: pkg.name, version: pkg.version },
        workspacePackages: [...result.workspacePackages].sort((a, b) =>
          compareStrings(a.name, b.name)
        ),
        dependencies: [...result.dependencies].sort(
          (a, b) =>
            compareStrings(a.name, b.name) ||
            compareStrings(a.version ?? "", b.version ?? "")
        ),
        format: "iife",
        minified: true,
        sourcemap: false,
        filename,
        byteSize: bytes.byteLength,
        sha256: digest,
        assetUrl: `${RELEASE_BASE}/${tag}/${filename}`,
      })
    );
    const noticeResult = await thirdPartyNotices(
      rootPath,
      bundles.flatMap((bundle) => bundle.dependencies)
    );
    const noticeFilename = "browser-bundle-third-party-licenses.txt";
    const noticeBytes = Buffer.from(noticeResult.text);
    const noticeSha256 = createHash("sha256").update(noticeBytes).digest("hex");
    await writeFile(join(staging, noticeFilename), noticeBytes, { flag: "wx" });
    const manifest = {
      schemaVersion: 1,
      distributionTarget: "github-release-browser-bundles",
      repository: REPOSITORY,
      releaseTag: tag,
      commitSha: selectedCommit,
      bundles,
      thirdPartyLicenses: noticeResult.records,
      licenseNotices: {
        filename: noticeFilename,
        byteSize: noticeBytes.byteLength,
        sha256: noticeSha256,
        assetUrl: `${RELEASE_BASE}/${tag}/${noticeFilename}`,
      },
    };
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    const manifestStage = join(staging, "browser-bundle-manifest.json");
    await writeFile(manifestStage, manifestBytes, { flag: "wx" });

    // Promote finalized files only after every package and the consolidated manifest validate.
    try {
      await promoteReleaseFiles(outputPath, staging, [
        ...stagedAssets.map(({ filename }) => ({
          filename,
          source: join(staging, filename),
        })),
        { filename: noticeFilename, source: join(staging, noticeFilename) },
        { filename: "browser-bundle-manifest.json", source: manifestStage },
      ]);
    } catch (error) {
      if (error.recoveryRequired) preserveStagingDirectory = true;
      throw error;
    }
    return {
      outputPath,
      manifest,
      assets: [...stagedAssets.map(({ filename }) => filename), noticeFilename],
    };
  } finally {
    if (!preserveStagingDirectory) {
      await rm(staging, { recursive: true, force: true });
    }
  }
}
