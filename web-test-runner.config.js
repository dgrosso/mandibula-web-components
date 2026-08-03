import { existsSync } from "node:fs";
import { playwrightLauncher } from "@web/test-runner-playwright";

const chromePath = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((path) => path && existsSync(path));

export default {
  files: "tests/**/*.test.js",
  nodeResolve: true,
  browsers: [
    playwrightLauncher({
      product: "chromium",
      launchOptions: chromePath ? { executablePath: chromePath } : {},
    }),
  ],
  testFramework: {
    config: {
      timeout: 5000,
    },
  },
};
