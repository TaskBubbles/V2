const CACHE_NAME = 'task-bubbles-v9';
const URLS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './favicon.ico',
  'https://cdn.tailwindcss.com' // Explicitly cache Tailwind
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
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
          if (!networkResponse || networkResponse.status !== 200) {
             throw new Error('Network navigation failed');
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Robust fallback: ignore query params like ?utm_source=pwa
          return caches.match('./index.html', { ignoreSearch: true });
        })
    );
    return;
  }

  // 2. Assets (JS, CSS, Images, Fonts) - Cache First
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Validate response
        // Allow 'basic' (same-origin) AND 'cors' (external CDNs like Tailwind)
        // Ensure status is 200
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        
        // Only cache valid types to avoid caching errors
        const type = networkResponse.type;
        if (type !== 'basic' && type !== 'cors') {
            return networkResponse;
        }

        // Cache Strategy:
        // 1. Same Origin files
        // 2. Tailwind CDN
        const url = event.request.url;
        if (url.startsWith(self.location.origin) || url.includes('cdn.tailwindcss.com')) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
            });
        }

        return networkResponse;
      }).catch((e) => {
          console.error("Fetch failed for:", event.request.url, e);
          // Return nothing (undefined), forcing browser to handle network error
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