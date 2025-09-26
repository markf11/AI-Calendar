import { NotificationManager, NotificationOptions } from '../services/NotificationManager';

// Mock Electron modules
jest.mock('electron', () => ({
  Notification: {
    isSupported: jest.fn(() => true),
    prototype: {
      show: jest.fn(),
      on: jest.fn(),
      close: jest.fn()
    }
  },
  nativeImage: {
    createFromPath: jest.fn()
  },
  BrowserWindow: {
    getAllWindows: jest.fn(() => [
      {
        isMinimized: jest.fn(() => false),
        restore: jest.fn(),
        show: jest.fn(),
        focus: jest.fn(),
        webContents: {
          send: jest.fn()
        }
      }
    ])
  }
}));

jest.mock('node-notifier', () => ({
  notify: jest.fn()
}));

describe('NotificationManager', () => {
  let notificationManager: NotificationManager;

  beforeEach(() => {
    notificationManager = new NotificationManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    notificationManager.cleanup();
  });

  describe('showNotification', () => {
    it('should show a basic notification', async () => {
      const options: NotificationOptions = {
        title: 'Test Notification',
        body: 'This is a test notification'
      };

      const result = await notificationManager.showNotification(options);
      expect(result).toBe(true);
    });

    it('should show notification with actions', async () => {
      const options: NotificationOptions = {
        title: 'Task Reminder',
        body: 'Time to start your task',
        actions: [
          { type: 'start', text: 'Start Task' },
          { type: 'snooze', text: 'Snooze 5min' }
        ]
      };

      const result = await notificationManager.showNotification(options);
      expect(result).toBe(true);
    });

    it('should handle notification errors gracefully', async () => {
      // Mock Notification.isSupported to return false
      const { Notification } = require('electron');
      Notification.isSupported.mockReturnValue(false);

      const options: NotificationOptions = {
        title: 'Test',
        body: 'Test body'
      };

      const result = await notificationManager.showNotification(options);
      expect(result).toBe(true); // Should still return true as it falls back to node-notifier
    });
  });

  describe('showScheduleChangeNotification', () => {
    it('should show notification for rescheduled tasks', () => {
      const changes = {
        tasksRescheduled: 3,
        newConflicts: 0
      };

      const showNotificationSpy = jest.spyOn(notificationManager, 'showNotification');
      notificationManager.showScheduleChangeNotification(changes);

      expect(showNotificationSpy).toHaveBeenCalledWith({
        title: 'Schedule Updated',
        body: '3 tasks rescheduled',
        urgency: 'normal',
        actions: [{ type: 'view', text: 'View Schedule' }]
      });
    });

    it('should show notification for conflicts', () => {
      const changes = {
        tasksRescheduled: 0,
        newConflicts: 2
      };

      const showNotificationSpy = jest.spyOn(notificationManager, 'showNotification');
      notificationManager.showScheduleChangeNotification(changes);

      expect(showNotificationSpy).toHaveBeenCalledWith({
        title: 'Schedule Updated',
        body: '2 conflicts detected',
        urgency: 'critical',
        actions: [{ type: 'view', text: 'View Schedule' }]
      });
    });

    it('should show notification for both rescheduled tasks and conflicts', () => {
      const changes = {
        tasksRescheduled: 2,
        newConflicts: 1
      };

      const showNotificationSpy = jest.spyOn(notificationManager, 'showNotification');
      notificationManager.showScheduleChangeNotification(changes);

      expect(showNotificationSpy).toHaveBeenCalledWith({
        title: 'Schedule Updated',
        body: '2 tasks rescheduled, 1 conflict detected',
        urgency: 'critical',
        actions: [{ type: 'view', text: 'View Schedule' }]
      });
    });
  });

  describe('showTaskReminder', () => {
    it('should show reminder for task starting now', () => {
      const task = {
        id: 'task-1',
        title: 'Important Meeting',
        startTime: new Date(),
        duration: 60
      };

      const showNotificationSpy = jest.spyOn(notificationManager, 'showNotification');
      notificationManager.showTaskReminder(task);

      expect(showNotificationSpy).toHaveBeenCalledWith({
        title: 'Task Reminder',
        body: 'Time to start: Important Meeting',
        urgency: 'critical',
        actions: [
          { type: 'start', text: 'Start Task' },
          { type: 'snooze', text: 'Snooze 5min' }
        ]
      });
    });

    it('should show reminder for upcoming task', () => {
      const task = {
        id: 'task-1',
        title: 'Code Review',
        startTime: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        duration: 30
      };

      const showNotificationSpy = jest.spyOn(notificationManager, 'showNotification');
      notificationManager.showTaskReminder(task);

      expect(showNotificationSpy).toHaveBeenCalledWith({
        title: 'Task Reminder',
        body: 'Upcoming in 10 minutes: Code Review',
        urgency: 'normal',
        actions: [
          { type: 'start', text: 'Start Task' },
          { type: 'snooze', text: 'Snooze 5min' }
        ]
      });
    });
  });

  describe('showDeadlineAlert', () => {
    it('should show alert for hard deadline', () => {
      const task = {
        id: 'task-1',
        title: 'Project Submission',
        deadline: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        isHardDeadline: true
      };

      const showNotificationSpy = jest.spyOn(notificationManager, 'showNotification');
      notificationManager.showDeadlineAlert(task);

      expect(showNotificationSpy).toHaveBeenCalledWith({
        title: 'Deadline Alert',
        body: 'Hard deadline in 2 hours: Project Submission',
        urgency: 'critical',
        actions: [
          { type: 'reschedule', text: 'Reschedule' },
          { type: 'view', text: 'View Task' }
        ]
      });
    });

    it('should show alert for soft deadline', () => {
      const task = {
        id: 'task-1',
        title: 'Documentation Update',
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
        isHardDeadline: false
      };

      const showNotificationSpy = jest.spyOn(notificationManager, 'showNotification');
      notificationManager.showDeadlineAlert(task);

      expect(showNotificationSpy).toHaveBeenCalledWith({
        title: 'Deadline Alert',
        body: 'Soft deadline in 1 day: Documentation Update',
        urgency: 'normal',
        actions: [
          { type: 'reschedule', text: 'Reschedule' },
          { type: 'view', text: 'View Task' }
        ]
      });
    });

    it('should show alert for passed deadline', () => {
      const task = {
        id: 'task-1',
        title: 'Overdue Task',
        deadline: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        isHardDeadline: true
      };

      const showNotificationSpy = jest.spyOn(notificationManager, 'showNotification');
      notificationManager.showDeadlineAlert(task);

      expect(showNotificationSpy).toHaveBeenCalledWith({
        title: 'Deadline Alert',
        body: 'Hard deadline passed: Overdue Task',
        urgency: 'critical',
        actions: [
          { type: 'reschedule', text: 'Reschedule' },
          { type: 'view', text: 'View Task' }
        ]
      });
    });
  });

  describe('cleanup', () => {
    it('should close all active notifications', () => {
      // This test would need more complex mocking to test the actual cleanup
      expect(() => notificationManager.cleanup()).not.toThrow();
    });
  });
});