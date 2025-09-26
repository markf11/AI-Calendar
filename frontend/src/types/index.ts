// Core types matching backend models
export interface User {
  id: string
  email: string
  name: string
  timezone: string
  workingHours: WorkingHours
  preferences: UserPreferences
  connectedCalendars: CalendarConnection[]
  createdAt: Date
  updatedAt: Date
}

export interface Task {
  id: string
  userId: string
  projectId?: string
  title: string
  description?: string
  duration: number // minutes
  priority: 'low' | 'medium' | 'high' | 'critical'
  deadline?: Date
  isHardDeadline: boolean
  isBlocking: boolean
  dependencies: string[]
  dependents: string[]
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'blocked'
  completedMinutes: number
  remainingMinutes: number
  scheduledSlots: ScheduledSlot[]
  completionHistory: TaskCompletionEntry[]
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

export interface Project {
  id: string
  userId: string
  name: string
  description?: string
  color: string
  tasks: string[]
  createdAt: Date
  updatedAt: Date
}

export interface CalendarEvent {
  id: string
  userId: string
  externalId?: string
  title: string
  description?: string
  startTime: Date
  endTime: Date
  isFlexible: boolean
  travelTimeBefore?: number
  travelTimeAfter?: number
  source: 'momentum' | 'google' | 'microsoft'
  createdAt: Date
  updatedAt: Date
}

export interface ScheduledSlot {
  id: string
  taskId: string
  startTime: Date
  endTime: Date
  duration: number
  isConfirmed: boolean
}

export interface WorkingHours {
  monday: TimeRange
  tuesday: TimeRange
  wednesday: TimeRange
  thursday: TimeRange
  friday: TimeRange
  saturday?: TimeRange
  sunday?: TimeRange
  lunchBreak?: TimeRange
}

export interface TimeRange {
  start: string // HH:mm format
  end: string // HH:mm format
}

export interface UserPreferences {
  maxContinuousWorkTime: number
  preferredBreakDuration: number
  groupSimilarTasks: boolean
  protectFocusTime: boolean
  optimizeForEarlyCompletion: boolean
  defaultMeetingBuffer: number
  energyPreferences: EnergyPreferences
  autoRescheduleEnabled: boolean
  notificationSettings: NotificationSettings
}

export interface EnergyPreferences {
  highEnergyTimes: TimeRange[]
  lowEnergyTimes: TimeRange[]
  meetingPreferredTimes: TimeRange[]
}

export interface NotificationSettings {
  taskReminders: boolean
  scheduleChanges: boolean
  deadlineAlerts: boolean
  completionCelebrations: boolean
}

export interface CalendarConnection {
  id: string
  provider: 'google' | 'microsoft'
  email: string
  isActive: boolean
  lastSyncAt?: Date
}

export interface TaskCompletionEntry {
  timestamp: Date
  minutesLogged: number
  notes?: string
  wasPartialCompletion: boolean
}

// Calendar view types
export type CalendarView = 'day' | 'week' | 'month'

export interface CalendarViewState {
  view: CalendarView
  currentDate: Date
  selectedDate?: Date
}

// UI-specific types
export interface CalendarEventDisplay extends CalendarEvent {
  position: {
    top: number
    height: number
    left: number
    width: number
  }
  isSelected?: boolean
  isDragging?: boolean
}

export interface TaskDisplay extends Task {
  project?: Project
  isSelected?: boolean
  isDragging?: boolean
}

// API response types
export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}