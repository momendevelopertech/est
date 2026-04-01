const CACHE_PREFIX = "examops-static";
const CACHE_VERSION = "v2";
const STATIC_CACHE = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const OFFLINE_FALLBACK_URL = "/offline.html";
const STATIC_PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/icon-maskable.svg",
  OFFLINE_FALLBACK_URL
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isCacheableAsset(request) {
  return ["style", "script", "font", "image"].includes(request.destination);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            JSON.stringify({
              ok: false,
              error: "network_unavailable"
            }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json"
              }
            }
          )
      )
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        return cache.match(OFFLINE_FALLBACK_URL);
      })
    );
    return;
  }

  if (isCacheableAsset(request)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const networkFetch = fetch(request)
          .then(async (networkResponse) => {
            if (networkResponse.ok) {
              const cache = await caches.open(STATIC_CACHE);
              cache.put(request, networkResponse.clone()).catch(() => undefined);
            }

            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse ?? networkFetch;
      })
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
