

import { Task } from '../types';
import { audioService } from './audioService';
import { MIN_BUBBLE_SIZE, MAX_BUBBLE_SIZE } from '../constants';

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
    
    for (const task of tasks) {
        if (task.completed || !task.dueDate) continue;

        const dueDate = new Date(task.dueDate);
        const timeDiff = now.getTime() - dueDate.getTime();
        
        const eventKey = `${task.id}_${task.dueDate}`;

        if (timeDiff >= 0 && timeDiff < lookbackWindow) {
            if (!this.notifiedEvents.has(eventKey)) {
                await this.sendNotification(task);
                this.notifiedEvents.add(eventKey);
                this.saveNotifiedEvents();
            }
        }
    }

    this.cleanupStaleEvents(tasks);
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
    const maxR = 84;
    const size = Math.max(minSize, Math.min(maxSize, task.size));
    const t = (size - minSize) / (maxSize - minSize);
    const r = minR + t * (maxR - minR);

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
      <defs>
        <radialGradient id="g" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stop-color="white" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="${task.color}" stop-opacity="0.3"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="#020617"/>
      <circle cx="96" cy="96" r="${r}" fill="${task.color}" />
      <circle cx="96" cy="96" r="${r}" fill="url(#g)" />
      <circle cx="96" cy="96" r="${r}" fill="none" stroke="white" stroke-width="4" opacity="0.7" />
    </svg>`.trim();
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  private async sendNotification(task: Task) {
    const title = task.title || "Untitled Task"; 
    const iconUrl = this.getBubbleIcon(task);

    const options: NotificationOptions & { requireInteraction?: boolean; renotify?: boolean; vibrate?: number[] } = {
        body: "Time to complete this task!",
        icon: iconUrl, 
        badge: './favicon.svg',
        tag: task.id, 
        silent: true, 
        requireInteraction: true, 
        renotify: true,
        data: { taskId: task.id },
        // Vibration pattern: SOS-like but faster (Short Short Long) to wake up attention
        vibrate: [100, 50, 100, 50, 300]
    };

    try {
        audioService.playAlert();

        let swReg: ServiceWorkerRegistration | undefined;
        if ('serviceWorker' in navigator) {
             try { swReg = await navigator.serviceWorker.ready; } catch(e) {}
        }

        if (swReg) {
            // Using Service Worker is critical for Android notifications to work properly
            await swReg.showNotification(title, options);
        } else {
            // Fallback
            const n = new Notification(title, options);
            n.onclick = () => { window.focus(); n.close(); };
        }
    } catch (e) {
        console.error("Failed to send notification", e);
    }
  }
}

export const notificationService = new NotificationService();