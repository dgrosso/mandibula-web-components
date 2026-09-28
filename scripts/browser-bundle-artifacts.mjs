import { createHash } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

const PACKAGE_PREFIX = "@mandibula/";

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function getPackageShortNames(selectedPackages) {
  if (!Array.isArray(selectedPackages) || selectedPackages.length === 0) {
    throw new Error("A browser bundle must include one or more packages.");
  }
  const sorted = [...new Set(selectedPackages)].sort(compareStrings);
  return sorted.map((name) => {
    if (!name.startsWith(PACKAGE_PREFIX)) {
      throw new Error(`Invalid canonical browser bundle package name: ${name}`);
    }
    const shortName = name.slice(PACKAGE_PREFIX.length);
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(shortName)) {
      throw new Error(`Unsafe browser bundle package name: ${name}`);
    }
    return shortName;
  });
}

export function getBrowserBundleArtifactNames({
  selectedPackages,
  format,
  minified,
}) {
  if (format !== "iife" && format !== "esm") {
    throw new Error('Browser bundle format must be "iife" or "esm".');
  }
  if (typeof minified !== "boolean") {
    throw new Error("Browser bundle minified state must be a boolean.");
  }
  const names = getPackageShortNames(selectedPackages);
  const stem = `mandibula-${names.join("+")}.${format}${minified ? ".min" : ""}`;
  const javascriptFile = `${stem}.js`;
  return {
    javascriptFile,
    sourceMapFile: `${javascriptFile}.map`,
    metadataFile: `${stem}.json`,
  };
}

function isAbsoluteSource(value) {
  return (
    isAbsolute(value) ||
    /^[a-z]:[\\/]/i.test(value) ||
    value.startsWith("\\\\") ||
    value.startsWith("file:")
  );
}

