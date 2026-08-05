import { html } from "lit";
import "@mandibula/pointer";
import { componentDescriptions } from "./arg-types.js";
import { storyCard } from "./helpers.js";

const meta = {
  title: "Mandíbula/Pointer",
  component: "mdb-pointer",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: { component: componentDescriptions.pointer },
    },
  },
};

export default meta;

export const TextBadge = {
  render: () =>
    storyCard(
      "Text badge",
      html`
        <mdb-pointer></mdb-pointer>
        <template id="mdb-pointer-label"
          ><span class="demo-pointer-badge" part="text"></span
        ></template>
        <div class="demo-pointer-targets">
          <button type="button" data-pointer="label:Inspect">
            Hover to inspect
          </button>
          <a href="#pointer-link" data-pointer="label:Open">Hover to open</a>
        </div>
      `,
      'Format: data-pointer="template:value".'
    ),
};

export const CustomTemplate = {
  render: () =>
    storyCard(
      "Custom template",
      html`
        <template id="mdb-pointer-dot"
          ><span class="demo-pointer-badge">●</span></template
        >
        <p data-pointer="dot:">Move a mouse over this paragraph.</p>
      `,
      "Templates use ID mdb-pointer-{type}."
    ),
};

export const ProgressiveEnhancement = {
  render: () =>
    storyCard(
      "Progressive enhancement",
      html`<p>
        Content stays usable on touch, coarse pointers, and reduced-motion
        systems.
      </p>`,
      "Never encode essential information only in the pointer."
    ),
};
