import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build as viteBuild } from "vite";
import { discoverWorkspaces } from "./release-lib.mjs";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANDIBULA_SCOPE = "@mandibula/";
const VIRTUAL_ENTRY = "virtual:mandibula-browser-bundle-entry";
const VIRTUAL_ENTRY_ID = `\0${VIRTUAL_ENTRY}`;
const EXPORT_CONDITIONS = new Set([
  "browser",
  "import",
  "module",
  "production",
  "default",
]);
const VITE_BROWSER_COMPATIBILITY_MODULES = [
  "__vite-browser-external",
  "browser-external:",
  "__vite-optional-peer-dep",
  "optional-peer-dep:",
];
const LIT_RUNTIME_PACKAGES = new Set([
  "lit",
  "lit-element",
  "lit-html",
  "@lit/reactive-element",
  "@lit/context",
  "@lit-labs/ssr-dom-shim",
]);

function toPosix(value) {
  return value.split(sep).join("/");
}

function isWithin(parent, candidate) {
  const path = relative(parent, candidate);
  return (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
  );
}

function unresolvedExport() {
  return { kind: "undefined" };
}

function conditionalTarget(value) {
  if (value === undefined) return unresolvedExport();
  if (value === null) return { kind: "blocked" };
  if (typeof value === "string") return { kind: "target", target: value };
  if (Array.isArray(value)) {
    for (const candidate of value) {
      const result = conditionalTarget(candidate);
      if (result.kind !== "undefined") return result;
    }
    return unresolvedExport();
  }
  if (!value || typeof value !== "object") {
    throw new Error(
      "Invalid package exports target: expected a relative target string, null, an array, or a condition object."
    );
  }
  for (const [condition, candidate] of Object.entries(value)) {
    if (!EXPORT_CONDITIONS.has(condition)) continue;
    const result = conditionalTarget(candidate);
    if (result.kind !== "undefined") return result;
  }
  return unresolvedExport();
}

function isSubpathKey(key) {
  return key.startsWith(".");
}

function validateSubpathKey(key) {
  if (
    !isSubpathKey(key) ||
    (key !== "." && !key.startsWith("./")) ||
    (key.match(/\*/g)?.length ?? 0) > 1 ||
    key.includes("\\") ||
    key.includes("?") ||
    key.includes("#")
  ) {
    throw new Error(`Unsupported package exports subpath key: ${key}.`);
  }
  const segments = key === "." ? [] : key.slice(2).split("/");
  if (
    segments.some((segment) => {
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        return true;
      }
      return (
        segment.length === 0 ||
        segment.includes("%") ||
        decoded === "." ||
        decoded === ".." ||
        decoded.toLowerCase() === "node_modules" ||
        decoded.includes("/") ||
        decoded.includes("\\")
      );
    })
  ) {
    throw new Error(`Unsupported package exports subpath key: ${key}.`);
  }
}

function validateConditionalShape(value) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "undefined"
  ) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(validateConditionalShape);
    return;
  }
  if (!value || typeof value !== "object") {
    throw new Error(
      "Invalid package exports target: expected a relative target string, null, an array, or a condition object."
    );
  }
  for (const [condition, candidate] of Object.entries(value)) {
    if (isSubpathKey(condition)) {
      throw new Error(
        `Invalid package exports configuration: condition objects cannot contain subpath key ${condition}.`
      );
    }
    validateConditionalShape(candidate);
  }
}

