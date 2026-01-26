const CACHE_NAME = 'task-bubbles-v11';

// Critical items - if these fail, SW installation fails
const CRITICAL_ASSETS = [
  './index.html',
  './manifest.json',
  './favicon.ico'
];

// Optional items - SW will install even if these fail (e.g. CORS issues)
const OPTIONAL_ASSETS = [
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        // Try caching optional assets without blocking
        cache.addAll(OPTIONAL_ASSETS).catch(err => console.warn('Optional asset caching failed:', err));
        
        // Block on critical assets
        return cache.addAll(CRITICAL_ASSETS);
      })
      .catch((error) => {
        console.error('Critical asset caching failed:', error);
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
  // 1. Navigation (HTML) - Network First, Fallback to Cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
             throw new Error('Network navigation failed or 404');
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(response => {
                if (response) return response;
                return caches.match('./index.html', { ignoreSearch: true });
            });
        })
    );
    return;
  }

  // 2. Assets (JS, CSS, Images) - Cache First, Network Fallback
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const type = networkResponse.type;
        // Allow basic (same-origin) and cors (external CDN)
        if (type !== 'basic' && type !== 'cors') {
            return networkResponse;
        }

        const url = event.request.url;
        if (url.startsWith(self.location.origin) || url.includes('cdn.tailwindcss.com')) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
            });
        }

        return networkResponse;
      }).catch(() => {
          // Silent fail for assets
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
        return clients.openWindow('.');
      }
    })
  );
});