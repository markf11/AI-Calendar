import type { RescheduleTrigger } from './ReschedulingTriggerService';

export interface ScheduleRequest {
  userId: string;
  horizonStart: Date;
  horizonEnd: Date;
  trigger: RescheduleTrigger;
}
