
import { Task } from '../types';
import { audioService } from './audioService';

class NotificationService {
  private notifiedTaskIds: Set<string> = new Set();
  private enabled: boolean = false;

  constructor() {
    try {
        this.enabled = localStorage.getItem('notificationsEnabled') === 'true';
        const storedIds = localStorage.getItem('notifiedTaskIds');
        if (storedIds) {
            this.notifiedTaskIds = new Set(JSON.parse(storedIds));
        }
    } catch {
        this.enabled = false;
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    
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
    // Look back window (e.g. 24 hours) to avoid notifying for ancient overdue tasks on every reload
    // but still notify for recent ones.
    const lookbackWindow = 24 * 60 * 60 * 1000; 

    for (const task of tasks) {
        if (task.completed || !task.dueDate) continue;

        const dueDate = new Date(task.dueDate);
        const timeDiff = now.getTime() - dueDate.getTime();

        // If due date is in the past AND within the lookback window
        // (i.e., due in the last 24 hours or just now)
        if (timeDiff >= 0 && timeDiff < lookbackWindow) {
            if (!this.notifiedTaskIds.has(task.id)) {
                await this.sendNotification(task);
                this.notifiedTaskIds.add(task.id);
                this.saveNotifiedIds();
            }
        }
    }
  }

  private saveNotifiedIds() {
      try {
          localStorage.setItem('notifiedTaskIds', JSON.stringify(Array.from(this.notifiedTaskIds)));
      } catch (e) {
          console.error("Failed to save notified IDs", e);
      }
  }

  private async sendNotification(task: Task) {
    const title = `Task Due: ${task.title}`;
    const options: NotificationOptions = {
        body: task.description || 'This task is now due.',
        icon: './favicon.ico', 
        badge: './favicon.ico',
        tag: task.id, // Replace existing notification for same task
        silent: false,
    };

    try {
        // Play sound inside the app context
        audioService.playAlert();
        
        // Trigger browser notification
        const n = new Notification(title, options);
        n.onclick = () => {
            window.focus();
            n.close();
        };
    } catch (e) {
        console.error("Failed to send notification", e);
    }
  }
}

export const notificationService = new NotificationService();
