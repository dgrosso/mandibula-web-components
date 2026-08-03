import { html } from "lit";

export const storyCard = (title, content, description) => html`
  <section class="demo-card demo-story">
    <h2>${title}</h2>
    <div class="demo-stage">${content}</div>
    <code class="demo-code">${description}</code>
  </section>
`;

export const showEvent = (event) => {
  const output = event.currentTarget.parentElement?.querySelector(
    "[data-event-output]"
  );
  if (!output) return;

  const detail = event.detail ? ` ${JSON.stringify(event.detail)}` : "";
  output.textContent = `${event.type}${detail}`;
};
