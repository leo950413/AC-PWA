/* ─────────────────────────────────────────────────────────────────
   AC Control PWA – Service Worker
   Strategy: Cache-first for static assets, network-only for API.
───────────────────────────────────────────────────────────────── */

const CACHE_NAME  = 'ac-control-v2';
const API_ORIGIN  = 'https://iot-ac.c024.click';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon.svg',
];

/* ── Install: pre-cache all static assets ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: delete stale caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: network-only for API, cache-first for everything else ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Do NOT intercept API requests at all.
  // Calling event.respondWith() here would make the SW responsible for the
  // response; if the underlying fetch throws (CORS, network error) the SW
  // propagates a synthetic network-error back to the page, which shows as
  // ERR_FAILED. By returning without event.respondWith the browser handles
  // the request natively, keeping CORS negotiation and error reporting intact.
  if (url.origin === API_ORIGIN) {
    return;
  }

  // Cache-first for static assets.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      // Not in cache — fetch, store, return.
      return fetch(request).then(response => {
        // Only cache valid same-origin GET responses.
        if (
          request.method === 'GET' &&
          response.ok &&
          url.origin === self.location.origin
        ) {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, toCache));
        }
        return response;
      });
    })
  );
});
