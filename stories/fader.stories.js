import { html } from "lit";
import "@mandibula/fader";
import { componentDescriptions, faderArgTypes } from "./arg-types.js";
import { showEvent, storyCard } from "./helpers.js";

const meta = {
  title: "Mandíbula/Fader",
  component: "mdb-fader",
  tags: ["autodocs"],
  argTypes: faderArgTypes,
  parameters: {
    docs: {
      description: { component: componentDescriptions.fader },
    },
  },
};

export default meta;

export const Basic = {
  render: () =>
    storyCard(
      "Basic",
      html`
        <mdb-fader label="Feature highlights" @change=${showEvent}>
          <article>
            <h3>First item</h3>
            <p>Use arrow keys.</p>
          </article>
          <article>
            <h3>Second item</h3>
            <p>One active item.</p>
          </article>
          <article>
            <h3>Third item</h3>
            <p>Change event.</p>
          </article>
        </mdb-fader>
        <div class="demo-actions">
          <button
            type="button"
            @click=${(event) =>
              event.currentTarget
                .closest(".demo-stage")
                .querySelector("mdb-fader")
                .previous()}
          >
            Previous
          </button>
          <button
            type="button"
            @click=${(event) =>
              event.currentTarget
                .closest(".demo-stage")
                .querySelector("mdb-fader")
                .next()}
          >
            Next
          </button>
        </div>
        <output class="demo-event" data-event-output>Waiting…</output>
      `,
      "Methods: previous(), next(), goTo(); event: change."
    ),
};

export const Looping = {
  render: () =>
    storyCard(
      "Looping",
      html`
        <mdb-fader loop current="1" duration="500">
          <div>Alpha</div>
          <div>Beta</div>
          <div>Gamma</div>
        </mdb-fader>
      `,
      "loop wraps navigation; current chooses the item."
    ),
};

export const CustomMotion = {
  render: () =>
    storyCard(
      "Custom motion",
      html`
        <mdb-fader
          in-duration="700"
          out-duration="250"
          in-transform="translateY(1rem)"
          out-transform="scale(.96)"
          easing="ease-out"
        >
          <div>Custom entrance</div>
          <div>Custom exit</div>
        </mdb-fader>
      `,
      "Separate in/out timing, easing, and transforms."
    ),
};
