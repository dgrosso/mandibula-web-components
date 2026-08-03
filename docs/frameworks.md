# Framework interoperability

## Plain HTML

Use an ESM CDN or an import map. Import only the packages used on the page.

```html
<script type="module" src="https://esm.sh/@mandibula/spinner"></script>
<span role="status">
  <mdb-spinner aria-hidden="true"></mdb-spinner>
  Loading
</span>
```

## React

React 19+ passes custom-element attributes and properties using its native custom-element support.

```jsx
import { useEffect, useRef } from "react";
import "@mandibula/fader";

export function Highlights() {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    const onChange = (event) => console.log(event.detail.index);
    element.addEventListener("change", onChange);
    return () => element.removeEventListener("change", onChange);
  }, []);

  return (
    <mdb-fader ref={ref} label="Highlights">
      <article>First highlight</article>
      <article>Second highlight</article>
    </mdb-fader>
  );
}
```

## Vue, Svelte, and Angular

Import the package once in the client entrypoint, then use the `mdb-*` tag in templates. Listen for the documented DOM event name and read structured payloads from `event.detail`. Set complex values as element properties when an attribute cannot represent them.

All public custom events bubble and cross shadow boundaries.
