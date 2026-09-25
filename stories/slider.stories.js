import { html } from "lit";
import "@mandibula/slider";
import { componentDescriptions, sliderArgTypes } from "./arg-types.js";
import { showEvent, storyCard } from "./helpers.js";

const meta = {
  title: "Mandíbula/Slider",
  component: "mdb-slider",
  tags: ["autodocs"],
  argTypes: sliderArgTypes,
  parameters: {
    docs: {
      description: { component: componentDescriptions.slider },
    },
  },
};

export default meta;

export const Basic = {
  render: () =>
    storyCard(
      "Basic",
      html`
        <mdb-slider label="Feature highlights" @change=${showEvent}>
          <article>
            <h3>First slide</h3>
            <p>Swipe, scroll, or use the controls.</p>
          </article>
          <article>
            <h3>Second slide</h3>
            <p>Native scrolling remains the interaction baseline.</p>
          </article>
          <article>
            <h3>Third slide</h3>
            <p>The active index follows the snapped slide.</p>
          </article>
        </mdb-slider>
        <div class="demo-actions">
          <button
            type="button"
            @click=${(event) =>
              event.currentTarget
                .closest(".demo-stage")
                .querySelector("mdb-slider")
                .prev()}
          >
            Previous
          </button>
          <button
            type="button"
            @click=${(event) =>
              event.currentTarget
                .closest(".demo-stage")
                .querySelector("mdb-slider")
                .next()}
          >
            Next
          </button>
        </div>
        <output class="demo-event" data-event-output>Waiting…</output>
      `,
      "Methods: prev(), next(), goTo(); event: change."
    ),
};

export const Peeking = {
  render: () =>
    storyCard(
      "Peeking slides",
      html`
        <mdb-slider
          style="--mdb-slider-slide-size: 82%; --mdb-slider-gap: 1rem;"
        >
          <article>Alpha</article>
          <article>Beta</article>
          <article>Gamma</article>
        </mdb-slider>
      `,
      "Use CSS custom properties to expose part of the next slide."
    ),
};

export const LoopingControls = {
  render: () =>
    storyCard(
      "Looping controls",
      html`
        <mdb-slider loop current="1">
          <article>One</article>
          <article>Two</article>
          <article>Three</article>
        </mdb-slider>
      `,
      "loop affects imperative controls; touch scrolling remains native and finite."
    ),
};
