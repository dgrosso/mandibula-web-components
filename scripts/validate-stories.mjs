import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageEntries = await readdir(resolve(root, "packages"), {
  withFileTypes: true,
});
const packages = packageEntries
  .filter((entry) => entry.isDirectory() && entry.name !== "web-components")
  .map((entry) => entry.name)
  .sort();
const failures = [];

for (const packageName of packages) {
  const path = resolve(root, "stories", `${packageName}.stories.js`);
  let source;
  try {
    source = await readFile(path, "utf8");
  } catch {
    failures.push(`${packageName}: missing Storybook file`);
    continue;
  }

  const storyCount = (source.match(/^export const /gm) || []).length;
  if (storyCount < 3) failures.push(`${packageName}: fewer than 3 stories`);
  if (!source.includes(`component: "mdb-${packageName}"`)) {
    failures.push(`${packageName}: missing component metadata`);
  }
}

if (failures.length) {
  throw new Error(`Storybook validation failed:\n${failures.join("\n")}`);
}

console.log(`Storybook validation: ${packages.length} package story files ok`);
