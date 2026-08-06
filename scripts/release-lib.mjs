import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";

const REPOSITORY = "dgrosso/mandibula-web-components";
const RELEASE_BASE = `https://github.com/${REPOSITORY}/releases/download`;

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function packageFilename(name, version) {
  const unscoped = name.replace(/^@([^/]+)\//, "$1-");
  return `${unscoped.replaceAll("/", "-")}-${version}.tgz`;
}

function workspacePatterns(rootPackage) {
  const workspaces = rootPackage.workspaces;
  return Array.isArray(workspaces) ? workspaces : (workspaces?.packages ?? []);
}

function packageDirectories(root, patterns) {
  return patterns.flatMap((pattern) => {
    const hasWildcard = pattern.endsWith("/*");
    const directory = resolve(
      root,
      hasWildcard ? pattern.slice(0, -2) : pattern
    );
    if (!hasWildcard) return [directory];
    try {
      return readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(directory, entry.name));
    } catch {
      return [];
    }
  });
}

export async function discoverWorkspaces(root = process.cwd()) {
  const rootPath = resolve(root);
  const rootPackage = await readJson(join(rootPath, "package.json"));
  const packages = [];
  for (const directory of packageDirectories(
    rootPath,
    workspacePatterns(rootPackage)
  )) {
    const path = join(directory, "package.json");
    let configuration;
    try {
      configuration = await readJson(path);
    } catch {
      continue;
    }
    if (configuration.private === true) continue;
    if (
      typeof configuration.name !== "string" ||
      typeof configuration.version !== "string"
    ) {
      throw new Error(
        `Workspace ${relative(rootPath, directory)} must define a name and version.`
      );
    }
    if (!configuration.name.startsWith("@mandibula/")) {
      throw new Error(
        `Public workspace ${relative(rootPath, directory)} must use the @mandibula scope.`
      );
    }
    if (
      !configuration.license ||
      !configuration.files ||
      !configuration.exports
    ) {
      throw new Error(
        `Workspace ${configuration.name} is missing required package metadata.`
      );
    }
    const dependencySections = [
      "dependencies",
      "optionalDependencies",
      "peerDependencies",
    ];
    const dependencies = Object.fromEntries(
      dependencySections.flatMap((section) =>
        Object.entries(configuration[section] ?? {}).map(([name, range]) => [
          name,
          { section, range },
        ])
      )
    );
    packages.push({
      name: configuration.name,
      version: configuration.version,
      path: directory,
      dependencies,
      configuration,
      isAggregate:
        configuration.name === "@mandibula/web-components" ||
        Object.keys(dependencies).some((name) =>
          name.startsWith("@mandibula/")
        ),
    });
  }
  packages.sort((a, b) => a.name.localeCompare(b.name));
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  for (const pkg of packages) {
    for (const [name] of Object.entries(pkg.dependencies)) {
      if (name.startsWith("@mandibula/") && !byName.has(name)) {
        throw new Error(
          `${pkg.name} depends on unknown public workspace ${name}.`
        );
      }
    }
  }
  return { root: rootPath, rootPackage, packages, byName };
}

export function semverParts(version) {
  const match = String(version).match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return match ? match.slice(1, 4).map(Number) : null;
}

export function semverSatisfies(version, range) {
  const actual = semverParts(version);
  if (!actual || typeof range !== "string") return false;
  const trimmed = range.trim();
  if (["*", "latest", "x", "X"].includes(trimmed)) return true;
  const exact = trimmed.replace(/^[=v]/, "");
  const exactParts = semverParts(exact);
  if (exactParts)
    return actual.every((value, index) => value === exactParts[index]);
  const operator = trimmed.match(
    /^(\^|~|>=|>|<=|<)\s*(\d+)(?:\.(\d+|x|X|\*))?(?:\.(\d+|x|X|\*))?/
  );
  if (!operator) return false;
  const base = [
    Number(operator[2]),
    Number(operator[3] ?? 0),
    Number(operator[4] ?? 0),
  ];
  const compare =
    actual[0] - base[0] || actual[1] - base[1] || actual[2] - base[2];
  if (operator[1] === ">=") return compare >= 0;
  if (operator[1] === ">") return compare > 0;
  if (operator[1] === "<=") return compare <= 0;
  if (operator[1] === "<") return compare < 0;
  if (operator[1] === "~")
    return actual[0] === base[0] && actual[1] === base[1] && compare >= 0;
  if (base[0] > 0) return actual[0] === base[0] && compare >= 0;
  if (base[1] > 0)
    return actual[0] === 0 && actual[1] === base[1] && compare >= 0;
  return actual[0] === 0 && actual[1] === 0 && actual[2] === base[2];
}

