const CACHE_NAME = 'task-bubbles-v15';

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
  // Navigation: Network First -> Check Status 200 -> Cache -> Fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
           // CRITICAL FIX: Only cache if the response is valid (200 OK)
           // This prevents caching GitHub's 404 page if the network is weird or URL is wrong
           if (networkResponse && networkResponse.status === 200) {
               const clone = networkResponse.clone();
               caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
               return networkResponse;
           }
           // If network returns 404 or other error, try to fall back to cache
           throw new Error('Network response was not ok');
        })
        .catch(() => {
           return caches.match(event.request)
             .then(resp => resp || caches.match('./index.html', { ignoreSearch: true }));
        })
    );
    return;
  }

  // Assets: Stale-While-Revalidate
  if (event.request.destination === 'script' || event.request.destination === 'style' || event.request.destination === 'image') {
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request)
                .then((networkResponse) => {
                    if(networkResponse && networkResponse.status === 200) {
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return networkResponse;
                })
                .catch(err => {});
            
            return cachedResponse || fetchPromise;
        })
      );
      return;
  }

  // Default: Cache First
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});