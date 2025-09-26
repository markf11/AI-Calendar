import {Platform, PermissionsAndroid, Alert} from 'react-native';
import PushNotification from 'react-native-push-notification';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';
import {NotificationManager} from '../NotificationManager';
import {Task} from '@/types';

// Mock dependencies
jest.mock('react-native-push-notification');
jest.mock('react-native-permissions');
jest.mock('react-native', () => ({
  Platform: {OS: 'ios'},
  PermissionsAndroid: {
    request: jest.fn(),
    PERMISSIONS: {
      POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
    },
    RESULTS: {
      GRANTED: 'granted',
    },
  },
  Alert: {
    alert: jest.fn(),
  },
}));

const mockPushNotification = PushNotification as jest.Mocked<typeof PushNotification>;
const mockCheck = check as jest.MockedFunction<typeof check>;
const mockRequest = request as jest.MockedFunction<typeof request>;

describe('NotificationManager', () => {
  const mockTask: Task = {
    id: 'task1',
    userId: 'user1',
    title: 'Test Task',
    duration: 60,
    priority: 'high',
    deadline: new Date('2024-01-20T17:00:00'),
    isHardDeadline: true,
    isBlocking: false,
    dependencies: [],
    dependents: [],
    status: 'scheduled',
    completedMinutes: 0,
    remainingMinutes: 60,
    scheduledSlots: [
      {
        id: 'slot1',
        taskId: 'task1',
        startTime: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
        endTime: new Date(Date.now() + 90 * 60 * 1000), // 90 minutes from now
        duration: 60,
        isConfirmed: true,
      },
    ],
    completionHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should configure push notifications', async () => {
      mockCheck.mockResolvedValue(RESULTS.GRANTED);

      await NotificationManager.initialize();

      expect(mockPushNotification.configure).toHaveBeenCalledWith(
        expect.objectContaining({
          onRegister: expect.any(Function),
          onNotification: expect.any(Function),
          onAction: expect.any(Function),
          onRegistrationError: expect.any(Function),
        })
      );
    });

    it('should create notification channels on Android', async () => {
      // Mock Platform.OS to be 'android'
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        writable: true,
      });

      await NotificationManager.initialize();

      expect(mockPushNotification.createChannel).toHaveBeenCalledTimes(4);
      expect(mockPushNotification.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'task-reminders',
          channelName: 'Task Reminders',
        }),
        expect.any(Function)
      );
    });

    it('should not initialize twice', async () => {
      await NotificationManager.initialize();
      await NotificationManager.initialize();

      // Should only configure once
      expect(mockPushNotification.configure).toHaveBeenCalledTimes(1);
    });
  });

  describe('scheduleTaskReminder', () => {
    it('should schedule reminder for upcoming task', () => {
      NotificationManager.scheduleTaskReminder(mockTask, 15);

      expect(mockPushNotification.localNotificationSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'task-reminder-task1',
          channelId: 'task-reminders',
          title: 'Task Reminder',
          message: '"Test Task" starts in 15 minutes',
          actions: ['Complete', 'Snooze'],
        })
      );
    });

    it('should not schedule reminder for past tasks', () => {
      const pastTask = {
        ...mockTask,
        scheduledSlots: [
          {
            ...mockTask.scheduledSlots[0],
            startTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          },
        ],
      };

      NotificationManager.scheduleTaskReminder(pastTask, 15);

      expect(mockPushNotification.localNotificationSchedule).not.toHaveBeenCalled();
    });

    it('should not schedule reminder for tasks without slots', () => {
      const taskWithoutSlots = {
        ...mockTask,
        scheduledSlots: [],
      };

      NotificationManager.scheduleTaskReminder(taskWithoutSlots, 15);

      expect(mockPushNotification.localNotificationSchedule).not.toHaveBeenCalled();
    });

    it('should not schedule reminder if reminder time is in the past', () => {
      const soonTask = {
        ...mockTask,
        scheduledSlots: [
          {
            ...mockTask.scheduledSlots[0],
            startTime: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
          },
        ],
      };

      NotificationManager.scheduleTaskReminder(soonTask, 15); // 15 minutes before

      expect(mockPushNotification.localNotificationSchedule).not.toHaveBeenCalled();
    });
  });

  describe('scheduleDeadlineAlert', () => {
    it('should schedule deadline alert for task with deadline', () => {
      NotificationManager.scheduleDeadlineAlert(mockTask, 24);

      expect(mockPushNotification.localNotificationSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'deadline-alert-task1',
          channelId: 'deadline-alerts',
          title: 'URGENT: Deadline Approaching',
          message: '"Test Task" is due in 24 hours',
        })
      );
    });

    it('should use different urgency for soft deadlines', () => {
      const softDeadlineTask = {
        ...mockTask,
        isHardDeadline: false,
      };

      NotificationManager.scheduleDeadlineAlert(softDeadlineTask, 24);

      expect(mockPushNotification.localNotificationSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'REMINDER: Deadline Approaching',
        })
      );
    });

    it('should not schedule alert for tasks without deadline', () => {
      const taskWithoutDeadline = {
        ...mockTask,
        deadline: undefined,
      };

      NotificationManager.scheduleDeadlineAlert(taskWithoutDeadline, 24);

      expect(mockPushNotification.localNotificationSchedule).not.toHaveBeenCalled();
    });

    it('should not schedule alert if alert time is in the past', () => {
      const pastDeadlineTask = {
        ...mockTask,
        deadline: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
      };

      NotificationManager.scheduleDeadlineAlert(pastDeadlineTask, 24); // 24 hours before

      expect(mockPushNotification.localNotificationSchedule).not.toHaveBeenCalled();
    });
  });

  describe('notifyScheduleChange', () => {
    it('should notify about single task rescheduling', () => {
      NotificationManager.notifyScheduleChange([mockTask], 'Calendar event added');

      expect(mockPushNotification.localNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'schedule-changes',
          title: 'Schedule Updated',
          message: '"Test Task" has been rescheduled - Calendar event added',
        })
      );
    });

    it('should notify about multiple tasks rescheduling', () => {
      const tasks = [mockTask, {...mockTask, id: 'task2', title: 'Task 2'}];

      NotificationManager.notifyScheduleChange(tasks, 'Meeting moved');

      expect(mockPushNotification.localNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '2 tasks have been rescheduled - Meeting moved',
        })
      );
    });

    it('should not notify if no tasks changed', () => {
      NotificationManager.notifyScheduleChange([], 'No changes');

      expect(mockPushNotification.localNotification).not.toHaveBeenCalled();
    });
  });

  describe('celebrateTaskCompletion', () => {
    it('should celebrate task completion', () => {
      NotificationManager.celebrateTaskCompletion(mockTask);

      expect(mockPushNotification.localNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'celebrations',
          message: 'You completed "Test Task"',
          userInfo: expect.objectContaining({
            type: 'completion_celebration',
            taskId: 'task1',
          }),
        })
      );
    });

    it('should show streak information when provided', () => {
      NotificationManager.celebrateTaskCompletion(mockTask, 5);

      expect(mockPushNotification.localNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '5 in a row! 🔥',
          message: "You're on a 5-task streak! Keep going!",
        })
      );
    });

    it('should use special message for critical tasks', () => {
      const criticalTask = {
        ...mockTask,
        priority: 'critical' as const,
      };

      NotificationManager.celebrateTaskCompletion(criticalTask);

      expect(mockPushNotification.localNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Critical task done! 🎯',
        })
      );
    });

    it('should use special message for long tasks', () => {
      const longTask = {
        ...mockTask,
        duration: 150, // 2.5 hours
      };

      NotificationManager.celebrateTaskCompletion(longTask);

      expect(mockPushNotification.localNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Big task conquered! 💪',
        })
      );
    });
  });

  describe('scheduleSmartReminders', () => {
    const userPreferences = {
      workingHours: { start: '09:00', end: '17:00' },
      breakTimes: [{ start: '12:00', end: '13:00' }],
      preferredReminderTimes: ['09:00', '13:00', '17:00'],
    };

    it('should schedule multiple smart reminders', () => {
      NotificationManager.scheduleSmartReminders(mockTask, userPreferences);

      // Should schedule reminders for 60, 15, and 5 minutes before
      expect(mockPushNotification.localNotificationSchedule).toHaveBeenCalledTimes(3);
    });

    it('should skip reminders outside working hours', () => {
      const earlyTask = {
        ...mockTask,
        scheduledSlots: [
          {
            ...mockTask.scheduledSlots[0],
            startTime: new Date('2024-01-15T08:00:00'), // 8 AM, before work hours
          },
        ],
      };

      NotificationManager.scheduleSmartReminders(earlyTask, userPreferences);

      // Should not schedule any reminders
      expect(mockPushNotification.localNotificationSchedule).not.toHaveBeenCalled();
    });

    it('should skip reminders during break times', () => {
      const lunchTask = {
        ...mockTask,
        scheduledSlots: [
          {
            ...mockTask.scheduledSlots[0],
            startTime: new Date('2024-01-15T12:30:00'), // 12:30 PM, during lunch
          },
        ],
      };

      NotificationManager.scheduleSmartReminders(lunchTask, userPreferences);

      // Should skip the 15-minute reminder that would fall during lunch
      expect(mockPushNotification.localNotificationSchedule).toHaveBeenCalledTimes(2);
    });
  });

  describe('cancelTaskNotifications', () => {
    it('should cancel all notifications for a task', () => {
      NotificationManager.cancelTaskNotifications('task1');

      expect(mockPushNotification.cancelLocalNotifications).toHaveBeenCalledWith({
        id: 'task-reminder-task1',
      });
      expect(mockPushNotification.cancelLocalNotifications).toHaveBeenCalledWith({
        id: 'deadline-alert-task1',
      });
    });
  });

  describe('cancelAllNotifications', () => {
    it('should cancel all notifications', () => {
      NotificationManager.cancelAllNotifications();

      expect(mockPushNotification.cancelAllLocalNotifications).toHaveBeenCalled();
    });
  });

  describe('getScheduledNotifications', () => {
    it('should return scheduled notifications', async () => {
      const mockNotifications = [
        { id: 'task-reminder-task1', title: 'Task Reminder' },
      ];

      mockPushNotification.getScheduledLocalNotifications.mockImplementation((callback) => {
        callback(mockNotifications);
      });

      const result = await NotificationManager.getScheduledNotifications();

      expect(result).toEqual(mockNotifications);
    });
  });
});