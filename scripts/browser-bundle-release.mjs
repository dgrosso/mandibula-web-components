import { prepareBrowserBundleRelease } from "./browser-bundle-release-lib.mjs";

function option(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--"))
    throw new Error(`${name} requires a value.`);
  return value;
}

async function main() {
  const args = process.argv.slice(2);
  const allowed = new Set(["--tag", "--output"]);
  for (const arg of args) {
    if (arg.startsWith("--") && !allowed.has(arg))
      throw new Error(`Unknown release browser-bundle option: ${arg}`);
  }
  const tag = option(args, "--tag");
  const output = option(args, "--output");
  if (!tag) throw new Error("A release tag is required (--tag <release-tag>).");
  if (!output)
    throw new Error("An output directory is required (--output <directory>).");
  const result = await prepareBrowserBundleRelease({ tag, output });
  console.log(
    JSON.stringify(
      {
        packages: result.manifest.bundles.length,
        manifest: "browser-bundle-manifest.json",
        assets: result.assets,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
