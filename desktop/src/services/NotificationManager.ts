import { Notification, nativeImage } from 'electron';
import * as notifier from 'node-notifier';
import * as path from 'path';

export interface NotificationOptions {
  title: string;
  body: string;
  actions?: Array<{
    type: string;
    text: string;
  }>;
  icon?: string;
  sound?: boolean;
  urgency?: 'low' | 'normal' | 'critical';
}

export class NotificationManager {
  private activeNotifications: Map<string, Notification> = new Map();

  constructor() {
    this.setupNotificationHandlers();
  }

  public showNotification(options: NotificationOptions): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // Use Electron's native notification if supported
        if (Notification.isSupported()) {
          this.showElectronNotification(options);
          resolve(true);
        } else {
          // Fallback to node-notifier for older systems
          this.showFallbackNotification(options);
          resolve(true);
        }
      } catch (error) {
        console.error('Failed to show notification:', error);
        resolve(false);
      }
    });
  }

  public showScheduleChangeNotification(changes: {
    tasksRescheduled: number;
    newConflicts: number;
  }): void {
    const title = 'Schedule Updated';
    let body = '';

    if (changes.tasksRescheduled > 0) {
      body += `${changes.tasksRescheduled} task${changes.tasksRescheduled > 1 ? 's' : ''} rescheduled`;
    }

    if (changes.newConflicts > 0) {
      if (body) body += ', ';
      body += `${changes.newConflicts} conflict${changes.newConflicts > 1 ? 's' : ''} detected`;
    }

    if (!body) {
      body = 'Your schedule has been optimized';
    }

    this.showNotification({
      title,
      body,
      urgency: changes.newConflicts > 0 ? 'critical' : 'normal',
      actions: [
        { type: 'view', text: 'View Schedule' }
      ]
    });
  }

  public showTaskReminder(task: {
    id: string;
    title: string;
    startTime: Date;
    duration: number;
  }): void {
    const timeUntilStart = Math.round((task.startTime.getTime() - Date.now()) / (1000 * 60));
    
    let body = '';
    if (timeUntilStart <= 0) {
      body = `Time to start: ${task.title}`;
    } else if (timeUntilStart <= 5) {
      body = `Starting in ${timeUntilStart} minute${timeUntilStart > 1 ? 's' : ''}: ${task.title}`;
    } else {
      body = `Upcoming in ${timeUntilStart} minutes: ${task.title}`;
    }

    this.showNotification({
      title: 'Task Reminder',
      body,
      urgency: timeUntilStart <= 0 ? 'critical' : 'normal',
      actions: [
        { type: 'start', text: 'Start Task' },
        { type: 'snooze', text: 'Snooze 5min' }
      ]
    });
  }

  public showDeadlineAlert(task: {
    id: string;
    title: string;
    deadline: Date;
    isHardDeadline: boolean;
  }): void {
    const timeUntilDeadline = Math.round((task.deadline.getTime() - Date.now()) / (1000 * 60 * 60));
    
    const urgencyLevel = task.isHardDeadline ? 'critical' : 'normal';
    const deadlineType = task.isHardDeadline ? 'Hard deadline' : 'Soft deadline';
    
    let body = '';
    if (timeUntilDeadline <= 0) {
      body = `${deadlineType} passed: ${task.title}`;
    } else if (timeUntilDeadline <= 24) {
      body = `${deadlineType} in ${timeUntilDeadline} hour${timeUntilDeadline > 1 ? 's' : ''}: ${task.title}`;
    } else {
      const days = Math.round(timeUntilDeadline / 24);
      body = `${deadlineType} in ${days} day${days > 1 ? 's' : ''}: ${task.title}`;
    }

    this.showNotification({
      title: 'Deadline Alert',
      body,
      urgency: urgencyLevel,
      actions: [
        { type: 'reschedule', text: 'Reschedule' },
        { type: 'view', text: 'View Task' }
      ]
    });
  }

  private showElectronNotification(options: NotificationOptions): void {
    const notification = new Notification({
      title: options.title,
      body: options.body,
      icon: options.icon || this.getDefaultIcon(),
      sound: options.sound !== false,
      urgency: options.urgency || 'normal',
      actions: options.actions?.map(action => ({
        type: 'button',
        text: action.text
      })) || []
    });

    // Store notification for potential cleanup
    const notificationId = `${Date.now()}-${Math.random()}`;
    this.activeNotifications.set(notificationId, notification);

    notification.on('click', () => {
      this.handleNotificationClick(options);
      this.activeNotifications.delete(notificationId);
    });

    notification.on('action', (_, index) => {
      if (options.actions && options.actions[index]) {
        this.handleNotificationAction(options.actions[index]);
      }
      this.activeNotifications.delete(notificationId);
    });

    notification.on('close', () => {
      this.activeNotifications.delete(notificationId);
    });

    notification.show();
  }

  private showFallbackNotification(options: NotificationOptions): void {
    notifier.notify({
      title: options.title,
      message: options.body,
      icon: options.icon || this.getDefaultIcon(),
      sound: options.sound !== false,
      wait: true
    }, (err, response, metadata) => {
      if (err) {
        console.error('Notification error:', err);
        return;
      }

      if (response === 'activate') {
        this.handleNotificationClick(options);
      }
    });
  }

  private handleNotificationClick(options: NotificationOptions): void {
    // Bring the main window to focus
    const { BrowserWindow } = require('electron');
    const mainWindow = BrowserWindow.getAllWindows()[0];
    
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  }

  private handleNotificationAction(action: { type: string; text: string }): void {
    // Send action to renderer process
    const { BrowserWindow } = require('electron');
    const mainWindow = BrowserWindow.getAllWindows()[0];
    
    if (mainWindow) {
      mainWindow.webContents.send('notification-action', action);
    }
  }

  private getDefaultIcon(): string {
    return path.join(__dirname, '../../assets/notification-icon.png');
  }

  private setupNotificationHandlers(): void {
    // Handle notification permissions on Windows/Linux
    if (process.platform === 'win32' || process.platform === 'linux') {
      // Request notification permissions if needed
      // This is handled automatically by Electron on most systems
    }
  }

  public cleanup(): void {
    // Close all active notifications
    this.activeNotifications.forEach(notification => {
      notification.close();
    });
    this.activeNotifications.clear();
  }
}