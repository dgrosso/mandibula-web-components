import { runBrowserBundleCommand } from "./browser-bundle-cli-lib.mjs";

try {
  await runBrowserBundleCommand(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`Browser bundle failed: ${error.message}\n`);
  process.exitCode = 1;
}
