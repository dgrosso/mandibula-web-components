const packages = [
  "accessible-menu",
  "carousel",
  "clickable-area",
  "collapsible",
  "counter",
  "document-preview-button",
  "fader",
  "media-slot",
  "modal",
  "pagination",
  "paper",
  "pointer",
  "post-loop",
  "responsive-text",
  "scoped-inline-svg",
  "spinner",
  "suspense",
  "video-modal-button",
  "video",
];

for (const packageName of packages) {
  await import(`../packages/${packageName}/src/index.js`);
}

console.log(`SSR imports: ${packages.length} packages ok`);
