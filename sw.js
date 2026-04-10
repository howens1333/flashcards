const CACHE_NAME = 'flashdeck-cache-v1';

// Add all your files here so they can be saved for offline use
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

// 1. Install Event: Cache all necessary files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(FILES_TO_CACHE);
    })
  );
});

// 2. Activate Event: Clean up old caches if you update the app
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 3. Fetch Event: Serve files from cache if offline, otherwise use network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return the cached version if found, otherwise fetch from the network
      return response || fetch(event.request);
    })
  );
});