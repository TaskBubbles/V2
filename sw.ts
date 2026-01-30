/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any };

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.skipWaiting();
clientsClaim();

// Notification Scheduler
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATIONS') {
    const tasks = event.data.payload;
    scheduleNotifications(tasks);
  }
});

async function scheduleNotifications(payloads: any[]) {
    // 1. Get existing notifications
    const existing = await self.registration.getNotifications({ includeTriggered: true } as any);
    
    // Create a set of IDs that should exist
    const futureIds = new Set(payloads.map(p => p.tag));

    // 2. Clear old/invalid notifications
    for (const n of existing) {
        // If the notification tag is not in our new list, close it.
        // Also, if we are rescheduling, we might want to close and replace to update time/content
        if (!futureIds.has(n.tag)) {
            n.close();
        } else {
             // We close existing ones to replace them with potentially new times or content
             n.close();
        }
    }

    // 3. Schedule new ones
    for (const data of payloads) {
         if (!data.timestamp) continue;
         
         const now = Date.now();
         if (data.timestamp > now) {
             try {
                // Check for TimestampTrigger support (experimental)
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
                        requireInteraction: true
                    });
                } else {
                    console.log("TimestampTrigger not supported in this browser.");
                }
             } catch (e) {
                 console.error("Error scheduling notification:", e);
             }
         }
    }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // If a window is already open, focus it
        for (const client of clientList) {
            if ('focus' in client) {
                return client.focus();
            }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
            return self.clients.openWindow(event.notification.data?.url || './');
        }
    })
  );
});