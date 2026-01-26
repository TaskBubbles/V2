const CACHE_NAME = 'task-bubbles-v7';
const URLS_TO_CACHE = [
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Attempt to cache critical assets, but don't fail install if one is missing
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch((error) => {
        console.warn('Pre-caching failed:', error);
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
  // 1. Navigation (HTML) - Network First
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // If network works, cache the fresh HTML
          if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                  // Cache it specifically as index.html so fallback works
                  cache.put('./index.html', responseToCache);
              });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback: try to find index.html
          return caches.match('./index.html');
        })
    );
    return;
  }

  // 2. Assets - Cache First, Network Fallback
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Cache new valid assets (same origin only)
        if (event.request.url.startsWith(self.location.origin)) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
            });
        }

        return networkResponse;
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // If a window is already open, focus it
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window at root
      if (clients.openWindow) {
        return clients.openWindow('.');
      }
    })
  );
});