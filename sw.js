const CACHE_NAME = 'task-bubbles-v13';

// Cache index.html and manifest immediately
const CRITICAL_ASSETS = [
  './index.html',
  './manifest.json',
  './favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CRITICAL_ASSETS))
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
  // NAVIGATION (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
           // Update cache with fresh version
           const clone = networkResponse.clone();
           caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
           return networkResponse;
        })
        .catch(() => {
           // Offline fallback
           return caches.match(event.request)
             .then(resp => resp || caches.match('./index.html', { ignoreSearch: true }));
        })
    );
    return;
  }

  // ASSETS (JS, CSS) - Stale-While-Revalidate Strategy
  // This ensures the app loads fast from cache, but updates in background for next time.
  // Crucial for bundled JS files.
  if (event.request.destination === 'script' || event.request.destination === 'style') {
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if(networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return networkResponse;
            });
            return cachedResponse || fetchPromise;
        })
      );
      return;
  }

  // DEFAULT (Images, etc) - Cache First
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});