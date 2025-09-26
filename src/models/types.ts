// Supporting types and enums

export interface TimeRange {
  start: string; // HH:mm format
  end: string; // HH:mm format
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

export interface EnergyPreferences {
  highEnergyTimes: TimeRange[]; // best times for critical/complex tasks
  lowEnergyTimes: TimeRange[]; // suitable for low priority tasks
  meetingPreferredTimes: TimeRange[]; // preferred times for meetings
}

export interface NotificationSettings {
  taskReminders: boolean;
  scheduleChanges: boolean;
  deadlineAlerts: boolean;
  completionCelebrations: boolean;
}

export interface UserPreferences {
  maxContinuousWorkTime: number; // minutes
  preferredBreakDuration: number; // minutes
  groupSimilarTasks: boolean;
  protectFocusTime: boolean;
  optimizeForEarlyCompletion: boolean;
  defaultMeetingBuffer: number; // minutes before/after meetings
  energyPreferences: EnergyPreferences;
  autoRescheduleEnabled: boolean;
  notificationSettings: NotificationSettings;
}

export interface CalendarConnection {
  id: string;
  userId: string;
  provider: 'google' | 'microsoft';
  accountEmail: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledSlot {
  id: string;
  taskId: string;
  startTime: Date;
  endTime: Date;
  duration: number; // minutes
  isConfirmed: boolean;
}

export interface TaskCompletionEntry {
  timestamp: Date;
  minutesLogged: number;
  notes?: string;
  wasPartialCompletion: boolean;
}

export interface AvailabilityWindow {
  daysOfWeek: number[]; // 0-6, Sunday = 0
  timeRange: TimeRange;
  advanceBookingDays: number;
  maxBookingsPerDay?: number;
}

export interface ProjectProgress {
  totalTasks: number;
  completedTasks: number;
  totalMinutes: number;
  completedMinutes: number;
  estimatedCompletion: Date;
}

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'blocked';
export type CalendarSource = 'momentum' | 'google' | 'microsoft';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface AvailableSlot {
  startTime: Date;
  endTime: Date;
  duration: number; // minutes
}

// API Request/Response types
export interface CreateTaskRequest {
  title: string;
  description?: string;
  duration: number;
  priority: Priority;
  deadline?: Date;
  isHardDeadline: boolean;
  isBlocking: boolean;
  projectId?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  color: string;
}

export interface TaskCompletion {
  minutesCompleted: number;
  notes?: string;
  isFullCompletion: boolean;
}

export interface BookingLinkConfig {
  title: string;
  duration: number;
  availabilityWindow: AvailabilityWindow;
  bufferBefore: number;
  bufferAfter: number;
  customUrl?: string;
}

export interface MeetingBookingRequest {
  attendeeName: string;
  attendeeEmail: string;
  startTime: Date;
  notes?: string;
}

export interface BookingConfirmation {
  bookingId: string;
  meetingId: string;
  confirmationCode: string;
  calendarEventId: string;
}

// Scheduling types
export interface ScheduleResult {
  success: boolean;
  scheduledTasks: ScheduledSlot[];
  conflicts: string[];
  warnings: string[];
}

export interface ValidationResult {
  isValid: boolean;
  violations: string[];
  suggestions: string[];
}

export interface ConflictReport {
  hasConflicts: boolean;
  conflicts: SchedulingConflict[];
  recommendations: string[];
}

export interface SchedulingConflict {
  type: 'time_overlap' | 'deadline_impossible' | 'dependency_cycle';
  description: string;
  affectedTasks: string[];
  suggestedResolution: string;
}

export type RescheduleTrigger = 
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'calendar_event_added'
  | 'calendar_event_updated'
  | 'calendar_event_deleted'
  | 'manual_optimization';

export interface OptimizationPreferences {
  prioritizeEarlyCompletion: boolean;
  groupSimilarTasks: boolean;
  respectEnergyLevels: boolean;
  minimizeContextSwitching: boolean;
}

export interface SyncResult {
  success: boolean;
  eventsAdded: number;
  eventsUpdated: number;
  eventsDeleted: number;
  errors: string[];
}

export interface DependencyStatus {
  isBlocked: boolean;
  blockingTasks: string[];
  canBeScheduled: boolean;
}