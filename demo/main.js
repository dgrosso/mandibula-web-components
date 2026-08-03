import "@mandibula/web-components";
import "@mandibula/carousel/styles.css";
import "@mandibula/document-preview-button/styles.css";
import "@mandibula/modal/styles.css";
import "@mandibula/video-modal-button/styles.css";
import "./styles.css";
import "./examples.js";

const demos = [
  ["accessible-menu", "Accessible menu"],
  ["carousel", "Carousel"],
  ["clickable-area", "Clickable area"],
  ["collapsible", "Collapsible"],
  ["counter", "Counter"],
  ["document-preview-button", "Document preview"],
  ["fader", "Fader"],
  ["media-slot", "Media slot"],
  ["modal", "Modal"],
  ["pagination", "Pagination"],
  ["paper", "Paper"],
  ["pointer", "Pointer"],
  ["post-loop", "Post loop"],
  ["responsive-text", "Responsive text"],
  ["scoped-inline-svg", "Scoped inline SVG"],
  ["spinner", "Spinner"],
  ["suspense", "Suspense"],
  ["video", "Video"],
  ["video-modal-button", "Video modal button"],
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
