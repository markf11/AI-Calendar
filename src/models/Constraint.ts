import { TimeRange, Priority } from './types';

// Core constraint types for the AI scheduling engine
export interface Constraint {
  id: string;
  type: ConstraintType;
  priority: number; // Higher number = higher priority
  description: string;
}

export type ConstraintType = 
  | 'working_hours'
  | 'lunch_break'
  | 'firm_event'
  | 'deadline'
  | 'task_priority'
  | 'buffer_time'
  | 'travel_time'
  | 'energy_preference'
  | 'dependency'
  | 'max_continuous_work';

// Working hours constraint
export interface WorkingHoursConstraint extends Constraint {
  type: 'working_hours';
  dayOfWeek: number; // 0-6, Sunday = 0
  timeRange: TimeRange;
  timezone: string;
}

// Lunch break constraint
export interface LunchBreakConstraint extends Constraint {
  type: 'lunch_break';
  timeRange: TimeRange;
  timezone: string;
}

// Firm event constraint (cannot be moved)
export interface FirmEventConstraint extends Constraint {
  type: 'firm_event';
  eventId: string;
  startTime: Date;
  endTime: Date;
  travelTimeBefore?: number; // minutes
  travelTimeAfter?: number; // minutes
}

// Deadline constraint
export interface DeadlineConstraint extends Constraint {
  type: 'deadline';
  taskId: string;
  deadline: Date;
  isHard: boolean; // hard deadline vs soft deadline
  urgencyScore: number; // calculated based on time remaining
}

// Task priority constraint
export interface TaskPriorityConstraint extends Constraint {
  type: 'task_priority';
  taskId: string;
  taskPriority: Priority;
  priorityScore: number; // calculated weighted score
}

// Buffer time constraint
export interface BufferTimeConstraint extends Constraint {
  type: 'buffer_time';
  beforeEventId?: string;
  afterEventId?: string;
  duration: number; // minutes
  startTime: Date;
  endTime: Date;
}

// Travel time constraint
export interface TravelTimeConstraint extends Constraint {
  type: 'travel_time';
  fromEventId?: string;
  toEventId?: string;
  duration: number; // minutes
  startTime: Date;
  endTime: Date;
}

// Energy preference constraint
export interface EnergyPreferenceConstraint extends Constraint {
  type: 'energy_preference';
  taskId: string;
  taskPriority: Priority;
  preferredTimeRanges: TimeRange[];
  energyLevel: 'high' | 'low' | 'meeting';
}

// Task dependency constraint
export interface DependencyConstraint extends Constraint {
  type: 'dependency';
  dependentTaskId: string;
  prerequisiteTaskId: string;
  mustCompleteFirst: boolean;
}

// Maximum continuous work time constraint
export interface MaxContinuousWorkConstraint extends Constraint {
  type: 'max_continuous_work';
  maxDuration: number; // minutes
  breakDuration: number; // minutes required after max work
}

// Union type for all constraints
export type SchedulingConstraint = 
  | WorkingHoursConstraint
  | LunchBreakConstraint
  | FirmEventConstraint
  | DeadlineConstraint
  | TaskPriorityConstraint
  | BufferTimeConstraint
  | TravelTimeConstraint
  | EnergyPreferenceConstraint
  | DependencyConstraint
  | MaxContinuousWorkConstraint;

// Constraint collection result
export interface ConstraintCollection {
  userId: string;
  constraints: SchedulingConstraint[];
  collectedAt: Date;
  validFrom: Date;
  validUntil: Date;
}

// Constraint violation
export interface ConstraintViolation {
  constraintId: string;
  constraintType: ConstraintType;
  severity: 'error' | 'warning' | 'info';
  message: string;
  affectedTaskIds: string[];
  suggestedResolution?: string;
}