function exportValue(exportsField, subpath) {
  if (typeof exportsField === "string" || Array.isArray(exportsField)) {
    validateConditionalShape(exportsField);
    return subpath === "." ? exportsField : undefined;
  }
  if (exportsField === null) return subpath === "." ? null : undefined;
  if (!exportsField || typeof exportsField !== "object") {
    throw new Error(
      "Invalid package exports configuration: expected a target or an object."
    );
  }

  const keys = Object.keys(exportsField);
  const subpathKeys = keys.filter(isSubpathKey);
  if (subpathKeys.length && subpathKeys.length !== keys.length) {
    throw new Error(
      "Invalid package exports configuration: do not mix subpath keys and condition keys at the same object level."
    );
  }
  if (!subpathKeys.length) {
    validateConditionalShape(exportsField);
    return subpath === "." ? exportsField : undefined;
  }
  for (const key of subpathKeys) {
    validateSubpathKey(key);
    validateConditionalShape(exportsField[key]);
  }

  if (Object.hasOwn(exportsField, subpath)) return exportsField[subpath];

  const matches = subpathKeys
    .filter((key) => key.includes("*"))
    .map((key) => {
      const [prefix, suffix] = key.split("*");
      if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) return null;
      const capture = subpath.slice(
        prefix.length,
        subpath.length - suffix.length
      );
      return {
        key,
        capture,
        prefixLength: prefix.length,
        suffixLength: suffix.length,
      };
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        right.prefixLength - left.prefixLength ||
        right.suffixLength - left.suffixLength
    );
  const match = matches[0];
  if (!match) return undefined;

  const value = exportsField[match.key];
  const replaceWildcard = (candidate) => {
    if (typeof candidate === "string")
      return candidate.replaceAll("*", match.capture);
    if (Array.isArray(candidate)) return candidate.map(replaceWildcard);
    if (candidate && typeof candidate === "object") {
      return Object.fromEntries(
        Object.entries(candidate).map(([key, nested]) => [
          key,
          replaceWildcard(nested),
        ])
      );
    }
    return candidate;
  };
  return replaceWildcard(value);
}

function resolvePackageExport(configuration, directory, subpath = ".") {
  const selection = conditionalTarget(
    exportValue(configuration.exports, subpath)
  );
  if (selection.kind !== "target") return undefined;
  const { target } = selection;
  if (
    !target.startsWith("./") ||
    target.includes("\\") ||
    target.includes("?") ||
    target.includes("#") ||
    target.includes("%")
  ) {
    throw new Error(
      `Invalid package exports target "${target}": only relative file targets inside the workspace package are supported.`
    );
  }
  const targetSegments = target.slice(2).split("/");
  if (
    targetSegments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.toLowerCase() === "node_modules"
    )
  ) {
    throw new Error(
      `Invalid package exports target "${target}": dot segments, empty segments, and node_modules are not supported.`
    );
  }
  const entry = resolve(directory, target);
  if (!isWithin(directory, entry)) {
    throw new Error(
      `Invalid package exports target "${target}": targets must stay within the workspace package.`
    );
  }
  if (!existsSync(entry) || !statSync(entry).isFile()) {
    throw new Error(
      `Package exports target "${target}" selected for ${subpath} does not resolve to a file in this workspace package.`
    );
  }
  return { target, entry };
}

function packageDirectory(root, packagePath, packageName) {
  const directory = realpathSync(resolve(root, packagePath));
  if (!isWithin(root, directory)) {
    throw new Error(
      `Workspace ${packageName} resolves outside this repository checkout.`
    );
  }
  return directory;
}

