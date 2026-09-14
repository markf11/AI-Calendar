import { CalendarEvent } from './CalendarEvent';

export interface ScheduleBlock {
  id: string;
  taskId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  isConfirmed?: boolean;
}

export interface ScheduleAlert {
  id?: string;
  type: string;
  message: string;
  severity?: 'info' | 'warning' | 'error';
  taskId?: string;
}

export interface ScheduleExplanation {
  taskId?: string;
  blockId?: string;
  reason: string;
  details?: string;
}

export interface ScheduleSnapshot {
  events: CalendarEvent[];
  taskBlocks: ScheduleBlock[];
  alerts: ScheduleAlert[];
  explanations: ScheduleExplanation[];
  revision: number;
}

export type ScheduleSnapshotInput = Omit<ScheduleSnapshot, 'revision'>;

export interface ScheduleRevision {
  id: string;
  userId: string;
  revision: number;
  horizonStart: Date;
  horizonEnd: Date;
  trigger: string;
  snapshot: ScheduleSnapshot;
  restoredFromRevision?: number;
  createdAt: Date;
}
