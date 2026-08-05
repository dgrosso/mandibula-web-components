const attribute = (
  description,
  type,
  defaultValue,
  control,
  options = undefined
) => ({
  description,
  ...(control
    ? { control: { type: control, ...(options ? { options } : {}) } }
    : {}),
  table: {
    category: "Attributes",
    type: { summary: type },
    defaultValue: { summary: defaultValue },
  },
});

const booleanAttribute = (description, defaultValue = "false") =>
  attribute(description, "boolean", defaultValue, "boolean");

const stringAttribute = (description, defaultValue = '""', options) =>
  attribute(
    description,
    "string",
    defaultValue,
    options ? "select" : "text",
    options
  );

const numberAttribute = (description, defaultValue) =>
  attribute(description, "number", defaultValue, "number");

export const faderArgTypes = {
  current: numberAttribute(
    "Index of the visible item. The first item is 0.",
    "0"
  ),
  loop: booleanAttribute(
    "Allows navigation to wrap from the last item to the first.",
    "true"
  ),
  duration: numberAttribute("Base transition duration in milliseconds.", "300"),
  easing: stringAttribute("CSS easing function for the transition.", '"ease"'),
  inDuration: {
    name: "in-duration",
    ...numberAttribute(
      "Entrance duration in milliseconds. Falls back to duration when omitted.",
      "null"
    ),
  },
  outDuration: {
    name: "out-duration",
    ...numberAttribute(
      "Exit duration in milliseconds. Falls back to duration when omitted.",
      "null"
    ),
  },
  inEasing: {
    name: "in-easing",
    ...stringAttribute("CSS easing function for the entrance.", '""'),
  },
  outEasing: {
    name: "out-easing",
    ...stringAttribute("CSS easing function for the exit.", '""'),
  },
  inTransform: {
    name: "in-transform",
    ...stringAttribute("CSS transform applied during the entrance.", '""'),
  },
  outTransform: {
    name: "out-transform",
    ...stringAttribute("CSS transform applied during the exit.", '""'),
  },
  label: stringAttribute(
    "Accessible name for assistive technology users.",
    '"Carousel"'
  ),
};

export const mediaSlotArgTypes = {
  src: stringAttribute("Image, SVG, or video URL.", '""'),
  srcset: stringAttribute(
    "Responsive image candidates for the srcset attribute.",
    '""'
  ),
  sizes: stringAttribute(
    "Sizing hints used to select an image from srcset.",
    '""'
  ),
  alt: stringAttribute(
    "Alternative text. Use an empty string when the media is decorative.",
    '""'
  ),
  loading: stringAttribute("Image loading strategy.", '"lazy"', [
    "lazy",
    "eager",
  ]),
  background: booleanAttribute(
    "Places the media as an absolute, decorative background.",
    "false"
  ),
  mediaType: {
    name: "media-type",
    ...stringAttribute(
      "Forces the media type instead of inferring it from the URL.",
      '"image"',
      ["image", "video"]
    ),
  },
  autoplay: booleanAttribute(
    "Automatically starts videos; should be combined with muted.",
    "false"
  ),
  muted: booleanAttribute("Mutes the video.", "false"),
  loop: booleanAttribute("Loops the video.", "false"),
  controls: booleanAttribute("Displays the video's native controls.", "false"),
  playsinline: booleanAttribute(
    "Keeps the video inline on mobile devices.",
    "false"
  ),
  svgOverrideFill: {
    name: "svg-override-fill",
    ...booleanAttribute("Replaces SVG fills with currentColor.", "false"),
  },
  svgOverrideStroke: {
    name: "svg-override-stroke",
    ...booleanAttribute("Replaces SVG strokes with currentColor.", "false"),
  },
  debug: booleanAttribute(
    "Shows loading state information for debugging.",
    "false"
  ),
  width: numberAttribute(
    "Intrinsic width used to calculate the aspect ratio.",
    "—"
  ),
  height: numberAttribute(
    "Intrinsic height used to calculate the aspect ratio.",
    "—"
  ),
};

export const scopedInlineSvgArgTypes = {
  src: stringAttribute(
    "URL of the SVG to fetch, sanitize, and render inline.",
    '""'
  ),
  overrideFill: {
    name: "override-fill",
    ...booleanAttribute("Replaces SVG fills with currentColor.", "false"),
  },
  overrideStroke: {
    name: "override-stroke",
    ...booleanAttribute("Replaces SVG strokes with currentColor.", "false"),
  },
};

export const spinnerArgTypes = {
  template: stringAttribute(
    "ID of a document template element used to replace the CSS indicator.",
    '"mdb-spinner-template"'
  ),
};

export const suspenseArgTypes = {
  debug: booleanAttribute(
    "Shows the internal state during development.",
    "false"
  ),
};

export const videoArgTypes = {
  src: stringAttribute("Native video, YouTube, or Vimeo URL.", '""'),
  alt: stringAttribute(
    "Accessible name for the video. Use an empty string when it is decorative.",
    '""'
  ),
  autoplay: booleanAttribute("Starts playback automatically.", "false"),
  muted: booleanAttribute(
    "Mutes the video; required for reliable autoplay.",
    "false"
  ),
  loop: booleanAttribute("Loops the video.", "false"),
  controls: booleanAttribute("Displays the player controls.", "false"),
  playsinline: booleanAttribute(
    "Keeps playback inline on mobile devices.",
    "false"
  ),
  captionsSrc: {
    name: "captions-src",
    ...stringAttribute("URL of the WebVTT captions file.", '""'),
  },
  captionsLang: {
    name: "captions-lang",
    ...stringAttribute("BCP 47 language code for the captions.", '"en"'),
  },
  captionsLabel: {
    name: "captions-label",
    ...stringAttribute(
      "Visible label for the captions resource.",
      '"Captions"'
    ),
  },
};

export const componentDescriptions = {
  fader:
    "Accessible, keyboard-operable carousel that transitions between its child items. Public attributes: current, loop, duration, easing, in-duration, out-duration, in-easing, out-easing, in-transform, out-transform, and label. Methods: next(), prev(), goTo(index), and clear(). Emits change.",
  mediaSlot:
    "Responsive container for images, sanitized SVG, and video with loading and error states. The table below documents all attributes, including width and height for the aspect ratio. Supports the loader and fallback slots.",
  pointer:
    'Contextual decorative effect for fine pointers. It has no public attributes of its own: configure it with data-pointer="template:value" on target elements and templates with an mdb-pointer-{type} ID. It is disabled for touch and prefers-reduced-motion.',
  scopedInlineSvg:
    "Fetches, sanitizes, and renders inline SVG while scoping its internal IDs. Public attributes are src, override-fill, and override-stroke. Emits load and error.",
  spinner:
    "CSS loading indicator that respects prefers-reduced-motion. Its only attribute is template; customize size, color, background, and border width with --mdb-spinner-size, --mdb-spinner-color, --mdb-spinner-bg, and --mdb-spinner-border-width.",
  suspense:
    "Container for idle, loading, success, and error states during asynchronous operations. Its only attribute is debug. Uses the loader and fallback slots; the imperative API includes watch(), setLoading(), setSuccess(), setError(), and waitForLoad().",
  video:
    "Unified player for native video, YouTube, and Vimeo. The table documents src, alt, playback, controls, and captions. Methods: play(), pause(), stop(), and seek(time). Emits ready, load, play, pause, and ended.",
};
