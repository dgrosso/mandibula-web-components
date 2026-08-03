# Framework interoperability

## Plain HTML

Use an ESM CDN or an import map. Import only the packages used on the page.

```html
<script type="module" src="https://esm.sh/@mandibula/collapsible"></script>
<mdb-collapsible open>Content</mdb-collapsible>
```

## React

React 19+ passes custom-element attributes and properties using its native custom-element support.

```jsx
import { useEffect, useRef } from "react";
import "@mandibula/post-loop";

export function PostLoop() {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    const onSelection = (event) => console.log(event.detail.selections);
    element.addEventListener("mdb-post-loop-selections", onSelection);
    return () =>
      element.removeEventListener("mdb-post-loop-selections", onSelection);
  }, []);

  return <mdb-post-loop ref={ref} posts-per-page="12" />;
}
```

## Vue, Svelte, and Angular

Import the package once in the client entrypoint, then use the `mdb-*` tag in templates. Listen for the documented DOM event name and read structured payloads from `event.detail`. Set complex values as element properties when an attribute cannot represent them.

All public custom events bubble and cross shadow boundaries.
