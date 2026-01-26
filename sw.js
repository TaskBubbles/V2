const CACHE_NAME = 'task-bubbles-v17';

const CRITICAL_ASSETS = [
  './index.html',
  './manifest.json',
  './favicon.ico'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CRITICAL_ASSETS))
  );
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
  const url = new URL(event.request.url);

  // 1. Navigation (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
           // Only cache valid 200 OK responses
           if (networkResponse && networkResponse.status === 200) {
               const clone = networkResponse.clone();
               caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
               return networkResponse;
           }
           throw new Error('Network response not ok');
        })
        .catch(() => {
           // Offline fallback to index.html
           return caches.match('./index.html', { ignoreSearch: true });
        })
    );
    return;
  }

  // 2. Assets (JS, CSS, Images) - Stale-While-Revalidate
  // IMPORTANT: We do NOT fallback to index.html for these. 
  if (
      event.request.destination === 'script' || 
      event.request.destination === 'style' || 
      event.request.destination === 'image' ||
      url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.css')
  ) {
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
                .catch(err => {
                    // console.warn('Fetch failed for asset', event.request.url);
                });
            
            return cachedResponse || fetchPromise;
        })
      );
      return;
  }

  // 3. Default: Cache First, Network Fallback
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});