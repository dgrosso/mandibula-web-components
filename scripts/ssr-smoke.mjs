const packages = [
  "fader",
  "media-slot",
  "pointer",
  "scoped-inline-svg",
  "spinner",
  "suspense",
  "video",
];

for (const packageName of packages) {
  await import(`../packages/${packageName}/src/index.js`);
}

console.log(`SSR imports: ${packages.length} packages ok`);
