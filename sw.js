const CACHE_NAME = 'flashdeck-cache-v4';

const FILES_TO_CACHE = [
  './',
  './index.html',
  './study.html',
  './edit.html',
  './test.html',
  './stats.html',
  './flashcard.html',
  './app.js',
  './style.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: cache all files
self.addEventListener('install', (event) => {
  self.skipWaiting(); // activate immediately, don't wait for old SW to die
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
});

// Activate: delete old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      )
    ).then(() => self.clients.claim()) // take control of all open tabs immediately
  );
});

// Fetch: network first, fall back to cache (so updates always come through when online)
self.addEventListener('fetch', (event) => {
  // Don't intercept Firebase/CDN requests — let them go straight to network
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache the fresh response
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request)) // offline fallback
  );
});
