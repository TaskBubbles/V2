// SELF-DESTRUCTING SERVICE WORKER
// This replaces the old caching logic. It immediately deletes all caches
// and unregisters itself to fix the "Index 404" loop.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // DELETE ALL CACHES
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
        // Unregister self
        self.registration.unregister();
        return self.clients.claim();
    })
  );
});

// Pass-through fetch (Network Only)
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});