export function releaseTag(commitSha) {
  const sha = String(commitSha)
    .replace(/[^0-9a-f]/gi, "")
    .toLowerCase();
  return `release-${(sha || "unknown").slice(0, 12)}`;
}

export function gitOutput(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

async function packageAtRevision(root, revision, packagePath) {
  try {
    return JSON.parse(
      execFileSync(
        "git",
        [
          "show",
          `${revision}:${relative(root, join(packagePath, "package.json"))}`,
        ],
        { cwd: root, encoding: "utf8" }
      )
    );
  } catch {
    return null;
  }
}

export async function planRelease(root = process.cwd(), baseRevision = "") {
  const discovery = await discoverWorkspaces(root);
  const commitSha = gitOutput(["rev-parse", "HEAD"], root) || "unknown";
  const usableBase =
    baseRevision &&
    !/^0+$/.test(baseRevision) &&
    gitOutput(["rev-parse", "--verify", `${baseRevision}^{commit}`], root);
  const changedPackages = [];
  if (usableBase) {
    for (const pkg of discovery.packages) {
      const previous = await packageAtRevision(
        discovery.root,
        usableBase,
        pkg.path
      );
      if (previous?.version !== pkg.version)
        changedPackages.push({ name: pkg.name, version: pkg.version });
    }
  }
  return {
    releaseRequired: changedPackages.length > 0,
    changedPackages,
    packages: discovery.packages.map(({ name, version }) => ({
      name,
      version,
    })),
    commitSha,
    releaseTag: releaseTag(commitSha),
    npmPublicationRequired: changedPackages.length > 0,
  };
}

function orderedPackages(packages) {
  const result = [];
  const visiting = new Set();
  const visited = new Set();
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
  function visit(pkg) {
    if (visited.has(pkg.name)) return;
    if (visiting.has(pkg.name))
      throw new Error(`Circular internal dependency involving ${pkg.name}.`);
    visiting.add(pkg.name);
    for (const name of Object.keys(pkg.dependencies).filter((dependency) =>
      dependency.startsWith("@mandibula/")
    ))
      visit(byName.get(name));
    visiting.delete(pkg.name);
    visited.add(pkg.name);
    result.push(pkg);
  }
  for (const pkg of packages) visit(pkg);
  return result;
}

async function archivePackageJson(archivePath) {
  const output = execFileSync(
    "tar",
    ["-xOf", archivePath, "package/package.json"],
    { encoding: "utf8" }
  );
  return JSON.parse(output);
}

export async function packDistribution({
  root = process.cwd(),
  mode,
  tag = "",
  output,
}) {
  if (!["npm", "github"].includes(mode))
    throw new Error(`Unknown packaging mode: ${mode}`);
  if (mode === "github" && !tag)
    throw new Error("GitHub packaging requires a release tag.");
  const discovery = await discoverWorkspaces(root);
  const outputPath = resolve(
    root,
    output ??
      (mode === "github" ? "release-artifacts/github" : "release-artifacts/npm")
  );
  await rm(outputPath, { recursive: true, force: true });
  await mkdir(outputPath, { recursive: true });
  const staging = await mkdtemp(join(tmpdir(), "mandibula-release-"));
  const assets = [];
  const assetNames = new Set();
  try {
    for (const pkg of orderedPackages(discovery.packages)) {
      let packageRoot = pkg.path;
      if (mode === "github") {
        packageRoot = join(staging, pkg.name.replace("@mandibula/", ""));
        await cp(pkg.path, packageRoot, {
          recursive: true,
          filter: (source) => !source.includes("/node_modules/"),
        });
        const stagedConfig = structuredClone(pkg.configuration);
        for (const [dependencyName, dependency] of Object.entries(
          pkg.dependencies
        )) {
          if (!dependencyName.startsWith("@mandibula/")) continue;
          const dependencyPackage = discovery.byName.get(dependencyName);
          if (!semverSatisfies(dependencyPackage.version, dependency.range)) {
            throw new Error(
              `${pkg.name} declares ${dependencyName}@${dependency.range}, incompatible with ${dependencyPackage.version}.`
            );
          }
          stagedConfig[dependency.section][dependencyName] =
            `${RELEASE_BASE}/${tag}/${packageFilename(dependencyName, dependencyPackage.version)}`;
        }
        await writeFile(
          join(packageRoot, "package.json"),
          `${JSON.stringify(stagedConfig, null, 2)}\n`
        );
      }
      const result = JSON.parse(
        execFileSync(
          "npm",
          ["pack", "--json", "--pack-destination", outputPath],
          { cwd: packageRoot, encoding: "utf8" }
        )
      )[0];
      const filename = result.filename;
      if (assetNames.has(filename))
        throw new Error(`Duplicate release asset filename: ${filename}`);
      assetNames.add(filename);
      const archivePath = join(outputPath, filename);
      const checksum = createHash("sha256")
        .update(await readFile(archivePath))
        .digest("hex");
      const archivedConfig = await archivePackageJson(archivePath);
      if (
        archivedConfig.name !== pkg.name ||
        archivedConfig.version !== pkg.version
      )
        throw new Error(`Archive metadata mismatch for ${pkg.name}.`);
      if (mode === "npm") {
        execFileSync("npm", ["exec", "--", "publint", packageRoot], {
          stdio: "inherit",
        });
      }
      assets.push({ pkg, filename, checksum, archivedConfig });
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  const commitSha = gitOutput(["rev-parse", "HEAD"], root) || "unknown";
  const generatedAt = new Date().toISOString();
  const manifest =
    mode === "github"
      ? {
          repository: REPOSITORY,
          distributionTarget: "github-release",
          releaseTag: tag,
          commitSha,
          generatedAt,
          packages: assets.map(
            ({ pkg, filename, checksum, archivedConfig }) => ({
              name: pkg.name,
              version: pkg.version,
              filename,
              sha256: checksum,
              assetUrl: `${RELEASE_BASE}/${tag}/${filename}`,
              installCommand: `npm install ${RELEASE_BASE}/${tag}/${filename}`,
              internalDependencyUrls: Object.fromEntries(
                Object.keys(pkg.dependencies)
                  .filter((name) => name.startsWith("@mandibula/"))
                  .map((name) => [
                    name,
                    archivedConfig.dependencies?.[name] ??
                      archivedConfig.optionalDependencies?.[name] ??
                      archivedConfig.peerDependencies?.[name],
                  ])
              ),
            })
          ),
        }
      : {
          distributionTarget: "npm",
          commitSha,
          generatedAt,
          packages: assets.map(({ pkg, filename, checksum }) => ({
            name: pkg.name,
            version: pkg.version,
            filename,
            sha256: checksum,
            npmSpecifier: `${pkg.name}@${pkg.version}`,
            internalDependencyRanges: Object.fromEntries(
              Object.entries(pkg.dependencies)
                .filter(([name]) => name.startsWith("@mandibula/"))
                .map(([name, dependency]) => [name, dependency.range])
            ),
          })),
        };
  const manifestName =
    mode === "github" ? "release-manifest.json" : "npm-pack-manifest.json";
  await writeFile(
    join(outputPath, manifestName),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  return { outputPath, manifest, assets };
}

export function requireCliValue(args, name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
}

export { REPOSITORY, RELEASE_BASE, orderedPackages };
