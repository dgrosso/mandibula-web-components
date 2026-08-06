import { html } from "lit";
import "@mandibula/responsive-text";
import { componentDescriptions, responsiveTextArgTypes } from "./arg-types.js";
import { storyCard } from "./helpers.js";

const meta = {
  title: "Mandíbula/Responsive text",
  component: "mdb-responsive-text",
  tags: ["autodocs"],
  argTypes: responsiveTextArgTypes,
  parameters: {
    docs: {
      description: { component: componentDescriptions.responsiveText },
    },
  },
};

export default meta;

export const Default = {
  render: () =>
    storyCard(
      "Default",
      html`<mdb-responsive-text
        >Text that scales with the viewport</mdb-responsive-text
      >`,
      "Defaults: 1rem minimum, 5vw fluid size, 3rem maximum."
    ),
};

export const FluidHeading = {
  render: () =>
    storyCard(
      "Fluid heading",
      html`<h2>
        <mdb-responsive-text
          min-size="2rem"
          fluid-size="8vw"
          max-size="6rem"
          line-height="1"
          >Responsive headline</mdb-responsive-text
        >
      </h2>`,
      "Use CSS values to tune the responsive range."
    ),
};

export const CustomProperties = {
  render: () =>
    storyCard(
      "Custom properties",
      html`<mdb-responsive-text
        style="--mdb-responsive-text-min-size: 1.25rem; --mdb-responsive-text-fluid-size: 4vw; --mdb-responsive-text-max-size: 2.5rem;"
        >Custom property overrides</mdb-responsive-text
      >`,
      "Override --mdb-responsive-text-min-size, --mdb-responsive-text-fluid-size, --mdb-responsive-text-max-size, or --mdb-responsive-text-line-height."
    ),
};
