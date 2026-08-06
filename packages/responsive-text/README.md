# @mandibula/responsive-text

Fluidly responsive text built with CSS `clamp()`.

## Install

```sh
npm install @mandibula/responsive-text
```

## Use

```js
import "@mandibula/responsive-text";
```

```html
<mdb-responsive-text min-size="1rem" fluid-size="5vw" max-size="3rem">
  Text that scales with the viewport
</mdb-responsive-text>
```

The component renders its slotted content with a fluid font size clamped between
`min-size` and `max-size`. All size and line-height attributes accept CSS values.

Registered element: `<mdb-responsive-text>`.

The package is a standards-based custom element. It works in plain HTML, React,
Vue, Svelte, Angular, and other platforms that support custom elements.
