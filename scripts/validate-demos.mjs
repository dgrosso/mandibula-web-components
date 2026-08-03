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
  const path = resolve(root, "demo", packageName, "index.html");
  let html;
  try {
    html = await readFile(path, "utf8");
  } catch {
    failures.push(`${packageName}: missing demo page`);
    continue;
  }

  const cardCount = (html.match(/class="demo-card"/g) || []).length;
  const h1Count = (html.match(/<h1(?:\s|>)/g) || []).length;
  if (cardCount < 3) failures.push(`${packageName}: fewer than 3 examples`);
  if (h1Count !== 1) failures.push(`${packageName}: expected exactly one h1`);
  if (!html.includes('class="skip-link"')) {
    failures.push(`${packageName}: missing skip link`);
  }
  if (!html.includes("data-demo-nav")) {
    failures.push(`${packageName}: missing shared demo navigation`);
  }
  if (!html.includes('src="../main.js"')) {
    failures.push(`${packageName}: missing shared demo entrypoint`);
  }
}

if (failures.length) {
  throw new Error(`Demo validation failed:\n${failures.join("\n")}`);
}

console.log(`Demo validation: ${packages.length} package pages ok`);
