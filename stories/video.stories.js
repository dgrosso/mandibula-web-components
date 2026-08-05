import { html } from "lit";
import "@mandibula/video";
import { componentDescriptions, videoArgTypes } from "./arg-types.js";
import { storyCard } from "./helpers.js";

const videoSrc =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const meta = {
  title: "Mandíbula/Video",
  component: "mdb-video",
  tags: ["autodocs"],
  argTypes: videoArgTypes,
  parameters: {
    docs: {
      description: { component: componentDescriptions.video },
    },
  },
};

export default meta;

export const NativeControls = {
  render: () =>
    storyCard(
      "Native controls",
      html`<mdb-video
        src=${videoSrc}
        controls
        alt="Close-up video of a flower"
        captions-src="./assets/captions.vtt"
        captions-lang="en"
        captions-label="English"
      ></mdb-video>`,
      "Options: src, alt, autoplay, muted, loop, controls, playsinline."
    ),
};

export const MutedLoop = {
  render: () =>
    storyCard(
      "Muted loop",
      html`<mdb-video
        src=${videoSrc}
        autoplay
        muted
        loop
        playsinline
        alt=""
      ></mdb-video>`,
      "Autoplay stays muted; empty alt marks decoration."
    ),
};

export const EmbedRecognition = {
  render: () =>
    storyCard(
      "Embed recognition",
      html`
        <p>YouTube and Vimeo URLs select dedicated renderers.</p>
        <code class="demo-code"
          >&lt;mdb-video src="https://youtu.be/VIDEO_ID"
          controls&gt;&lt;/mdb-video&gt;</code
        >
      `,
      "Methods: play(), pause(), stop(). Events: ready, load, play, pause, ended."
    ),
};
