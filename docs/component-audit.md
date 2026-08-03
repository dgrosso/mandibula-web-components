# Component implementation and accessibility audit

Audit date: 2026-08-03. Criteria: semantic HTML first, keyboard and focus behavior, accessible names, reduced motion, media alternatives, progressive enhancement, SSR imports, package isolation, and the current Modern Web Guidance recommendations.

| Package             | Result                           | Notes                                                                                                                                                                                                       |
| ------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fader`             | Current                          | Provides keyboard navigation, carousel labelling, change events, and reduced-motion timing. Avoid automatic rotation without pause controls.                                                                |
| `media-slot`        | Current                          | Dimensions/aspect ratio, alt handling, suspense, sanitized SVG, and muted autoplay behavior are appropriate. The `background` option should normally use empty alt because it is decorative.                |
| `pointer`           | Optional enhancement             | Custom pointer decoration is non-essential. It is disabled for coarse pointers and reduced motion. Never hide the native cursor or encode information only in the effect.                                   |
| `scoped-inline-svg` | Current                          | Removes scripts, foreign content, event handlers, inline styles, unsafe protocols, and external references before insertion; IDs are scoped per instance. Same-origin/trusted assets remain preferable.     |
| `spinner`           | Current                          | Decorative motion respects reduced motion. Put it inside a named `role=status` region rather than applying an accessible name to an otherwise semantic-free custom element.                                 |
| `suspense`          | Current                          | Delayed loader uses a polite status; failures use an alert; custom events bubble and cross shadow roots. Avoid noisy loading announcements for very short work.                                             |
| `video`             | Current with content obligations | Native, YouTube, and Vimeo renderers have labelled frames. Native video supports caption tracks through `captions-*`; content owners must supply accurate captions/transcripts. Autoplay must remain muted. |

## Usage recommendation

Keep `pointer` as an optional visual package, not part of essential navigation or interaction guidance.

## Manual verification still required

- VoiceOver + Safari and NVDA + Firefox smoke tests for fader and suspense state changes.
- Keyboard-only walkthrough of every interactive Storybook story.
- Real caption review for shipped media.
- 200% zoom and high-contrast review of consumer themes.
