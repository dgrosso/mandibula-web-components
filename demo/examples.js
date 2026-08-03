const byId = (id) => document.getElementById(id);

document.addEventListener("click", (event) => {
  const control = event.target.closest("[data-demo-action]");
  if (!control) return;

  const target = byId(control.dataset.target);
  if (!target) return;

  const action = control.dataset.demoAction;
  if (action === "fader-previous") target.previous();
  if (action === "fader-next") target.next();
  if (action === "suspense-loading")
    target.setLoading(target.firstElementChild);
  if (action === "suspense-success")
    target.setSuccess(target.firstElementChild);
  if (action === "suspense-error") {
    target.setError(new Error("Demo error"), target.firstElementChild);
  }
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
