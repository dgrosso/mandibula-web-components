import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const demoRoot = resolve(import.meta.dirname, "demo");
const pages = Object.fromEntries(
  readdirSync(demoRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(resolve(demoRoot, entry.name, "index.html"))
    )
    .map((entry) => [entry.name, resolve(demoRoot, entry.name, "index.html")])
);

export default defineConfig({
  root: demoRoot,
  base: "./",
  build: {
    outDir: resolve(import.meta.dirname, "site"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(demoRoot, "index.html"),
        ...pages,
      },
    },
  },
});
