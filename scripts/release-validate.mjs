import { execFileSync } from "node:child_process";
import { discoverWorkspaces } from "./release-lib.mjs";

const discovery = await discoverWorkspaces();
for (const pkg of discovery.packages) {
  execFileSync("npm", ["exec", "--", "publint", pkg.path], {
    stdio: "inherit",
  });
}
console.log(
  `Validated ${discovery.packages.length} public workspace packages.`
);
