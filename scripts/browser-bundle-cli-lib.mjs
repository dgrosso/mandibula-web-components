import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildBrowserBundle,
  normalizeBrowserBundleSelection,
} from "./browser-bundle-lib.mjs";
import { writeBrowserBundleArtifacts } from "./browser-bundle-artifacts.mjs";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const browserBundleHelp = `Usage: npm run build:browser -- <package> [<package> ...] [options]

Build a self-contained browser bundle from local Mandíbula workspace packages.

Options:
  --format iife|esm   Bundle format (default: iife)
  --out-dir <path>    Output directory (default: dist/browser)
  --minify            Minify the JavaScript (default)
  --no-minify         Disable minification
  --sourcemap         Write a source map
  --no-sourcemap      Disable source maps (default)
  --help              Show this help`;

export function parseBrowserBundleArguments(args) {
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
    throw new Error("Browser bundle arguments must be strings.");
  }
  const options = {
    packages: [],
    format: "iife",
    minify: true,
    sourcemap: false,
    outDir: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help") return { help: true };
    if (argument === "--format" || argument === "--out-dir") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
      index += 1;
      if (argument === "--format") {
        if (value !== "iife" && value !== "esm") {
          throw new Error('Invalid --format value. Choose "iife" or "esm".');
        }
        options.format = value;
      } else {
        options.outDir = value;
      }
      continue;
    }
    if (argument === "--minify") {
      options.minify = true;
      continue;
    }
    if (argument === "--no-minify") {
      options.minify = false;
      continue;
    }
    if (argument === "--sourcemap") {
      options.sourcemap = true;
      continue;
    }
    if (argument === "--no-sourcemap") {
      options.sourcemap = false;
      continue;
    }
    if (argument.startsWith("-")) {
      throw new Error(`Unknown browser bundle option: ${argument}`);
    }
    options.packages.push(argument);
  }

  if (options.packages.length === 0) {
    throw new Error("Choose one or more Mandíbula packages to build.");
  }
  return options;
}

export function resolveBrowserBundleOutputDirectory(
  outDir,
  { root = REPOSITORY_ROOT, cwd = process.cwd() } = {}
) {
  return outDir ? resolve(cwd, outDir) : join(resolve(root), "dist", "browser");
}

export async function runBrowserBundleCommand(
  args,
  {
    root = REPOSITORY_ROOT,
    cwd = process.cwd(),
    stdout = process.stdout,
    build = buildBrowserBundle,
    normalize = normalizeBrowserBundleSelection,
    writeArtifacts = writeBrowserBundleArtifacts,
  } = {}
) {
  const options = parseBrowserBundleArguments(args);
  if (options.help) {
    stdout.write(`${browserBundleHelp}\n`);
    return { help: true };
  }

  const packages = await normalize(options.packages, { root });
  const result = await build({
    packages,
    format: options.format,
    minify: options.minify,
    sourcemap: options.sourcemap,
    root,
  });
  const outputDirectory = resolveBrowserBundleOutputDirectory(options.outDir, {
    root,
    cwd,
  });
  const artifacts = await writeArtifacts(result, { outDir: outputDirectory });
  stdout.write(
    `Built ${result.selectedPackages.join(" + ")}\n${artifacts.javascriptFile}\n${(artifacts.byteSize / 1024).toFixed(1)} KB\n`
  );
  return { result, artifacts, outputDirectory };
}
