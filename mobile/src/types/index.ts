export interface User {
  id: string;
  email: string;
  name: string;
  timezone: string;
  workingHours: WorkingHours;
  preferences: UserPreferences;
  connectedCalendars: CalendarConnection[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  userId: string;
  projectId?: string;
  title: string;
  description?: string;
  duration: number; // minutes
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: Date;
  isHardDeadline: boolean;
  isBlocking: boolean;
  dependencies: string[];
  dependents: string[];
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'blocked';
  completedMinutes: number;
  remainingMinutes: number;
  scheduledSlots: ScheduledSlot[];
  completionHistory: TaskCompletionEntry[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color: string;
  tasks: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  externalId?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  isFlexible: boolean;
  travelTimeBefore?: number;
  travelTimeAfter?: number;
  source: 'momentum' | 'google' | 'microsoft';
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledSlot {
  id: string;
  taskId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  isConfirmed: boolean;
}

export interface WorkingHours {
  monday: TimeRange;
  tuesday: TimeRange;
  wednesday: TimeRange;
  thursday: TimeRange;
  friday: TimeRange;
  saturday?: TimeRange;
  sunday?: TimeRange;
  lunchBreak?: TimeRange;
}

export interface TimeRange {
  start: string; // HH:mm format
  end: string; // HH:mm format
}

export interface UserPreferences {
  maxContinuousWorkTime: number;
  preferredBreakDuration: number;
  groupSimilarTasks: boolean;
  protectFocusTime: boolean;
  optimizeForEarlyCompletion: boolean;
  defaultMeetingBuffer: number;
  energyPreferences: EnergyPreferences;
  autoRescheduleEnabled: boolean;
  notificationSettings: NotificationSettings;
}

export interface CalendarConnection {
  id: string;
  provider: 'google' | 'microsoft';
  email: string;
  isActive: boolean;
  lastSyncAt?: Date;
}

export interface TaskCompletionEntry {
  timestamp: Date;
  minutesLogged: number;
  notes?: string;
  wasPartialCompletion: boolean;
}

export interface EnergyPreferences {
  highEnergyTimes: TimeRange[];
  lowEnergyTimes: TimeRange[];
  meetingPreferredTimes: TimeRange[];
}

export interface NotificationSettings {
  taskReminders: boolean;
  scheduleChanges: boolean;
  deadlineAlerts: boolean;
  completionCelebrations: boolean;
}

// Mobile-specific types
export interface DailySchedule {
  date: string;
  events: CalendarEvent[];
  tasks: Task[];
  totalScheduledMinutes: number;
  freeTimeSlots: TimeRange[];
}

export interface SwipeGesture {
  direction: 'left' | 'right' | 'up' | 'down';
  velocity: number;
  distance: number;
}

export interface VoiceInput {
  text: string;
  confidence: number;
  isListening: boolean;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface OfflineData {
  schedule: DailySchedule[];
  tasks: Task[];
  projects: Project[];
  lastSyncTimestamp: number;
}

export interface PushNotificationData {
  type: 'task_reminder' | 'schedule_change' | 'deadline_alert' | 'completion_celebration';
  taskId?: string;
  title: string;
  body: string;
  data?: any;
}