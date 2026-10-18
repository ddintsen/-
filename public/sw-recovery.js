// Explicit recovery of legacy clients that registered a prompt worker without an update UI.
// Only the opted-in tab in this app's scope navigates. App data is never cleared.
const protocolCache = `orbita-update-protocol-v1:${self.registration.scope}`;
// Chrome keeps a client's creation URL after history.replaceState, so a tab opened once with
// ?orbita-update=1 would look opted in forever. Tabs of the current app announce that they have
// the update button; they are never navigated by a later release. Cache Storage outlives workers.
const modernCache = `orbita-modern-clients-v1:${self.registration.scope}`;
const modernKey = (id) =>
  new URL(`__orbita-client/${id}`, self.registration.scope).href;
async function isModern(client) {
  const cache = await caches.open(modernCache);
  return !!(await cache.match(modernKey(client.id)));
}
async function recoveryTargets(clients) {
  const targets = [];
  for (const client of clients) {
    const url = recoveryURL(client);
    if (url && !(await isModern(client))) targets.push({ client, url });
  }
  return targets;
}
self.addEventListener("message", (event) => {
  if (event.data?.type !== "ORBITA_CLIENT_READY" || !event.source?.id) return;
  event.waitUntil(
    caches
      .open(modernCache)
      .then((cache) =>
        cache.put(modernKey(event.source.id), new Response("1")),
      ),
  );
});
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
          (await recoveryTargets(clients)).length
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
      .then(async (clients) => {
        for (const { client, url } of await recoveryTargets(clients))
          // A navigation waits for activation to finish. Awaiting it here would
          // deadlock the activate event and leave the old document on screen.
          void client.navigate(url).catch(() => {});
        // Forget closed tabs so the announcement cache stays small.
        const open = new Set(clients.map((client) => modernKey(client.id)));
        const cache = await caches.open(modernCache);
        for (const request of await cache.keys())
          if (!open.has(request.url)) await cache.delete(request);
      }),
  );
});
