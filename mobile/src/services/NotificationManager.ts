import PushNotification, {Importance} from 'react-native-push-notification';
import {Platform, PermissionsAndroid} from 'react-native';
import {PushNotificationData, Task} from '@/types';

export class NotificationManager {
  private static isInitialized = false;

  static async initialize(): Promise<void> {
    if (NotificationManager.isInitialized) return;

    // Request permissions
    await NotificationManager.requestPermissions();

    // Configure push notifications
    PushNotification.configure({
      onRegister: function (token) {
        console.log('Push notification token:', token);
        // In a real app, send this token to your backend
      },

      onNotification: function (notification) {
        console.log('Notification received:', notification);
        
        // Handle notification tap
        if (notification.userInteraction) {
          NotificationManager.handleNotificationTap(notification);
        }
      },

      onAction: function (notification) {
        console.log('Notification action:', notification.action);
        
        if (notification.action === 'Complete') {
          NotificationManager.handleTaskCompletion(notification.data?.taskId);
        } else if (notification.action === 'Snooze') {
          NotificationManager.snoozeTaskReminder(notification.data?.taskId, 15);
        }
      },

      onRegistrationError: function (err) {
        console.error('Push notification registration error:', err.message);
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    // Create notification channels for Android
    if (Platform.OS === 'android') {
      NotificationManager.createNotificationChannels();
    }

    NotificationManager.isInitialized = true;
  }

  private static async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Notification Permission',
            message: 'Momentum needs notification permission to send you task reminders and schedule updates.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Permission request error:', err);
        return false;
      }
    }
    return true;
  }

  private static createNotificationChannels(): void {
    PushNotification.createChannel(
      {
        channelId: 'task-reminders',
        channelName: 'Task Reminders',
        channelDescription: 'Notifications for upcoming tasks and deadlines',
        importance: Importance.HIGH,
        vibrate: true,
      },
      (created) => console.log(`Task reminders channel created: ${created}`)
    );

    PushNotification.createChannel(
      {
        channelId: 'schedule-changes',
        channelName: 'Schedule Changes',
        channelDescription: 'Notifications when your schedule is automatically updated',
        importance: Importance.DEFAULT,
        vibrate: false,
      },
      (created) => console.log(`Schedule changes channel created: ${created}`)
    );

    PushNotification.createChannel(
      {
        channelId: 'deadline-alerts',
        channelName: 'Deadline Alerts',
        channelDescription: 'Critical alerts for approaching deadlines',
        importance: Importance.HIGH,
        vibrate: true,
      },
      (created) => console.log(`Deadline alerts channel created: ${created}`)
    );

    PushNotification.createChannel(
      {
        channelId: 'celebrations',
        channelName: 'Celebrations',
        channelDescription: 'Positive notifications for task completions',
        importance: Importance.LOW,
        vibrate: false,
      },
      (created) => console.log(`Celebrations channel created: ${created}`)
    );
  }

  static scheduleTaskReminder(task: Task, minutesBefore: number = 15): void {
    if (!task.scheduledSlots.length) return;

    const nextSlot = task.scheduledSlots
      .filter(slot => new Date(slot.startTime) > new Date())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

    if (!nextSlot) return;

    const reminderTime = new Date(new Date(nextSlot.startTime).getTime() - minutesBefore * 60 * 1000);
    
    if (reminderTime <= new Date()) return; // Don't schedule past reminders

    PushNotification.localNotificationSchedule({
      id: `task-reminder-${task.id}`,
      channelId: 'task-reminders',
      title: 'Task Reminder',
      message: `"${task.title}" starts in ${minutesBefore} minutes`,
      date: reminderTime,
      actions: ['Complete', 'Snooze'],
      userInfo: {
        type: 'task_reminder',
        taskId: task.id,
        taskTitle: task.title,
      },
      soundName: 'default',
      vibrate: true,
    });
  }

  static scheduleDeadlineAlert(task: Task, hoursBefore: number = 24): void {
    if (!task.deadline) return;

    const alertTime = new Date(new Date(task.deadline).getTime() - hoursBefore * 60 * 60 * 1000);
    
    if (alertTime <= new Date()) return;

    const urgencyLevel = task.isHardDeadline ? 'URGENT' : 'REMINDER';
    
    PushNotification.localNotificationSchedule({
      id: `deadline-alert-${task.id}`,
      channelId: 'deadline-alerts',
      title: `${urgencyLevel}: Deadline Approaching`,
      message: `"${task.title}" is due in ${hoursBefore} hours`,
      date: alertTime,
      userInfo: {
        type: 'deadline_alert',
        taskId: task.id,
        taskTitle: task.title,
        isHardDeadline: task.isHardDeadline,
      },
      soundName: task.isHardDeadline ? 'default' : undefined,
      vibrate: task.isHardDeadline,
      priority: task.isHardDeadline ? 'high' : 'default',
    });
  }

  static notifyScheduleChange(changedTasks: Task[], reason: string): void {
    if (changedTasks.length === 0) return;

    const message = changedTasks.length === 1
      ? `"${changedTasks[0].title}" has been rescheduled`
      : `${changedTasks.length} tasks have been rescheduled`;

    PushNotification.localNotification({
      channelId: 'schedule-changes',
      title: 'Schedule Updated',
      message: `${message} - ${reason}`,
      userInfo: {
        type: 'schedule_change',
        changedTaskIds: changedTasks.map(t => t.id),
        reason,
      },
      soundName: undefined, // Silent notification
      vibrate: false,
    });
  }

  static celebrateTaskCompletion(task: Task, streakCount?: number): void {
    const messages = [
      'Great job! 🎉',
      'Task completed! 👏',
      'Well done! ✨',
      'Another one done! 🚀',
      'Keep it up! 💪',
    ];

    let message = messages[Math.floor(Math.random() * messages.length)];
    let body = `You completed "${task.title}"`;

    // Add streak information if available
    if (streakCount && streakCount > 1) {
      message = `${streakCount} in a row! 🔥`;
      body = `You're on a ${streakCount}-task streak! Keep going!`;
    }

    // Special messages for high-value completions
    if (task.priority === 'critical') {
      message = 'Critical task done! 🎯';
    } else if (task.duration >= 120) { // 2+ hours
      message = 'Big task conquered! 💪';
    }

    PushNotification.localNotification({
      channelId: 'celebrations',
      title: message,
      message: body,
      userInfo: {
        type: 'completion_celebration',
        taskId: task.id,
        taskTitle: task.title,
        streakCount,
      },
      soundName: 'default',
      vibrate: false,
    });
  }

  static scheduleLocationBasedReminder(
    task: Task,
    location: {latitude: number; longitude: number; name: string},
    radius: number = 100 // meters
  ): void {
    // Note: React Native doesn't have built-in geofencing
    // This would typically require a native module or third-party library
    // For now, we'll store the location data for future implementation
    
    console.log(`Location-based reminder set for task "${task.title}" at ${location.name}`);
    
    // Store location reminder data
    const locationReminder = {
      taskId: task.id,
      location,
      radius,
      createdAt: Date.now(),
    };
    
    // In a real implementation, this would set up geofencing
    // For now, we'll just log it
    console.log('Location reminder data:', locationReminder);
  }

  static scheduleSmartReminders(task: Task, userPreferences: {
    workingHours: {start: string; end: string};
    breakTimes: Array<{start: string; end: string}>;
    preferredReminderTimes: string[]; // e.g., ['09:00', '13:00', '17:00']
  }): void {
    if (!task.scheduledSlots.length) return;

    const nextSlot = task.scheduledSlots
      .filter(slot => new Date(slot.startTime) > new Date())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

    if (!nextSlot) return;

    const slotStart = new Date(nextSlot.startTime);
    
    // Schedule multiple smart reminders
    const reminderTimes = [
      { minutes: 60, label: '1 hour' },
      { minutes: 15, label: '15 minutes' },
      { minutes: 5, label: '5 minutes' },
    ];

    reminderTimes.forEach(({ minutes, label }) => {
      const reminderTime = new Date(slotStart.getTime() - minutes * 60 * 1000);
      
      if (reminderTime <= new Date()) return;

      // Check if reminder time falls within working hours
      const reminderHour = reminderTime.getHours();
      const workStart = parseInt(userPreferences.workingHours.start.split(':')[0]);
      const workEnd = parseInt(userPreferences.workingHours.end.split(':')[0]);
      
      if (reminderHour < workStart || reminderHour > workEnd) {
        return; // Skip reminders outside working hours
      }

      // Check if reminder time conflicts with break times
      const reminderTimeStr = `${reminderHour.toString().padStart(2, '0')}:${reminderTime.getMinutes().toString().padStart(2, '0')}`;
      const isBreakTime = userPreferences.breakTimes.some(breakTime => {
        return reminderTimeStr >= breakTime.start && reminderTimeStr <= breakTime.end;
      });

      if (isBreakTime) return;

      PushNotification.localNotificationSchedule({
        id: `smart-reminder-${task.id}-${minutes}`,
        channelId: 'task-reminders',
        title: `Task in ${label}`,
        message: `"${task.title}" starts soon. Get ready!`,
        date: reminderTime,
        userInfo: {
          type: 'smart_reminder',
          taskId: task.id,
          taskTitle: task.title,
          minutesBefore: minutes,
        },
        soundName: minutes <= 5 ? 'default' : undefined, // Only sound for urgent reminders
        vibrate: minutes <= 15,
      });
    });
  }

  static scheduleWeeklyReview(): void {
    // Schedule weekly review notification for Sunday evening
    const now = new Date();
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + (7 - now.getDay()));
    nextSunday.setHours(18, 0, 0, 0); // 6 PM

    PushNotification.localNotificationSchedule({
      id: 'weekly-review',
      channelId: 'celebrations',
      title: 'Weekly Review 📊',
      message: 'Take a moment to review your accomplishments this week!',
      date: nextSunday,
      repeatType: 'week',
      userInfo: {
        type: 'weekly_review',
      },
      soundName: undefined,
      vibrate: false,
    });
  }

  static scheduleDailyMotivation(): void {
    // Schedule daily motivation notification for 8 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);

    const motivationalMessages = [
      'Ready to make today amazing? 🌟',
      'Your future self will thank you! 💪',
      'Small steps lead to big achievements! 🚀',
      'Today is full of possibilities! ✨',
      'You\'ve got this! Let\'s make it count! 🎯',
    ];

    const message = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

    PushNotification.localNotificationSchedule({
      id: 'daily-motivation',
      channelId: 'celebrations',
      title: 'Good morning! ☀️',
      message,
      date: tomorrow,
      repeatType: 'day',
      userInfo: {
        type: 'daily_motivation',
      },
      soundName: undefined,
      vibrate: false,
    });
  }

  static cancelTaskNotifications(taskId: string): void {
    PushNotification.cancelLocalNotifications({
      id: `task-reminder-${taskId}`,
    });
    
    PushNotification.cancelLocalNotifications({
      id: `deadline-alert-${taskId}`,
    });
  }

  static cancelAllNotifications(): void {
    PushNotification.cancelAllLocalNotifications();
  }

  private static handleNotificationTap(notification: any): void {
    const {type, taskId} = notification.data || {};
    
    switch (type) {
      case 'task_reminder':
      case 'deadline_alert':
        // Navigate to task detail or calendar view
        console.log('Navigate to task:', taskId);
        break;
      
      case 'schedule_change':
        // Navigate to calendar view
        console.log('Navigate to calendar');
        break;
      
      case 'completion_celebration':
        // Maybe show achievements or progress
        console.log('Show celebration');
        break;
    }
  }

  private static handleTaskCompletion(taskId: string): void {
    if (!taskId) return;
    
    // Complete the task in the store
    const {completeTask} = require('@/store/useAppStore').useAppStore.getState();
    completeTask(taskId);
    
    console.log('Task completed via notification:', taskId);
  }

  private static snoozeTaskReminder(taskId: string, minutes: number): void {
    if (!taskId) return;
    
    // Cancel existing reminder
    NotificationManager.cancelTaskNotifications(taskId);
    
    // Schedule new reminder
    const snoozeTime = new Date(Date.now() + minutes * 60 * 1000);
    
    PushNotification.localNotificationSchedule({
      id: `task-reminder-${taskId}-snoozed`,
      channelId: 'task-reminders',
      title: 'Task Reminder (Snoozed)',
      message: 'Time to work on your task!',
      date: snoozeTime,
      userInfo: {
        type: 'task_reminder',
        taskId,
        snoozed: true,
      },
      soundName: 'default',
      vibrate: true,
    });
    
    console.log(`Task reminder snoozed for ${minutes} minutes:`, taskId);
  }

  static async getScheduledNotifications(): Promise<any[]> {
    return new Promise((resolve) => {
      PushNotification.getScheduledLocalNotifications((notifications) => {
        resolve(notifications);
      });
    });
  }
}