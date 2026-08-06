import { writeFile } from "node:fs/promises";
import { planRelease } from "./release-lib.mjs";

const base = process.argv[2] || process.env.GITHUB_EVENT_BEFORE || "";
const plan = await planRelease(process.cwd(), base);
const json = JSON.stringify(plan, null, 2);
console.log(json);

if (process.env.GITHUB_OUTPUT) {
  await writeFile(
    process.env.GITHUB_OUTPUT,
    [
      `release_required=${plan.releaseRequired}`,
      `release_tag=${plan.releaseTag}`,
      `changed_packages=${JSON.stringify(plan.changedPackages)}`,
      `package_count=${plan.changedPackages.length}`,
    ].join("\n") + "\n",
    { flag: "a" }
  );
}
