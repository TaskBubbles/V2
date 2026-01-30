

import { Task } from '../types';
import { audioService } from './audioService';
import { MIN_BUBBLE_SIZE, MAX_BUBBLE_SIZE } from '../constants';

class NotificationService {
  // We store a composite key: "taskId_dueDateISO" to ensure that if a date changes, 
  // we re-notify.
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

  /**
   * Checks tasks against the current time and triggers notifications.
   * Also performs maintenance on the tracking set to remove stale data.
   */
  async checkAndNotify(tasks: Task[]) {
    if (!this.enabled) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const now = new Date();
    // Look back window (e.g. 24 hours) to avoid notifying for ancient overdue tasks on every reload
    // but still notify for recently overdue ones.
    const lookbackWindow = 24 * 60 * 60 * 1000; 
    
    // Set of active keys for the current task list
    const activeKeys = new Set<string>();

    for (const task of tasks) {
        if (task.completed || !task.dueDate) continue;

        const dueDate = new Date(task.dueDate);
        const timeDiff = now.getTime() - dueDate.getTime();
        
        // Create a unique event key for this specific due date instance
        const eventKey = `${task.id}_${task.dueDate}`;
        activeKeys.add(eventKey);

        // Notify if:
        // 1. It is past due (timeDiff >= 0)
        // 2. It is within the recent window (timeDiff < lookbackWindow)
        // 3. We haven't notified for this specific event key yet
        if (timeDiff >= 0 && timeDiff < lookbackWindow) {
            if (!this.notifiedEvents.has(eventKey)) {
                await this.sendNotification(task);
                this.notifiedEvents.add(eventKey);
                this.saveNotifiedEvents();
            }
        }
    }

    // Cleanup: Remove keys from history that no longer exist in the active task list
    // (e.g., deleted tasks, or tasks where the date was changed)
    this.cleanupStaleEvents(tasks);
  }

  private cleanupStaleEvents(tasks: Task[]) {
      const currentTaskIds = new Set(tasks.map(t => t.id));
      let changed = false;

      // We only keep event keys if the task still exists. 
      // Note: We don't delete based on date mismatch immediately because 
      // we want to remember we notified for the *old* date if it just passed.
      // But strictly speaking, if the task ID is gone, we can clear it.
      
      this.notifiedEvents.forEach(key => {
          const [taskId] = key.split('_');
          if (!currentTaskIds.has(taskId)) {
              this.notifiedEvents.delete(key);
              changed = true;
          }
      });

      if (changed) {
          this.saveNotifiedEvents();
      }
  }

  private saveNotifiedEvents() {
      try {
          localStorage.setItem('notifiedEvents', JSON.stringify(Array.from(this.notifiedEvents)));
      } catch (e) {
          console.error("Failed to save notified events", e);
      }
  }

  private getBubbleIcon(task: Task): string {
    const minSize = MIN_BUBBLE_SIZE || 20;
    const maxSize = MAX_BUBBLE_SIZE || 220;
    
    // Map task size to icon radius (keep padding)
    // Viewbox 192. Center 96. Max radius ~84 to allow stroke and glow
    const minR = 40;
    const maxR = 84;
    
    // Clamp size and normalize
    const size = Math.max(minSize, Math.min(maxSize, task.size));
    const t = (size - minSize) / (maxSize - minSize);
    const r = minR + t * (maxR - minR);

    // Generate an SVG string representing the bubble
    // We add a radial gradient and stroke to mimic the in-app bubble
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
      <defs>
        <radialGradient id="g" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stop-color="white" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="${task.color}" stop-opacity="0.3"/>
        </radialGradient>
      </defs>
      <circle cx="96" cy="96" r="${r}" fill="${task.color}" />
      <circle cx="96" cy="96" r="${r}" fill="url(#g)" />
      <circle cx="96" cy="96" r="${r}" fill="none" stroke="white" stroke-width="4" opacity="0.7" />
    </svg>`.trim();
    // Convert to Base64 Data URI
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  private async sendNotification(task: Task) {
    const title = task.title || "Untitled Task"; 
    const iconUrl = this.getBubbleIcon(task);

    // "requireInteraction" keeps the notification on screen until the user dismisses it (Chrome/Edge)
    const options: NotificationOptions & { requireInteraction?: boolean; renotify?: boolean; vibrate?: number[] } = {
        body: "Tap to open",
        icon: iconUrl, 
        badge: './favicon.svg',
        tag: task.id, // Replaces any existing notification for this task ID
        silent: true, // We handle audio manually for the custom chord
        requireInteraction: true, 
        renotify: true, // Triggers alert again even if tag matches (important for repeat reminders or if notification is still in tray)
        vibrate: [200, 100, 200, 100, 200, 100, 400], // Strong vibration pattern
        data: { taskId: task.id }
    };

    try {
        // Play custom 3-pop major chord
        // Note: AudioContext needs user gesture on some browsers, but if the app is open/active, it might work.
        audioService.playAlert();
        
        let notificationShown = false;

        // Try Service Worker first for better background handling/banner persistence on mobile
        if ('serviceWorker' in navigator) {
            try {
                const reg = await navigator.serviceWorker.getRegistration();
                if (reg && reg.active) {
                     await reg.showNotification(title, options);
                     notificationShown = true;
                }
            } catch (swError) {
                console.warn("SW notification failed, falling back", swError);
            }
        }
        
        // Fallback to standard Notification API if SW not available or failed
        if (!notificationShown) {
            const n = new Notification(title, options);
            n.onclick = (event) => {
                event.preventDefault();
                window.focus();
                n.close();
            };
        }
    } catch (e) {
        console.error("Failed to send notification", e);
    }
  }
}

export const notificationService = new NotificationService();