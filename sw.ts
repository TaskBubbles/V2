/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any };

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.skipWaiting();
clientsClaim();

// Navigation Fallback: Critical for PWA Offline Capability check
// This ensures that when navigating to the root '/' or any sub-path while offline,
// the Service Worker serves the cached index.html.
try {
    const handler = createHandlerBoundToURL('index.html');
    const navigationRoute = new NavigationRoute(handler, {
        denylist: [
            new RegExp('^/assets/'),
            new RegExp('^/favicon'),
            new RegExp('\\.[a-z]+$')
        ]
    });
    registerRoute(navigationRoute);
} catch (error) {
    console.warn('Navigation fallback setup failed (index.html might not be in precache):', error);
}

const DB_NAME = 'task-bubbles-db';
const STORE_NAME = 'pending-notifications';

// IndexedDB Helper
function openDB() {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'tag' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveNotificationsToDB(payloads: any[]) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    // Clear old
    await new Promise<void>((resolve) => {
        store.clear().onsuccess = () => resolve();
    });
    // Add new
    for (const p of payloads) {
        store.put(p);
    }
    return tx.oncomplete;
}

async function getPendingFromDB() {
    const db = await openDB();
    return new Promise<any[]>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
    });
}

// Handler
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATIONS') {
    const tasks = event.data.payload;
    event.waitUntil(
        Promise.all([
            saveNotificationsToDB(tasks),
            scheduleNotifications(tasks)
        ])
    );
  }
});

// Periodic Sync (Fallback for when app is closed)
self.addEventListener('periodicsync', (event: any) => {
    if (event.tag === 'check-tasks') {
        event.waitUntil(checkAndNotify());
    }
});

async function checkAndNotify() {
    const pending = await getPendingFromDB();
    const now = Date.now();
    
    // Check for tasks that are due or overdue (within last 24h) and haven't been triggered by OS
    const overdue = pending.filter(p => p.timestamp <= now && p.timestamp > now - 24 * 60 * 60 * 1000);
    
    for (const data of overdue) {
        // Double check if already showing
        const existing = await self.registration.getNotifications({ tag: data.tag });
        if (existing.length === 0) {
             await self.registration.showNotification(data.title, {
                body: data.body,
                icon: data.icon,
                badge: 'favicon.svg',
                tag: data.tag,
                data: { url: './', taskId: data.tag },
                requireInteraction: true,
                renotify: true,
                vibrate: [100, 50, 100, 50, 300],
                actions: data.actions || []
            } as any);
        }
    }
}

async function scheduleNotifications(payloads: any[]) {
    // 1. Get existing to clean up
    const existing = await self.registration.getNotifications({ includeTriggered: true } as any);
    const futureIds = new Set(payloads.map(p => p.tag));

    for (const n of existing) {
        // Don't close notifications that are currently visible to the user (timestamp < now)
        // Only close future scheduled ones that are no longer valid
        // @ts-ignore
        if (n.showTrigger && !futureIds.has(n.tag)) {
            n.close();
        }
    }

    // 2. Schedule
    for (const data of payloads) {
         if (!data.timestamp) continue;
         const now = Date.now();
         
         // Only schedule for future. If due now, checkAndNotify handles or the frontend handled it.
         if (data.timestamp > now) {
             try {
                // @ts-ignore
                if ('showTrigger' in Notification.prototype) {
                    // @ts-ignore
                    const trigger = new TimestampTrigger(data.timestamp);
                    await self.registration.showNotification(data.title, {
                        body: data.body,
                        icon: data.icon,
                        badge: 'favicon.svg',
                        tag: data.tag,
                        data: { url: './', taskId: data.tag },
                        // @ts-ignore
                        showTrigger: trigger,
                        renotify: true,
                        requireInteraction: true,
                        actions: data.actions || []
                    });
                }
             } catch (e) {
                 // Fallback will happen via periodicSync or next app open
             }
         }
    }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const taskId = event.notification.data?.taskId;
  const baseUrl = event.notification.data?.url || './';
  // @ts-ignore
  const action = event.action;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // 1. Try to find an existing window to focus
        for (const client of clientList) {
            if ('focus' in client) {
                return (client as WindowClient).focus().then((c) => {
                    // Send message based on action
                    if (action === 'complete' && taskId) {
                        c.postMessage({ type: 'COMPLETE_TASK', taskId });
                    } else if (taskId) {
                        c.postMessage({ type: 'HIGHLIGHT_TASK', taskId });
                    }
                });
            }
        }
        
        // 2. If no window open, open a new one
        if (self.clients.openWindow) {
            const url = new URL(baseUrl, self.location.href);
            if (taskId) {
                // Pass action via query param
                if (action === 'complete') {
                    url.searchParams.set('action', 'complete');
                } else {
                    url.searchParams.set('highlight', taskId);
                }
                url.searchParams.set('taskId', taskId);
            }
            return self.clients.openWindow(url.href).then(() => {});
        }
    })
  );
});
