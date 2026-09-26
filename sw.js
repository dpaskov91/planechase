// Network-first service worker: every online visit fetches the site's
// own files fresh (so a new deploy shows up immediately — no stale
// app), and keeps a copy so the app still opens without a connection.
// Cross-origin requests (Scryfall's API and card images) are left to
// the browser; card data has its own localStorage cache.

const CACHE = "planechase-app-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          event.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        // Offline navigation to a URL we haven't cached exactly (e.g. a
        // different query string) — fall back to the app shell.
        if (req.mode === "navigate") return (await caches.match("./")) ?? Response.error();
        return Response.error();
      })
  );
});
