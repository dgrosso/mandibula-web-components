import { resolve } from "node:path";

const allowedHosts = process.env.STORYBOOK_ALLOWED_HOSTS?.split(",")
  .map((host) => host.trim())
  .filter(Boolean);

/** @type {import('@storybook/web-components-vite').StorybookConfig} */
const config = {
  stories: ["../stories/**/*.stories.js"],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/web-components-vite",
    options: {},
  },
  ...(allowedHosts ? { core: { allowedHosts } } : {}),
  staticDirs: [
    {
      from: resolve(import.meta.dirname, "../demo/assets"),
      to: "/assets",
    },
  ],
  docs: {
    autodocs: "tag",
  },
};

export default config;
