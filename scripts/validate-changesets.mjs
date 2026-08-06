import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { discoverWorkspaces } from "./release-lib.mjs";

const BUMP_TYPES = new Set(["major", "minor", "patch", "none"]);

export function parseChangesetFrontmatter(contents, filename = "Changeset") {
  const lines = contents.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    throw new Error(
      `${filename} is missing a Changesets frontmatter opening delimiter (---).`
    );
  }
  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---"
  );
  if (end === -1) {
    throw new Error(
      `${filename} is missing a Changesets frontmatter closing delimiter (---).`
    );
  }
  const bumps = new Map();
  for (const [index, line] of lines.slice(1, end).entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(
      /^(?:"([^"]+)"|'([^']+)'|([^:]+))\s*:\s*([^\s#]+)\s*(?:#.*)?$/
    );
    if (!match)
      throw new Error(
        `${filename}:${index + 2} has invalid Changesets frontmatter. Expected "@scope/package": minor.`
      );
    const name = match[1] ?? match[2] ?? match[3].trim();
    const bump = match[4];
    if (!BUMP_TYPES.has(bump))
      throw new Error(
        `${filename}:${index + 2} has unsupported bump type "${bump}" for ${name}. Use major, minor, patch, or none.`
      );
    if (bumps.has(name))
      throw new Error(
        `${filename}:${index + 2} declares ${name} more than once.`
      );
    bumps.set(name, bump);
  }
  if (bumps.size === 0)
    throw new Error(`${filename} has empty Changesets frontmatter.`);
  return bumps;
}

export async function validateChangesets(root = process.cwd()) {
  const { byName } = await discoverWorkspaces(root);
  const changesetDirectory = join(root, ".changeset");
  let filenames;
  try {
    filenames = await readdir(changesetDirectory);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const errors = [];
  const validated = [];
  for (const filename of filenames
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort()) {
    const path = join(changesetDirectory, filename);
    let bumps;
    try {
      bumps = parseChangesetFrontmatter(
        await readFile(path, "utf8"),
        `.changeset/${filename}`
      );
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    for (const [name, bump] of bumps) {
      const packageInfo = byName.get(name);
      if (!packageInfo) {
        errors.push(
          `.changeset/${filename} references unknown public workspace ${name}.`
        );
        continue;
      }
      if (bump === "major" && Number(packageInfo.version.split(".")[0]) === 0) {
        errors.push(
          `${name} is still pre-1.0, but .changeset/${filename} requests a major bump. Use a minor bump for breaking changes during initial development, or explicitly update the project’s release policy before releasing 1.0.0.`
        );
      }
      validated.push({
        filename: `.changeset/${filename}`,
        name,
        bump,
        version: packageInfo.version,
      });
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return validated;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const validated = await validateChangesets();
    console.log(
      `Validated ${validated.length} pending Changeset package entries.`
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
