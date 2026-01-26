const CACHE_NAME = 'task-bubbles-v6';
const URLS_TO_CACHE = [
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Critical assets only. If icons fail, the app still loads.
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch((error) => {
        console.error('Failed to cache assets:', error);
      })
  );
  self.skipWaiting();
});

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
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 1. Navigation (HTML): Network First -> Cache Fallback
  // This ensures the user always gets the latest index.html (pointing to latest JS hashes)
  // preventing the "Blank Screen" issue caused by stale HTML referencing deleted JS files.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Update cache with fresh HTML
          if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, responseToCache);
              });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          return caches.match('./index.html');
        })
    );
    return;
  }

  // 2. Assets (JS/CSS/Images): Stale-While-Revalidate or Cache First
  // For hashed assets (Vite), Cache First is safe. 
  // For others, we try cache, then network.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
          return networkResponse;
        }

        // Cache new assets dynamically
        if (event.request.url.startsWith(self.location.origin)) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
            });
        }

        return networkResponse;
      }).catch(() => {
        // Optional: Return a generic offline fallback image/asset if needed
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});