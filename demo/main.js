import "@mandibula/web-components";
import "./styles.css";
import "./examples.js";

const demos = [
  ["fader", "Fader"],
  ["media-slot", "Media slot"],
  ["pointer", "Pointer"],
  ["scoped-inline-svg", "Scoped inline SVG"],
  ["spinner", "Spinner"],
  ["suspense", "Suspense"],
  ["video", "Video"],
];

const currentPage = location.pathname.split("/").filter(Boolean).at(-1) || "";
const nav = document.querySelector("[data-demo-nav]");

if (nav) {
  const list = document.createElement("ul");
  list.className = "demo-nav__list";
  list.setAttribute("role", "list");

  for (const [slug, label] of demos) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `../${slug}/`;
    link.textContent = label;
    if (currentPage === slug) {
      link.setAttribute("aria-current", "page");
    }
    item.append(link);
    list.append(item);
  }

  nav.replaceChildren(list);
}
