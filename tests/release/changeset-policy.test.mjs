import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { validateChangesets } from "../../scripts/validate-changesets.mjs";

async function fixture({ packages = [], changesets = {} } = {}) {
  const root = await mkdtemp(join(tmpdir(), "mandibula-changeset-test-"));
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ private: true, workspaces: ["packages/*"] })
  );
  for (const pkg of packages) {
    const directory = join(
      root,
      "packages",
      pkg.directory ?? pkg.name.slice("@mandibula/".length)
    );
    await mkdir(join(directory, "src"), { recursive: true });
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({
        name: pkg.name,
        version: pkg.version,
        private: pkg.private === true,
        license: "MIT",
        files: ["src"],
        exports: { ".": "./src/index.js" },
      })
    );
    await writeFile(join(directory, "src/index.js"), "export {};\n");
  }
  await mkdir(join(root, ".changeset"), { recursive: true });
  for (const [filename, contents] of Object.entries(changesets)) {
    await writeFile(join(root, ".changeset", filename), contents);
  }
  return root;
}

async function withFixture(options, callback) {
  const root = await fixture(options);
  try {
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const changeset = (entries) => `---\n${entries}\n---\n\nA change.\n`;

test("rejects a major Changeset for a 0.x package", async () => {
  await withFixture(
    {
      packages: [{ name: "@mandibula/widget", version: "0.1.0" }],
      changesets: { "breaking.md": changeset('"@mandibula/widget": major') },
    },
    async (root) => {
      await assert.rejects(
        () => validateChangesets(root),
        /@mandibula\/widget.*breaking\.md.*Use a minor bump/
      );
    }
  );
});

test("accepts minor and patch Changesets for a 0.x package", async () => {
  await withFixture(
    {
      packages: [{ name: "@mandibula/widget", version: "0.1.0" }],
      changesets: {
        "feature.md": changeset('"@mandibula/widget": minor'),
        "fix.md": changeset('"@mandibula/widget": patch'),
      },
    },
    async (root) => {
      const validated = await validateChangesets(root);
      assert.deepEqual(
        validated.map(({ bump }) => bump),
        ["minor", "patch"]
      );
    }
  );
});

test("accepts a major Changeset for a stable package", async () => {
  await withFixture(
    {
      packages: [{ name: "@mandibula/widget", version: "1.0.0" }],
      changesets: { "breaking.md": changeset('"@mandibula/widget": major') },
    },
    async (root) => {
      assert.equal((await validateChangesets(root))[0].bump, "major");
    }
  );
});

test("validates multiple packages independently", async () => {
  await withFixture(
    {
      packages: [
        { name: "@mandibula/widget", version: "0.1.0" },
        { name: "@mandibula/stable", version: "1.0.0" },
      ],
      changesets: {
        "mixed.md": changeset(
          '"@mandibula/widget": major\n"@mandibula/stable": major'
        ),
      },
    },
    async (root) => {
      await assert.rejects(
        () => validateChangesets(root),
        /@mandibula\/widget/
      );
      await assert.rejects(() => validateChangesets(root), /mixed\.md/);
    }
  );
});

test("ignores private workspaces and the Changesets README", async () => {
  await withFixture(
    {
      packages: [
        { name: "@mandibula/widget", version: "0.1.0" },
        {
          name: "private-fixture",
          directory: "private",
          version: "0.1.0",
          private: true,
        },
      ],
      changesets: {
        "README.md": "not Changesets frontmatter",
        "feature.md": changeset('"@mandibula/widget": minor'),
      },
    },
    async (root) => {
      const validated = await validateChangesets(root);
      assert.deepEqual(
        validated.map(({ name }) => name),
        ["@mandibula/widget"]
      );
    }
  );
});

test("succeeds when there are no pending Changesets", async () => {
  await withFixture(
    { packages: [{ name: "@mandibula/widget", version: "0.1.0" }] },
    async (root) => {
      assert.deepEqual(await validateChangesets(root), []);
    }
  );
});

test("reports unknown packages and malformed frontmatter clearly", async () => {
  await withFixture(
    {
      packages: [{ name: "@mandibula/widget", version: "0.1.0" }],
      changesets: {
        "unknown.md": changeset('"@mandibula/missing": minor'),
        "malformed.md": "---\nnot valid frontmatter\n---\n",
      },
    },
    async (root) => {
      await assert.rejects(
        () => validateChangesets(root),
        /unknown public workspace/
      );
      await assert.rejects(
        () => validateChangesets(root),
        /malformed\.md.*invalid Changesets frontmatter/
      );
    }
  );
});
