// Kinja service worker: keeps Kinja Field pages usable without a connection.
const VERSION = "kinja-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const OFFLINE_PAGES = /^\/dashboard\/cooperative(\/|$)/;
const OFFLINE_FALLBACK = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline - Kinja</title><body style="font-family:system-ui;background:#f4f1e8;color:#344e41;padding:2rem"><h1>You are offline</h1><p>This page has not been saved on this device yet. Open Kinja Field pages while online once, and they will work offline after that.</p><p><a href="/dashboard/cooperative">Go to Kinja Field</a></p></body></html>`;

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (!key.startsWith(VERSION)) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function cacheStaticAssets(html) {
  const cache = await caches.open(STATIC_CACHE);
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [])];
  await Promise.all(assets.map(async (asset) => {
    if (await cache.match(asset)) return;
    const response = await fetch(asset).catch(() => null);
    if (response?.ok) await cache.put(asset, response);
  }));
}

async function cachePage(path, response) {
  if (!response.ok || response.redirected || !(response.headers.get("content-type") ?? "").includes("text/html")) return;
  const html = await response.clone().text();
  await (await caches.open(PAGE_CACHE)).put(path, response.clone());
  await cacheStaticAssets(html);
}

self.addEventListener("message", (event) => {
  const { type, urls } = event.data ?? {};
  if (type === "CLEAR_PAGES") event.waitUntil(caches.delete(PAGE_CACHE));
  if (type === "WARM_PAGES" && Array.isArray(urls)) {
    event.waitUntil(Promise.all(urls.filter((url) => OFFLINE_PAGES.test(url)).map(async (url) => {
      const response = await fetch(url, { credentials: "same-origin" }).catch(() => null);
      if (response) await cachePage(url, response);
    })));
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Build assets never change once published: serve from cache first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
    return;
  }

  // Kinja Field pages: network first, falling back to the copy saved on this device.
  if (request.mode === "navigate" && OFFLINE_PAGES.test(url.pathname)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        await cachePage(url.pathname, response);
        return response;
      } catch {
        const cache = await caches.open(PAGE_CACHE);
        return (await cache.match(url.pathname)) ?? (await cache.match("/dashboard/cooperative")) ?? new Response(OFFLINE_FALLBACK, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    })());
  }
});
