import * as d3 from 'd3';
import { Task } from '../types';
import { audioService } from './audioService';
import { MIN_BUBBLE_SIZE, MAX_BUBBLE_SIZE } from '../constants';

interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

interface NotificationPayload {
    title: string;
    body: string;
    icon: string;
    timestamp: number;
    tag: string;
    actions?: NotificationAction[];
}

class NotificationService {
  private notifiedEvents: Set<string> = new Set();
  private enabled: boolean = false;

  constructor() {
    try {
        this.enabled = localStorage.getItem('notificationsEnabled') === 'true';
        const stored = localStorage.getItem('notifiedEvents');
        if (stored) {
            this.notifiedEvents = new Set(JSON.parse(stored));
        }
    } catch {
        this.enabled = false;
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
        console.warn('Notifications not supported in this browser.');
        return false;
    }
    
    if (Notification.permission === 'granted') return true;
    
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    
    return false;
  }

  async checkAndNotify(tasks: Task[]) {
    if (!this.enabled) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const now = new Date();
    const lookbackWindow = 24 * 60 * 60 * 1000; 
    
    // 1. In-App / Foreground polling
    for (const task of tasks) {
        if (task.completed || !task.dueDate) continue;

        const dueDate = new Date(task.dueDate);
        const timeDiff = now.getTime() - dueDate.getTime();
        
        const eventKey = `${task.id}_${task.dueDate}`;

        // If it's due now or recently due, and we haven't notified yet
        if (timeDiff >= 0 && timeDiff < lookbackWindow) {
            if (!this.notifiedEvents.has(eventKey)) {
                await this.sendNotificationNow(task);
                this.notifiedEvents.add(eventKey);
                this.saveNotifiedEvents();
            }
        }
    }

    this.cleanupStaleEvents(tasks);
    
    // 2. Schedule Future Notifications with Service Worker
    this.syncWithServiceWorker(tasks);
  }

  private async syncWithServiceWorker(tasks: Task[]) {
      if (!('serviceWorker' in navigator)) return;
      
      try {
          const reg = await navigator.serviceWorker.ready;
          if (!reg || !reg.active) return;

          const futureTasks = tasks.filter(t => !t.completed && t.dueDate);
          
          const payload: NotificationPayload[] = futureTasks.map(task => ({
              title: task.title || "Untitled Bubble",
              body: "⏰ It's time to pop this bubble!",
              icon: this.getBubbleIcon(task),
              timestamp: new Date(task.dueDate!).getTime(),
              tag: task.id,
              actions: [
                  { action: 'complete', title: 'Mark as Done' }
              ]
          }));

          // Send to SW for scheduling/storage
          reg.active.postMessage({
              type: 'SCHEDULE_NOTIFICATIONS',
              payload: payload
          });

          // Register Periodic Sync if supported (Fallback for closed app)
          // @ts-ignore
          if ('periodicSync' in reg) {
              try {
                  const status = await navigator.permissions.query({
                    // @ts-ignore
                    name: 'periodic-background-sync',
                  });
                  
                  if (status.state === 'granted') {
                      // @ts-ignore
                      await reg.periodicSync.register('check-tasks', {
                          minInterval: 60 * 60 * 1000 // 1 Hour
                      });
                  }
              } catch (e) {
                  // Periodic sync permission might fail or not be implemented
                  console.debug("Periodic sync registration failed", e);
              }
          }
      } catch (e) {
          console.error("Error syncing with service worker", e);
      }
  }

  private cleanupStaleEvents(tasks: Task[]) {
      const currentTaskIds = new Set(tasks.map(t => t.id));
      let changed = false;
      this.notifiedEvents.forEach(key => {
          const [taskId] = key.split('_');
          if (!currentTaskIds.has(taskId)) {
              this.notifiedEvents.delete(key);
              changed = true;
          }
      });
      if (changed) this.saveNotifiedEvents();
  }

  private saveNotifiedEvents() {
      try { localStorage.setItem('notifiedEvents', JSON.stringify(Array.from(this.notifiedEvents))); } catch (e) {}
  }

  private getBubbleIcon(task: Task): string {
    const minSize = MIN_BUBBLE_SIZE || 20;
    const maxSize = MAX_BUBBLE_SIZE || 220;
    const minR = 40;
    const maxR = 90;
    const size = Math.max(minSize, Math.min(maxSize, task.size));
    const t = (size - minSize) / (maxSize - minSize);
    const r = minR + t * (maxR - minR);

    // Matches BubbleCanvas gradient logic
    const color1 = task.color;
    const color2 = d3.color(task.color)?.brighter(0.8)?.toString() || task.color;

    // Simple text wrapping heuristic for SVG
    const words = (task.title || "").split(/\s+/);
    const lines: string[] = [];
    let currentLine = words[0] || "";
    
    for (let i = 1; i < words.length; i++) {
        // Approximate char limit per line for the icon
        if ((currentLine + " " + words[i]).length <= 12) {
             currentLine += " " + words[i];
        } else {
             lines.push(currentLine);
             currentLine = words[i];
             if (lines.length >= 2) break; // Limit lines to fit nicely
        }
    }
    if (currentLine) lines.push(currentLine);
    const displayLines = lines.slice(0, 3);
    
    const fontSize = Math.max(16, 26 - (displayLines.length * 3)); 
    const lineHeight = fontSize * 1.2;
    const totalHeight = (displayLines.length - 1) * lineHeight;
    const startY = 96 - (totalHeight / 2);

    const textElements = displayLines.map((line, i) => {
        const safeLine = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<text x="96" y="${startY + (i * lineHeight)}" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="${fontSize}" style="text-shadow: 0 1px 3px rgba(0,0,0,0.4);">${safeLine}</text>`;
    }).join('');

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${color1}" stop-opacity="1"/>
          <stop offset="100%" stop-color="${color2}" stop-opacity="1"/>
        </linearGradient>
      </defs>
      <circle cx="96" cy="96" r="${r}" fill="url(#grad)" />
      ${textElements}
    </svg>`.trim();
    
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  private async sendNotificationNow(task: Task) {
    const title = task.title || "Untitled Bubble"; 
    const iconUrl = this.getBubbleIcon(task);

    const options: NotificationOptions & { requireInteraction?: boolean; renotify?: boolean; vibrate?: number[]; actions?: NotificationAction[] } = {
        body: "⏰ It's time to pop this bubble!",
        icon: iconUrl, 
        badge: './favicon.svg',
        tag: task.id, 
        requireInteraction: true, 
        renotify: true,
        data: { taskId: task.id },
        vibrate: [100, 50, 100, 50, 300],
        actions: [
            { action: 'complete', title: 'Mark as Done' },
        ]
    };

    try {
        audioService.playAlert();

        let swReg: ServiceWorkerRegistration | undefined;
        if ('serviceWorker' in navigator) {
             try { swReg = await navigator.serviceWorker.ready; } catch(e) {}
        }

        if (swReg) {
            await swReg.showNotification(title, options);
        } else {
            const n = new Notification(title, options);
            n.onclick = () => { window.focus(); n.close(); };
        }
    } catch (e) {
        console.error("Failed to send notification", e);
    }
  }
}

export const notificationService = new NotificationService();