async function loadCatalog(root = REPOSITORY_ROOT) {
  const rootPath = realpathSync(resolve(root));
  const workspaces = await discoverWorkspaces(rootPath);
  const packages = [];
  const byName = new Map();
  const byShortName = new Map();

  for (const workspace of workspaces.packages) {
    if (!workspace.name.startsWith(MANDIBULA_SCOPE)) continue;
    const directory = packageDirectory(
      rootPath,
      workspace.path,
      workspace.name
    );
    const root = resolvePackageExport(workspace.configuration, directory);
    if (!root) {
      throw new Error(
        `Workspace package ${workspace.name} must expose a compatible public root through exports["."].`
      );
    }

    const item = {
      name: workspace.name,
      shortName: workspace.name.slice(MANDIBULA_SCOPE.length),
      version: workspace.version,
      directory,
      packagePath: toPosix(relative(rootPath, directory)),
      rootExport: root.target,
      configuration: workspace.configuration,
    };
    if (byName.has(item.name) || byShortName.has(item.shortName)) {
      throw new Error(
        `Workspace package name ${item.name} is declared more than once.`
      );
    }
    packages.push(item);
    byName.set(item.name, item);
    byShortName.set(item.shortName, item);
  }

  packages.sort((left, right) => compareStrings(left.name, right.name));
  return { root: rootPath, packages, byName, byShortName };
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function publicPackageRecord(pkg) {
  return {
    name: pkg.name,
    shortName: pkg.shortName,
    version: pkg.version,
    packagePath: pkg.packagePath,
    rootExport: pkg.rootExport,
  };
}

export async function discoverBrowserBundlePackages(root = REPOSITORY_ROOT) {
  const catalog = await loadCatalog(root);
  return catalog.packages.map(publicPackageRecord);
}

function normalizeSelection(selection, catalog) {
  if (!Array.isArray(selection) || selection.length === 0) {
    throw new Error("Select one or more Mandíbula workspace packages.");
  }

  const selected = new Set();
  for (const input of selection) {
    if (typeof input !== "string" || !input.trim()) {
      throw new Error("Each browser-bundle selection must be a package name.");
    }
    const value = input.trim();
    let pkg;

    if (/^mdb-[a-z0-9-]+$/i.test(value)) {
      const suggestion = value.slice("mdb-".length);
      throw new Error(
        `Custom-element tags are not package selections. Use "${suggestion}" for ${value}.`
      );
    }
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) {
      throw new Error(
        `URLs are not valid browser-bundle package selections: ${value}`
      );
    }
    if (value.includes("/") && !value.startsWith(MANDIBULA_SCOPE)) {
      throw new Error(
        `Source paths and package subpaths are not valid selections: ${value}`
      );
    }
    if (value.startsWith(MANDIBULA_SCOPE)) {
      if (value.slice(MANDIBULA_SCOPE.length).includes("/")) {
        throw new Error(`Package subpaths are not selectable: ${value}`);
      }
      pkg = catalog.byName.get(value);
    } else if (/^[a-z0-9][a-z0-9._-]*$/.test(value)) {
      pkg = catalog.byShortName.get(value);
    }

    if (!pkg) {
      const available = catalog.packages
        .map((item) => item.shortName)
        .join(", ");
      throw new Error(
        `Unknown Mandíbula workspace package "${value}". Choose one of: ${available}.`
      );
    }
    selected.add(pkg.name);
  }

  return [...selected].sort(compareStrings);
}

export async function normalizeBrowserBundleSelection(
  selection,
  { root = REPOSITORY_ROOT } = {}
) {
  return normalizeSelection(selection, await loadCatalog(root));
}

