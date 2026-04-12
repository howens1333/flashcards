// ⚠️  INCREMENT THIS every time you deploy — this is what tells browsers to update.
const CACHE_NAME = 'flashdeck-cache-v5';

const STATIC_ASSETS = [
  './app.js',
  './style.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// HTML pages — these are NEVER served from cache (always network-first with no caching)
const HTML_PAGES = [
  './index.html',
  './study.html',
  './learn.html',
  './edit.html',
  './test.html',
  './stats.html',
  './flashcard.html',
  './import.html',
  './'
];

// ── INSTALL ───────────────────────────────────────────────────────────────────
// Only pre-cache static assets (JS/CSS/icons), NOT html pages
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// ── ACTIVATE ──────────────────────────────────────────────────────────────────
// Delete ALL old caches so stale content is wiped on deploy
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Let Firebase/CDN/external requests pass through untouched
  if (url.origin !== location.origin) return;

  const path = url.pathname;
  const isHtml = path.endsWith('.html') || path.endsWith('/') || path === location.pathname.replace(/[^/]*$/, '');

  if (isHtml) {
    // HTML: always network-first, NO caching — so deploys are instant
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => caches.match(event.request)) // offline fallback only
    );
  } else {
    // Static assets: cache-first (fast), but update cache in background
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
        return cached || networkFetch;
      })
    );
  }
});
