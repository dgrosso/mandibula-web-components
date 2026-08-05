import { html } from "lit";
import "@mandibula/scoped-inline-svg";
import { componentDescriptions, scopedInlineSvgArgTypes } from "./arg-types.js";
import { storyCard } from "./helpers.js";

const meta = {
  title: "Mandíbula/Scoped inline SVG",
  component: "mdb-scoped-inline-svg",
  tags: ["autodocs"],
  argTypes: scopedInlineSvgArgTypes,
  parameters: {
    docs: {
      description: { component: componentDescriptions.scopedInlineSvg },
    },
  },
};

export default meta;

export const ScopedIds = {
  render: () =>
    storyCard(
      "Scoped IDs",
      html`<mdb-scoped-inline-svg
        src="./assets/landscape.svg"
        aria-label="Mountain illustration"
      ></mdb-scoped-inline-svg>`,
      "Gradient and clip IDs become unique."
    ),
};

export const FillOverride = {
  render: () =>
    storyCard(
      "Fill override",
      html`<mdb-scoped-inline-svg
        src="./assets/landscape.svg"
        override-fill
        aria-label="Single-color mountain icon"
        style="color: var(--demo-accent)"
      ></mdb-scoped-inline-svg>`,
      "override-fill uses currentColor."
    ),
};

export const Decorative = {
  render: () =>
    storyCard(
      "Decorative",
      html`<mdb-scoped-inline-svg
        src="./assets/landscape.svg"
        aria-hidden="true"
      ></mdb-scoped-inline-svg>`,
      "Decorative SVG stays out of the accessibility tree."
    ),
};
