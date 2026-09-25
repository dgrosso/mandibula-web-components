# @mandibula/slider

Accessible horizontal slider built on native scrolling and CSS scroll snap.

## Install

```sh
npm install @mandibula/slider
```

## Use

```js
import "@mandibula/slider";
```

```html
<mdb-slider label="Feature highlights">
  <article>First slide</article>
  <article>Second slide</article>
  <article>Third slide</article>
</mdb-slider>
```

Registered elements: `<mdb-slider>`.

The component uses native horizontal scrolling as its interaction baseline. JavaScript adds index tracking, imperative navigation, keyboard support, pagination synchronization, and the `change` event.

Public API:

- `current`: zero-based active slide index.
- `loop`: allows imperative previous/next navigation to wrap.
- `label`: accessible carousel name.
- `next()`, `prev()`, `goTo(index)`.
- `change`: bubbles and is composed; detail is `{ current, total }`.

Styling hooks:

- `--mdb-slider-slide-size`: slide width, default `100%`.
- `--mdb-slider-gap`: gap between slides, default `0px`.
- `--mdb-slider-snap-align`: scroll snap alignment, default `start`.
