import { html } from "lit";
import "@mandibula/suspense";
import "@mandibula/spinner";
import { componentDescriptions, suspenseArgTypes } from "./arg-types.js";
import { storyCard } from "./helpers.js";

const changeState = (method) => (event) => {
  const suspense = event.currentTarget
    .closest(".demo-stage")
    .querySelector("mdb-suspense");
  const content = suspense.firstElementChild;

  if (method === "error") {
    suspense.setError(new Error("Storybook demo error"), content);
  } else {
    suspense[method](content);
  }
};

const meta = {
  title: "Mandíbula/Suspense",
  component: "mdb-suspense",
  tags: ["autodocs"],
  argTypes: suspenseArgTypes,
  parameters: {
    docs: {
      description: { component: componentDescriptions.suspense },
    },
  },
};

export default meta;

export const ManualStates = {
  render: () =>
    storyCard(
      "Manual states",
      html`
        <mdb-suspense
          ><div class="demo-swatch">Async content</div>
          <div slot="fallback">Could not load.</div></mdb-suspense
        >
        <div class="demo-actions">
          <button type="button" @click=${changeState("setLoading")}>
            Loading
          </button>
          <button type="button" @click=${changeState("setSuccess")}>
            Success
          </button>
          <button type="button" @click=${changeState("error")}>Error</button>
        </div>
      `,
      "Methods: watch(), setLoading(), setSuccess(), setError(), waitForLoad()."
    ),
};

export const CustomLoader = {
  render: () =>
    storyCard(
      "Custom loader",
      html`
        <mdb-suspense
          ><div class="demo-swatch">Content</div>
          <div slot="loader">
            <mdb-spinner></mdb-spinner><span>Loading preview…</span>
          </div></mdb-suspense
        >
      `,
      "Slots: default, loader, fallback."
    ),
};

export const Debug = {
  render: () =>
    storyCard(
      "Debug",
      html`<mdb-suspense debug
        ><div class="demo-swatch">Debug target</div></mdb-suspense
      >`,
      "debug exposes internal state for development."
    ),
};
