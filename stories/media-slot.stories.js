import { html } from "lit";
import "@mandibula/media-slot";
import { componentDescriptions, mediaSlotArgTypes } from "./arg-types.js";
import { storyCard } from "./helpers.js";

const meta = {
  title: "Mandíbula/Media slot",
  component: "mdb-media-slot",
  tags: ["autodocs"],
  argTypes: mediaSlotArgTypes,
  parameters: {
    docs: {
      description: { component: componentDescriptions.mediaSlot },
    },
  },
};

export default meta;

export const Image = {
  render: () =>
    storyCard(
      "Image",
      html`<mdb-media-slot
        src="./assets/landscape.svg?image=1"
        alt="Stylized mountains at sunset"
        width="1200"
        height="675"
        loading="eager"
      ></mdb-media-slot>`,
      "Options: src, srcset, sizes, alt, dimensions, loading."
    ),
};

export const ScopedSvg = {
  render: () =>
    storyCard(
      "Scoped SVG",
      html`<mdb-media-slot
        src="./assets/landscape.svg"
        alt="Stylized mountain illustration"
      ></mdb-media-slot>`,
      "SVG uses scoped identifiers and sanitized markup."
    ),
};

export const Background = {
  render: () =>
    storyCard(
      "Background",
      html`<mdb-media-slot
        src="./assets/landscape.svg?image=2"
        alt=""
        background
        width="1200"
        height="675"
      ></mdb-media-slot>`,
      "background is decorative when alt is empty."
    ),
};