function parseMandibulaSpecifier(specifier) {
  const suffixStart = specifier.search(/[?#]/);
  const request =
    suffixStart === -1 ? specifier : specifier.slice(0, suffixStart);
  const suffix = suffixStart === -1 ? "" : specifier.slice(suffixStart);
  const match = request.match(/^(@mandibula\/[^/]+)(?:\/(.+))?$/);
  if (match)
    return {
      packageName: match[1],
      subpath: match[2] ? `./${match[2]}` : ".",
      suffix,
    };
  if (request === "@mandibula" || request.startsWith(MANDIBULA_SCOPE)) {
    throw new Error(`Invalid local Mandíbula package specifier: ${specifier}`);
  }
  return null;
}

function resolveWorkspaceExport(pkg, subpath) {
  const resolved = resolvePackageExport(
    pkg.configuration,
    pkg.directory,
    subpath
  );
  if (!resolved) {
    throw new Error(
      `Workspace package ${pkg.name} does not expose ${subpath === "." ? "a compatible public root" : `the public subpath ${subpath}`} through its exports field.`
    );
  }
  return resolved.entry;
}

function createWorkspaceResolver(catalog, resolvedPackages) {
  return {
    name: "mandibula-local-workspace-resolver",
    enforce: "pre",
    async resolveId(source, importer) {
      const parsed = parseMandibulaSpecifier(source);
      if (!parsed) return null;
      const pkg = catalog.byName.get(parsed.packageName);
      if (!pkg) {
        throw new Error(
          `Cannot resolve ${parsed.packageName} locally: it is not declared in this checkout's npm workspaces. Published Mandíbula packages are not used.`
        );
      }
      const target = resolveWorkspaceExport(pkg, parsed.subpath);
      const request = `${target}${parsed.suffix}`;
      const resolved = await this.resolve(request, importer, {
        skipSelf: true,
      });
      if (!resolved || resolved.external) {
        throw new Error(
          `Vite could not resolve the public export ${target} for ${pkg.name}.`
        );
      }
      const resolvedPath = resolved.id.split(/[?#]/, 1)[0];
      if (!isAbsolute(resolvedPath)) {
        throw new Error(
          `Vite resolved ${pkg.name} to a non-local module; browser bundles require checkout packages.`
        );
      }
      const canonicalPath = realpathSync(resolvedPath);
      if (!isWithin(pkg.directory, canonicalPath)) {
        throw new Error(
          `Vite resolved ${pkg.name} outside its workspace package directory.`
        );
      }
      resolvedPackages.add(pkg.name);
      return resolved;
    },
  };
}

function nodeModuleIdentity(absolutePath) {
  const marker = `${sep}node_modules${sep}`;
  const markerIndex = absolutePath.lastIndexOf(marker);
  if (markerIndex < 0) return null;
  const packageBase = absolutePath.slice(0, markerIndex + marker.length);
  const segments = absolutePath.slice(markerIndex + marker.length).split(sep);
  if (!segments[0]) return null;
  const packageSegments = segments[0].startsWith("@")
    ? segments.slice(0, 2)
    : segments.slice(0, 1);
  if (packageSegments.length < 1 || !packageSegments.at(-1)) return null;
  const packageName = packageSegments.join("/");
  const packageRoot = join(packageBase, ...packageSegments);
  let version = null;
  try {
    version =
      JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"))
        .version ?? null;
  } catch {
    // Some generated modules do not have package metadata.
  }
  return {
    id: `${packageName}@${version ?? "unknown"}/${toPosix(relative(packageRoot, absolutePath))}`,
    packageName,
    version,
  };
}

function moduleIdentity(id, catalog) {
  if (id.startsWith("\0"))
    return { id: `virtual:${id.slice(1)}`, packageName: null, version: null };
  const filePath = id.split(/[?#]/, 1)[0];
  if (!isAbsolute(filePath)) {
    return {
      id: `module:${filePath.replaceAll("\\", "/")}`,
      packageName: null,
      version: null,
    };
  }
  let canonicalPath = filePath;
  try {
    canonicalPath = realpathSync(filePath);
  } catch {
    // Vite virtual helper IDs can appear path-like without a physical file.
  }
  for (const pkg of catalog.packages) {
    if (!isWithin(pkg.directory, canonicalPath)) continue;
    return {
      id: `${pkg.name}@${pkg.version}/${toPosix(relative(pkg.directory, canonicalPath))}`,
      packageName: pkg.name,
      version: pkg.version,
    };
  }
  const dependency = nodeModuleIdentity(canonicalPath);
  if (dependency) return dependency;
  if (isWithin(catalog.root, canonicalPath)) {
    return {
      id: `repository/${toPosix(relative(catalog.root, canonicalPath))}`,
      packageName: null,
      version: null,
    };
  }
  return {
    id: `module:${canonicalPath.split(sep).at(-1)}`,
    packageName: null,
    version: null,
  };
}

function sourceMapIdentity(source, catalog, outputDirectory) {
  let canonicalPath;
  if (isAbsolute(source)) canonicalPath = source;
  else canonicalPath = resolve(outputDirectory, source);
  try {
    canonicalPath = realpathSync(canonicalPath);
  } catch {
    // Preserve relative virtual sources while removing machine-specific prefixes.
  }
  for (const pkg of catalog.packages) {
    if (isWithin(pkg.directory, canonicalPath)) {
      return `${pkg.name}/${toPosix(relative(pkg.directory, canonicalPath))}`;
    }
  }
  const dependency = nodeModuleIdentity(canonicalPath);
  if (dependency) return dependency.id;
  if (isWithin(catalog.root, canonicalPath)) {
    return `repository/${toPosix(relative(catalog.root, canonicalPath))}`;
  }
  return `source/${source.replaceAll("\\", "/").split("/").at(-1)}`;
}

function assetSource(asset) {
  return typeof asset.source === "string"
    ? asset.source
    : Buffer.from(asset.source).toString("utf8");
}

export function summarizeBrowserBundleDependencies(modules) {
  const dependencies = new Map();
  const litVersions = new Map();
  const litModuleIdentities = new Set();

  for (const module of modules) {
    const { packageName, version = null } = module;
    if (!packageName || packageName.startsWith(MANDIBULA_SCOPE)) continue;

    dependencies.set(JSON.stringify([packageName, version]), {
      name: packageName,
      version,
    });
    if (!LIT_RUNTIME_PACKAGES.has(packageName)) continue;

    if (module.id && litModuleIdentities.has(module.id)) {
      throw new Error(
        `Duplicate Lit runtime module identity "${module.id}" was resolved. A browser bundle must include one identity for each Lit runtime module.`
      );
    }
    if (module.id) litModuleIdentities.add(module.id);

    const versions = litVersions.get(packageName) ?? new Set();
    versions.add(version);
    litVersions.set(packageName, versions);
  }

  for (const [packageName, versions] of litVersions) {
    if (versions.size < 2) continue;
    const formattedVersions = [...versions]
      .map((version) => version ?? "unknown")
      .sort(compareStrings);
    throw new Error(
      `Multiple versions of Lit runtime package ${packageName} were resolved: ${formattedVersions.join(", ")}. A browser bundle must use one version of each Lit runtime package.`
    );
  }

  return [...dependencies.values()].sort(
    (left, right) =>
      compareStrings(left.name, right.name) ||
      compareStrings(left.version ?? "", right.version ?? "")
  );
}

function isBrowserCompatibilityReplacement(moduleId) {
  const normalizedId = moduleId.replace(/^\0/, "");
  return VITE_BROWSER_COMPATIBILITY_MODULES.some((prefix) =>
    normalizedId.startsWith(prefix)
  );
}

function assertNoBrowserCompatibilityReplacements(
  moduleIds,
  compatibilityImporters = new Map()
) {
  const replacement = moduleIds
    .find(isBrowserCompatibilityReplacement)
    ?.replace(/^\0/, "");
  if (!replacement) return;

  const importers = compatibilityImporters.get(replacement) ?? [];
  const importerDetail = importers.length
    ? ` Imported by: ${importers.join(", ")}.`
    : "";
  throw new Error(
    `Vite emitted the browser-compatibility replacement module "${replacement}". This usually means a dependency was externalized for browser compatibility or an optional peer dependency could not be resolved; browser bundles do not allow these substitutions.${importerDetail}`
  );
}

function createCompatibilityGraphPlugin(catalog, compatibilityImporters) {
  return {
    name: "mandibula-browser-bundle-compatibility-validator",
    enforce: "post",
    generateBundle() {
      for (const id of this.getModuleIds()) {
        if (!isBrowserCompatibilityReplacement(id)) continue;
        const importers = this.getModuleInfo(id)?.importers ?? [];
        compatibilityImporters.set(
          id.replace(/^\0/, ""),
          [
            ...new Set(
              importers.map((importer) => moduleIdentity(importer, catalog).id)
            ),
          ].sort(compareStrings)
        );
      }
    },
  };
}

function validateBuildOutput(
  output,
  {
    sourcemap = false,
    catalog,
    outputDirectory,
    includeModuleIds = true,
    compatibilityImporters,
  } = {}
) {
  const entries = Array.isArray(output) ? output : [];
  const chunks = entries.filter((entry) => entry?.type === "chunk");
  const assets = entries.filter((entry) => entry?.type === "asset");
  if (chunks.length !== 1) {
    throw new Error(
      `A browser bundle must contain exactly one executable JavaScript chunk; Vite produced ${chunks.length}.`
    );
  }
  const [chunk] = chunks;
  const moduleIds = Object.keys(chunk.modules ?? {});
  assertNoBrowserCompatibilityReplacements(moduleIds, compatibilityImporters);
  if (!chunk.isEntry || typeof chunk.code !== "string" || !chunk.code.trim()) {
    throw new Error(
      "Vite did not produce an executable browser-bundle entry chunk."
    );
  }
  const staticImports = chunk.imports ?? [];
  if (staticImports.length) {
    throw new Error(
      `The browser bundle has static runtime imports or external modules: ${staticImports.join(", ")}.`
    );
  }
  const dynamicImports = chunk.dynamicImports ?? [];
  if (dynamicImports.length) {
    throw new Error(
      `The browser bundle has dynamic runtime imports: ${dynamicImports.join(", ")}.`
    );
  }

  const sourcemapAssets = assets.filter((asset) =>
    /\.map$/i.test(asset.fileName)
  );
  const runtimeAssets = assets.filter(
    (asset) => !/\.map$/i.test(asset.fileName)
  );
  if (runtimeAssets.length) {
    throw new Error(
      `The single-file browser-bundle contract does not allow runtime assets: ${runtimeAssets.map((asset) => asset.fileName).join(", ")}.`
    );
  }
  if (!sourcemap && sourcemapAssets.length) {
    throw new Error(
      "Vite emitted a source map although sourcemaps were disabled."
    );
  }
  if (sourcemap && sourcemapAssets.length !== 1) {
    throw new Error(
      `A requested browser-bundle sourcemap must produce exactly one map asset; Vite produced ${sourcemapAssets.length}.`
    );
  }
  if (
    sourcemapAssets.length &&
    sourcemapAssets[0].fileName !== `${chunk.fileName}.map`
  ) {
    throw new Error(
      `The source map must belong to the JavaScript entry ${chunk.fileName}.`
    );
  }

  let sourceMap;
  if (sourcemapAssets.length) {
    const parsedMap = JSON.parse(assetSource(sourcemapAssets[0]));
    if (catalog && outputDirectory) {
      parsedMap.sources = (parsedMap.sources ?? []).map((source) =>
        sourceMapIdentity(source, catalog, outputDirectory)
      );
    }
    parsedMap.sourceRoot = "";
    sourceMap = JSON.stringify(parsedMap);
  }

  return {
    code: chunk.code,
    sourceMap,
    ...(includeModuleIds ? { moduleIds } : {}),
    staticImports,
    dynamicImports,
    fileName: chunk.fileName,
    javascriptChunkCount: chunks.length,
    runtimeAssets: runtimeAssets.map((asset) => asset.fileName),
  };
}

export function validateBrowserBundleOutput(
  output,
  { sourcemap = false } = {}
) {
  return validateBuildOutput(output, { sourcemap, includeModuleIds: false });
}

function flattenBuildOutput(result) {
  const outputs = Array.isArray(result) ? result : [result];
  return outputs.flatMap((item) =>
    Array.isArray(item?.output)
      ? item.output
      : item?.type === "chunk" || item?.type === "asset"
        ? [item]
        : []
  );
}

export async function buildBrowserBundle({
  packages,
  format = "iife",
  minify = false,
  sourcemap = false,
  root = REPOSITORY_ROOT,
} = {}) {
  if (format !== "iife" && format !== "esm") {
    throw new Error('Browser bundle format must be "iife" or "esm".');
  }
  if (typeof minify !== "boolean") {
    throw new Error("Browser bundle minify must be a boolean.");
  }
  if (typeof sourcemap !== "boolean") {
    throw new Error("Browser bundle sourcemap must be a boolean.");
  }

  const catalog = await loadCatalog(root);
  const selectedPackages = normalizeSelection(packages, catalog);
  const cacheDirectory = await mkdtemp(
    join(tmpdir(), "mandibula-browser-bundle-")
  );
  const resolvedWorkspacePackages = new Set();
  const compatibilityImporters = new Map();
  let buildResult;
  try {
    buildResult = await viteBuild({
      root: catalog.root,
      configFile: false,
      envDir: false,
      publicDir: false,
      cacheDir: cacheDirectory,
      mode: "production",
      logLevel: "silent",
      resolve: { preserveSymlinks: false },
      build: {
        outDir: join(cacheDirectory, "output"),
        write: false,
        emptyOutDir: false,
        copyPublicDir: false,
        target: "es2020",
        minify: minify ? "esbuild" : false,
        sourcemap,
        cssCodeSplit: false,
        reportCompressedSize: false,
        rolldownOptions: {
          input: VIRTUAL_ENTRY,
          external: [],
          output: {
            format: format === "esm" ? "es" : "iife",
            codeSplitting: false,
          },
        },
      },
      plugins: [
        {
          name: "mandibula-browser-bundle-entry",
          enforce: "pre",
          resolveId(source) {
            if (source === VIRTUAL_ENTRY) return VIRTUAL_ENTRY_ID;
            return null;
          },
          load(id) {
            if (id !== VIRTUAL_ENTRY_ID) return null;
            return `${selectedPackages.map((name) => `import ${JSON.stringify(name)};`).join("\n")}\n`;
          },
        },
        createWorkspaceResolver(catalog, resolvedWorkspacePackages),
        createCompatibilityGraphPlugin(catalog, compatibilityImporters),
      ],
    });
  } finally {
    await rm(cacheDirectory, { recursive: true, force: true });
  }

  const output = flattenBuildOutput(buildResult);
  const validated = validateBuildOutput(output, {
    sourcemap,
    catalog,
    outputDirectory: join(cacheDirectory, "output"),
    compatibilityImporters,
  });
  const modules = validated.moduleIds
    .map((id) => moduleIdentity(id, catalog))
    .sort((left, right) => compareStrings(left.id, right.id));
  const workspacePackages = new Map();
  for (const module of modules) {
    if (!module.packageName) continue;
    if (module.packageName.startsWith(MANDIBULA_SCOPE)) {
      const pkg = catalog.byName.get(module.packageName);
      if (pkg) workspacePackages.set(pkg.name, pkg.version);
    }
  }
  const dependencies = summarizeBrowserBundleDependencies(modules);

  return {
    selectedPackages,
    workspacePackages: [...workspacePackages]
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([name, version]) => ({ name, version })),
    resolvedWorkspacePackages: [...resolvedWorkspacePackages].sort(
      compareStrings
    ),
    dependencies,
    format,
    minified: minify,
    code: validated.code,
    sourceMap: validated.sourceMap,
    byteSize: Buffer.byteLength(validated.code),
    outputContract: {
      javascriptChunks: validated.javascriptChunkCount,
      runtimeAssets: validated.runtimeAssets,
    },
    moduleGraph: {
      modules,
      count: modules.length,
      staticImports: validated.staticImports,
      dynamicImports: validated.dynamicImports,
    },
  };
}
