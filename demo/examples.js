const byId = (id) => document.getElementById(id);

document.addEventListener("click", (event) => {
  const control = event.target.closest("[data-demo-action]");
  if (!control) return;

  const target = byId(control.dataset.target);
  if (!target) return;

  const action = control.dataset.demoAction;
  if (action === "open-modal") target.open = true;
  if (action === "toggle-collapsible") target.toggleCollapsible();
  if (action === "fader-previous") target.previous();
  if (action === "fader-next") target.next();
  if (action === "carousel-previous") target.previous();
  if (action === "carousel-next") target.next();
  if (action === "suspense-loading")
    target.setLoading(target.firstElementChild);
  if (action === "suspense-success")
    target.setSuccess(target.firstElementChild);
  if (action === "suspense-error") {
    target.setError(new Error("Demo error"), target.firstElementChild);
  }
});

document.querySelectorAll("mdb-pagination").forEach((pagination) => {
  pagination.addEventListener("previous", () => {
    pagination.current -= 1;
  });
  pagination.addEventListener("next", () => {
    pagination.current += 1;
  });
  pagination.addEventListener("goto", (event) => {
    pagination.current = event.detail.page;
  });
});

document.querySelectorAll("[data-event-output]").forEach((output) => {
  const source = byId(output.dataset.eventOutput);
  const eventNames = (output.dataset.events || "change").split(" ");
  for (const eventName of eventNames) {
    source?.addEventListener(eventName, (event) => {
      const detail = event.detail ? ` ${JSON.stringify(event.detail)}` : "";
      output.textContent = `${event.type}${detail}`;
    });
  }
});
