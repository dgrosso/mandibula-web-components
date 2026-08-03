import { html } from "lit";
import "@mandibula/spinner";
import { storyCard } from "./helpers.js";

const meta = {
  title: "Mandíbula/Spinner",
  component: "mdb-spinner",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A CSS loading indicator with sizing, color, template, and reduced-motion options.",
      },
    },
  },
};

export default meta;

export const Default = {
  render: () =>
    storyCard(
      "Default",
      html`<span role="status">
        <mdb-spinner aria-hidden="true"></mdb-spinner>
        Loading
      </span>`,
      "Provide a meaningful status or label."
    ),
};

export const ThemedSizes = {
  render: () =>
    storyCard(
      "Themed sizes",
      html`
        <mdb-spinner
          aria-hidden="true"
          style="--mdb-spinner-size: 2rem; --mdb-spinner-color: var(--demo-accent);"
        ></mdb-spinner>
        <mdb-spinner
          aria-hidden="true"
          style="--mdb-spinner-size: 3rem; --mdb-spinner-border-width: 0.3rem;"
        ></mdb-spinner>
      `,
      "Custom properties: size, color, background, border width."
    ),
};

export const CustomTemplate = {
  render: () =>
    storyCard(
      "Custom template",
      html`
        <template id="custom-spinner-template-story"
          ><span>Loading…</span></template
        >
        <mdb-spinner template="custom-spinner-template-story"></mdb-spinner>
      `,
      "template references a document template ID."
    ),
};