function rewriteSourceMapReference(code, sourceMapFile) {
  const trailingReferencePattern =
    /(?:\/\/[#@][ \t]*sourceMappingURL=[^\s]+|\/\*[#@][ \t]*sourceMappingURL=[^*\r\n]+?\*\/)([ \t]*(?:\r?\n[ \t]*)*)$/;
  const match = code.match(trailingReferencePattern);
  if (!sourceMapFile) {
    return match ? `${code.slice(0, match.index)}${match[1]}` : code;
  }

  const reference = `//# sourceMappingURL=${sourceMapFile}`;
  if (match) {
    return `${code.slice(0, match.index)}${reference}${match[1]}`;
  }
  return `${code}${code.endsWith("\n") ? "" : "\n"}${reference}\n`;
}

function createMetadata(result, names, javascriptBytes, sourceMapFile) {
  const digest = createHash("sha256").update(javascriptBytes).digest("hex");
  return {
    schemaVersion: 1,
    selectedPackages: [...result.selectedPackages].sort(compareStrings),
    workspacePackages: [...result.workspacePackages].sort((left, right) =>
      compareStrings(left.name, right.name)
    ),
    dependencies: [...result.dependencies].sort(
      (left, right) =>
        compareStrings(left.name, right.name) ||
        compareStrings(left.version ?? "", right.version ?? "")
    ),
    format: result.format,
    minified: result.minified,
    sourcemap: sourceMapFile !== null,
    javascriptFile: names.javascriptFile,
    sourceMapFile,
    byteSize: javascriptBytes.byteLength,
    sha256: digest,
  };
}

async function existingRegularFile(path) {
  try {
    const details = await lstat(path);
    if (!details.isFile() || details.isSymbolicLink()) {
      throw new Error(
        `Refusing to replace a non-file browser bundle artifact: ${path}`
      );
    }
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function rollbackCommit(changedPaths, backups) {
  const failures = [];
  for (const path of [...changedPaths].reverse()) {
    try {
      await rm(path, { force: true });
    } catch (error) {
      failures.push(error);
    }
  }
  for (const [path, backup] of [...backups].reverse()) {
    if (!changedPaths.has(path)) continue;
    try {
      await rename(backup, path);
    } catch (error) {
      failures.push(error);
    }
  }
  return failures;
}

export async function writeBrowserBundleArtifacts(result, { outDir } = {}) {
  if (!result || typeof result.code !== "string" || !result.code.trim()) {
    throw new Error("A validated browser bundle result is required.");
  }
  if (
    !Array.isArray(result.selectedPackages) ||
    !result.selectedPackages.length
  ) {
    throw new Error(
      "A browser bundle result must identify its selected packages."
    );
  }
  if (
    !Array.isArray(result.workspacePackages) ||
    !Array.isArray(result.dependencies)
  ) {
    throw new Error("A browser bundle result is missing package metadata.");
  }
  if (typeof outDir !== "string" || !outDir.trim()) {
    throw new Error(
      "An output directory is required to write browser bundle artifacts."
    );
  }

  const names = getBrowserBundleArtifactNames(result);
  let sourceMap = null;
  if (result.sourceMap !== undefined && result.sourceMap !== null) {
    if (typeof result.sourceMap !== "string") {
      throw new Error("The browser bundle source map must be a string.");
    }
    let parsedMap;
    try {
      parsedMap = JSON.parse(result.sourceMap);
    } catch {
      throw new Error("The browser bundle source map is not valid JSON.");
    }
    if (
      !Array.isArray(parsedMap.sources) ||
      parsedMap.sources.some(
        (source) => typeof source !== "string" || isAbsoluteSource(source)
      ) ||
      (typeof parsedMap.sourceRoot === "string" &&
        isAbsoluteSource(parsedMap.sourceRoot))
    ) {
      throw new Error(
        "The browser bundle source map contains an absolute source path."
      );
    }
    parsedMap.file = names.javascriptFile;
    sourceMap = JSON.stringify(parsedMap);
  }

  const javascript = rewriteSourceMapReference(
    result.code,
    sourceMap === null ? null : names.sourceMapFile
  );
  const javascriptBytes = Buffer.from(javascript, "utf8");
  const metadata = createMetadata(
    result,
    names,
    javascriptBytes,
    sourceMap === null ? null : names.sourceMapFile
  );
  const metadataBytes = Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`);
  const directory = resolve(outDir);
  await mkdir(directory, { recursive: true });

  const writes = [
    { fileName: names.javascriptFile, contents: javascriptBytes },
    ...(sourceMap === null
      ? []
      : [{ fileName: names.sourceMapFile, contents: Buffer.from(sourceMap) }]),
    { fileName: names.metadataFile, contents: metadataBytes },
  ];
  const staleMap = sourceMap === null ? names.sourceMapFile : null;
  const touchedNames = [
    ...writes.map(({ fileName }) => fileName),
    ...(staleMap ? [staleMap] : []),
  ];
  const stagingDirectory = await mkdtemp(
    join(directory, ".mandibula-browser-bundle-")
  );
  const staged = new Map();
  const backups = [];
  const changedPaths = new Set();
  let preserveStagingDirectory = false;

  try {
    for (const [index, file] of writes.entries()) {
      const stagedPath = join(stagingDirectory, `new-${index}`);
      await writeFile(stagedPath, file.contents, { flag: "wx" });
      staged.set(file.fileName, stagedPath);
    }

    try {
      for (const [index, fileName] of touchedNames.entries()) {
        const destination = join(directory, fileName);
        if (!(await existingRegularFile(destination))) continue;
        const backup = join(stagingDirectory, `old-${index}`);
        await copyFile(destination, backup);
        backups.push([destination, backup]);
      }
      for (const file of writes) {
        const destination = join(directory, file.fileName);
        if (
          process.platform === "win32" &&
          backups.some(([path]) => path === destination)
        ) {
          await rm(destination);
          changedPaths.add(destination);
        }
        await rename(staged.get(file.fileName), destination);
        changedPaths.add(destination);
      }
      if (staleMap) {
        const stalePath = join(directory, staleMap);
        if (await existingRegularFile(stalePath)) {
          await rm(stalePath);
          changedPaths.add(stalePath);
        }
      }
    } catch (error) {
      const rollbackFailures = await rollbackCommit(changedPaths, backups);
      if (rollbackFailures.length) {
        preserveStagingDirectory = true;
        throw new AggregateError(
          [error, ...rollbackFailures],
          "Browser bundle artifact replacement failed and rollback was incomplete."
        );
      }
      throw error;
    }
  } finally {
    if (!preserveStagingDirectory) {
      await rm(stagingDirectory, { recursive: true, force: true });
    }
  }

  return {
    ...names,
    byteSize: javascriptBytes.byteLength,
    sha256: metadata.sha256,
  };
}
