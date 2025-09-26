import { Priority, TaskStatus, ScheduledSlot, TaskCompletionEntry } from './types';

export interface Task {
  id: string;
  userId: string;
  projectId?: string;
  title: string;
  description?: string;
  duration: number; // minutes
  priority: Priority;
  deadline?: Date;
  isHardDeadline: boolean; // distinguishes hard vs soft deadlines
  isBlocking: boolean; // cannot be split into chunks
  dependencies: string[]; // task IDs this task depends on
  dependents: string[]; // task IDs that depend on this task
  status: TaskStatus;
  completedMinutes: number;
  remainingMinutes: number; // calculated field: duration - completedMinutes
  scheduledSlots: ScheduledSlot[];
  completionHistory: TaskCompletionEntry[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface TaskWithProject extends Task {
  project?: {
    id: string;
    name: string;
    color: string;
  };
}

export interface TaskSummary {
  id: string;
  title: string;
  duration: number;
  priority: Priority;
  status: TaskStatus;
  deadline?: Date;
  projectName?: string;
  projectColor?: string;
}