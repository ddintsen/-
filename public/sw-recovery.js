// Explicit recovery of legacy clients that registered a prompt worker without an update UI.
// Only the opted-in tab in this app's scope navigates. App data is never cleared.
const protocolCache = `orbita-update-protocol-v1:${self.registration.scope}`;
function recoveryURL(client) {
  const url = new URL(client.url);
  const scope = new URL(self.registration.scope);
  if (
    url.origin !== scope.origin ||
    ![scope.pathname, `${scope.pathname}index.html`].includes(url.pathname) ||
    url.searchParams.get("orbita-update") !== "1"
  )
    return null;
  url.searchParams.delete("orbita-update");
  return url.href;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        // Migrate the worker once even if the legacy tab has no way to message a
        // waiting worker. Subsequent releases wait for the app's update button.
        if (
          !(await caches.has(protocolCache)) ||
          clients.some((client) => recoveryURL(client))
        )
          return self.skipWaiting();
      }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.open(protocolCache));
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          const url = recoveryURL(client);
          // A navigation waits for activation to finish. Awaiting it here would
          // deadlock the activate event and leave the old document on screen.
          if (url) void client.navigate(url).catch(() => {});
        }
      }),
  );
});
