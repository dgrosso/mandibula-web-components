import { packDistribution, requireCliValue } from "./release-lib.mjs";

const mode = process.argv[2];
const output = requireCliValue(process.argv, "--output", undefined);
const tag = requireCliValue(process.argv, "--tag", process.env.RELEASE_TAG);
const result = await packDistribution({ mode, tag, output });
console.log(
  JSON.stringify(
    {
      output: result.outputPath,
      packages: result.assets.length,
      manifest:
        mode === "github" ? "release-manifest.json" : "npm-pack-manifest.json",
    },
    null,
    2
  )
);
