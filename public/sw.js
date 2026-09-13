/*
 * AGRIO Service Worker — offline-first app shell.
 * Hand-rolled (no build step) so it works with Vite's hashed asset output
 * via runtime caching: the first online load caches the shell + assets, and
 * every subsequent load works with no / intermittent connectivity.
 *
 * Registered only in production (see src/main.jsx). Test with:
 *   npm run build && npm run preview   → DevTools ▸ Network ▸ Offline
 */
// ⚠️ Bump this string on EVERY release. `activate` deletes all caches whose
// name does not start with VERSION, so bumping it purges the previous build's
// shell + runtime caches and forces clients onto the new code. Because this
// file is served verbatim (no build hash), changing these bytes is also what
// makes the browser detect a new service worker and re-run install/activate.
const VERSION = 'agrio-v3';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const MODEL_CACHE = `${VERSION}-models`;

// Minimal shell + known static assets from /public.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/leaf.svg',
];

// The live AI endpoint must always hit the network (and fail cleanly offline).
const AI_HOST = 'generativelanguage.googleapis.com';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => console.warn('[sw] precache failed', err))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GET is cacheable; let the browser handle everything else (e.g. the AI POST).
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept the live AI API — let it reach the network or fail cleanly.
  if (url.hostname === AI_HOST) return;

  // App navigations → network-first, fall back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() =>
          caches.match('/index.html').then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // ONNX model files (.onnx) and WASM runtime files (.wasm) → dedicated
  // model cache, cache-first. These are large binary assets that must be
  // locally available for offline on-device inference. Once downloaded on
  // the first online load, they are served from cache on subsequent visits
  // (including offline). If the model has never been downloaded and the
  // device is offline, the fetch fails and CropGuard returns an explicit
  // `cropguard_unavailable` abstention — it does NOT substitute the legacy
  // heuristic for a supported crop.
  const isModelAsset =
    url.pathname.startsWith('/models/') ||
    url.pathname.endsWith('.onnx') ||
    url.pathname.endsWith('.wasm');

  if (isModelAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(MODEL_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached); // offline + never cached = undefined → network error
      })
    );
    return;
  }

  // Assets, fonts, images → cache-first, then network (and cache the result).
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && (response.status === 200 || response.type === 'opaque')) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
