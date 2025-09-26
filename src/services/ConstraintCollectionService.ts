import { 
  SchedulingConstraint, 
  ConstraintCollection,
  WorkingHoursConstraint,
  LunchBreakConstraint,
  FirmEventConstraint,
  DeadlineConstraint,
  TaskPriorityConstraint,
  BufferTimeConstraint,
  TravelTimeConstraint,
  EnergyPreferenceConstraint,
  DependencyConstraint,
  MaxContinuousWorkConstraint
} from '@/models/Constraint';
import { User } from '@/models/User';
import { Task } from '@/models/Task';
import { CalendarEvent } from '@/models/CalendarEvent';
import { Priority, TimeRange } from '@/models/types';
import { UserRepository } from '@/repositories/UserRepository';
import { TaskRepository } from '@/repositories/TaskRepository';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import { EncryptionService } from '@/utils/encryption';

export class ConstraintCollectionService {
  constructor(
    private userRepository: UserRepository,
    private taskRepository: TaskRepository,
    private calendarEventRepository: CalendarEventRepository
  ) {}

  /**
   * Collect all constraints for a user within a date range
   */
  async collectConstraints(
    userId: string, 
    validFrom: Date, 
    validUntil: Date
  ): Promise<ConstraintCollection> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const tasks = await this.taskRepository.findByUserId(userId);
    const calendarEvents = await this.calendarEventRepository.findByUserAndDateRange(
      userId, 
      { start: validFrom, end: validUntil }
    );

    const constraints: SchedulingConstraint[] = [];

    // Collect working hours constraints
    constraints.push(...this.collectWorkingHoursConstraints(user, validFrom, validUntil));

    // Collect lunch break constraints
    constraints.push(...this.collectLunchBreakConstraints(user, validFrom, validUntil));

    // Collect firm event constraints from external calendars
    constraints.push(...this.collectFirmEventConstraints(calendarEvents));

    // Collect deadline constraints
    constraints.push(...this.collectDeadlineConstraints(tasks, validUntil));

    // Collect task priority constraints
    constraints.push(...this.collectTaskPriorityConstraints(tasks));

    // Collect buffer time constraints
    constraints.push(...this.collectBufferTimeConstraints(user, calendarEvents));

    // Collect travel time constraints
    constraints.push(...this.collectTravelTimeConstraints(calendarEvents));

    // Collect energy preference constraints
    constraints.push(...this.collectEnergyPreferenceConstraints(user, tasks));

    // Collect dependency constraints
    constraints.push(...this.collectDependencyConstraints(tasks));

    // Collect max continuous work constraints
    constraints.push(...this.collectMaxContinuousWorkConstraints(user));

    return {
      userId,
      constraints,
      collectedAt: new Date(),
      validFrom,
      validUntil
    };
  }

  /**
   * Collect working hours constraints for each day in the date range
   */
  private collectWorkingHoursConstraints(
    user: User, 
    validFrom: Date, 
    validUntil: Date
  ): WorkingHoursConstraint[] {
    const constraints: WorkingHoursConstraint[] = [];
    const workingHours = user.workingHours;

    // Generate constraints for each day in the range
    const currentDate = new Date(validFrom);
    while (currentDate <= validUntil) {
      const dayOfWeek = currentDate.getDay();
      let timeRange: TimeRange | undefined;

      switch (dayOfWeek) {
        case 0: timeRange = workingHours.sunday; break;
        case 1: timeRange = workingHours.monday; break;
        case 2: timeRange = workingHours.tuesday; break;
        case 3: timeRange = workingHours.wednesday; break;
        case 4: timeRange = workingHours.thursday; break;
        case 5: timeRange = workingHours.friday; break;
        case 6: timeRange = workingHours.saturday; break;
      }

      if (timeRange) {
        constraints.push({
          id: EncryptionService.generateUUID(),
          type: 'working_hours',
          priority: 100, // High priority - cannot schedule outside working hours
          description: `Working hours for ${this.getDayName(dayOfWeek)}: ${timeRange.start} - ${timeRange.end}`,
          dayOfWeek,
          timeRange,
          timezone: user.timezone
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return constraints;
  }

  /**
   * Collect lunch break constraints
   */
  private collectLunchBreakConstraints(
    user: User, 
    validFrom: Date, 
    validUntil: Date
  ): LunchBreakConstraint[] {
    const constraints: LunchBreakConstraint[] = [];
    const lunchBreak = user.workingHours.lunchBreak;

    if (lunchBreak) {
      constraints.push({
        id: EncryptionService.generateUUID(),
        type: 'lunch_break',
        priority: 90, // High priority - protect lunch time
        description: `Lunch break: ${lunchBreak.start} - ${lunchBreak.end}`,
        timeRange: lunchBreak,
        timezone: user.timezone
      });
    }

    return constraints;
  }

  /**
   * Collect firm event constraints from external calendars
   */
  private collectFirmEventConstraints(calendarEvents: CalendarEvent[]): FirmEventConstraint[] {
    return calendarEvents
      .filter(event => !event.isFlexible) // Only firm events that cannot be moved
      .map(event => ({
        id: EncryptionService.generateUUID(),
        type: 'firm_event' as const,
        priority: 95, // Very high priority - cannot move these events
        description: `Firm event: ${event.title}`,
        eventId: event.id,
        startTime: event.startTime,
        endTime: event.endTime,
        travelTimeBefore: event.travelTimeBefore,
        travelTimeAfter: event.travelTimeAfter
      }));
  }

  /**
   * Collect deadline constraints with urgency scoring
   */
  private collectDeadlineConstraints(tasks: Task[], validUntil: Date): DeadlineConstraint[] {
    return tasks
      .filter(task => task.deadline && task.status !== 'completed')
      .map(task => {
        const deadline = task.deadline!;
        const timeUntilDeadline = deadline.getTime() - Date.now();
        const urgencyScore = this.calculateUrgencyScore(timeUntilDeadline, task.isHardDeadline);

        return {
          id: EncryptionService.generateUUID(),
          type: 'deadline' as const,
          priority: task.isHardDeadline ? 100 : 70, // Hard deadlines have max priority
          description: `${task.isHardDeadline ? 'Hard' : 'Soft'} deadline for "${task.title}": ${deadline.toISOString()}`,
          taskId: task.id,
          deadline,
          isHard: task.isHardDeadline,
          urgencyScore
        };
      });
  }

  /**
   * Collect task priority constraints with weighted scoring
   */
  private collectTaskPriorityConstraints(tasks: Task[]): TaskPriorityConstraint[] {
    return tasks
      .filter(task => task.status !== 'completed')
      .map(task => {
        const priorityScore = this.calculatePriorityScore(task.priority);

        return {
          id: EncryptionService.generateUUID(),
          type: 'task_priority' as const,
          priority: priorityScore,
          description: `Task priority for "${task.title}": ${task.priority}`,
          taskId: task.id,
          taskPriority: task.priority,
          priorityScore
        };
      });
  }

  /**
   * Collect buffer time constraints around meetings
   */
  private collectBufferTimeConstraints(
    user: User, 
    calendarEvents: CalendarEvent[]
  ): BufferTimeConstraint[] {
    const constraints: BufferTimeConstraint[] = [];
    const defaultBuffer = user.preferences.defaultMeetingBuffer;

    calendarEvents.forEach(event => {
      // Buffer before meeting
      if (defaultBuffer > 0) {
        const bufferStart = new Date(event.startTime.getTime() - defaultBuffer * 60000);
        constraints.push({
          id: EncryptionService.generateUUID(),
          type: 'buffer_time',
          priority: 60,
          description: `Buffer time before "${event.title}"`,
          beforeEventId: event.id,
          duration: defaultBuffer,
          startTime: bufferStart,
          endTime: event.startTime
        });

        // Buffer after meeting
        const bufferEnd = new Date(event.endTime.getTime() + defaultBuffer * 60000);
        constraints.push({
          id: EncryptionService.generateUUID(),
          type: 'buffer_time',
          priority: 60,
          description: `Buffer time after "${event.title}"`,
          afterEventId: event.id,
          duration: defaultBuffer,
          startTime: event.endTime,
          endTime: bufferEnd
        });
      }
    });

    return constraints;
  }

  /**
   * Collect travel time constraints
   */
  private collectTravelTimeConstraints(calendarEvents: CalendarEvent[]): TravelTimeConstraint[] {
    const constraints: TravelTimeConstraint[] = [];

    calendarEvents.forEach(event => {
      // Travel time before event
      if (event.travelTimeBefore && event.travelTimeBefore > 0) {
        const travelStart = new Date(event.startTime.getTime() - event.travelTimeBefore * 60000);
        constraints.push({
          id: EncryptionService.generateUUID(),
          type: 'travel_time',
          priority: 85,
          description: `Travel time before "${event.title}"`,
          toEventId: event.id,
          duration: event.travelTimeBefore,
          startTime: travelStart,
          endTime: event.startTime
        });
      }

      // Travel time after event
      if (event.travelTimeAfter && event.travelTimeAfter > 0) {
        const travelEnd = new Date(event.endTime.getTime() + event.travelTimeAfter * 60000);
        constraints.push({
          id: EncryptionService.generateUUID(),
          type: 'travel_time',
          priority: 85,
          description: `Travel time after "${event.title}"`,
          fromEventId: event.id,
          duration: event.travelTimeAfter,
          startTime: event.endTime,
          endTime: travelEnd
        });
      }
    });

    return constraints;
  }

  /**
   * Collect energy preference constraints
   */
  private collectEnergyPreferenceConstraints(
    user: User, 
    tasks: Task[]
  ): EnergyPreferenceConstraint[] {
    const constraints: EnergyPreferenceConstraint[] = [];
    const energyPrefs = user.preferences.energyPreferences;

    tasks
      .filter(task => task.status !== 'completed')
      .forEach(task => {
        let preferredTimeRanges: TimeRange[] = [];
        let energyLevel: 'high' | 'low' | 'meeting' = 'low';

        // Map task priority to energy requirements
        if (task.priority === 'critical' || task.priority === 'high') {
          preferredTimeRanges = energyPrefs.highEnergyTimes;
          energyLevel = 'high';
        } else if (task.priority === 'low') {
          preferredTimeRanges = energyPrefs.lowEnergyTimes;
          energyLevel = 'low';
        } else {
          // Medium priority can use either high or low energy times
          preferredTimeRanges = [...energyPrefs.highEnergyTimes, ...energyPrefs.lowEnergyTimes];
          energyLevel = 'low';
        }

        if (preferredTimeRanges.length > 0) {
          constraints.push({
            id: EncryptionService.generateUUID(),
            type: 'energy_preference',
            priority: 40, // Medium priority - preference, not requirement
            description: `Energy preference for "${task.title}": ${energyLevel} energy`,
            taskId: task.id,
            taskPriority: task.priority,
            preferredTimeRanges,
            energyLevel
          });
        }
      });

    return constraints;
  }

  /**
   * Collect task dependency constraints
   */
  private collectDependencyConstraints(tasks: Task[]): DependencyConstraint[] {
    const constraints: DependencyConstraint[] = [];

    tasks
      .filter(task => task.dependencies.length > 0 && task.status !== 'completed')
      .forEach(task => {
        task.dependencies.forEach(prerequisiteId => {
          constraints.push({
            id: EncryptionService.generateUUID(),
            type: 'dependency',
            priority: 90, // High priority - dependencies must be respected
            description: `Task "${task.title}" depends on prerequisite task`,
            dependentTaskId: task.id,
            prerequisiteTaskId: prerequisiteId,
            mustCompleteFirst: true
          });
        });
      });

    return constraints;
  }

  /**
   * Collect maximum continuous work time constraints
   */
  private collectMaxContinuousWorkConstraints(user: User): MaxContinuousWorkConstraint[] {
    const maxWorkTime = user.preferences.maxContinuousWorkTime;
    const breakDuration = user.preferences.preferredBreakDuration;

    if (maxWorkTime > 0) {
      return [{
        id: EncryptionService.generateUUID(),
        type: 'max_continuous_work',
        priority: 50, // Medium priority - work-life balance preference
        description: `Maximum continuous work time: ${maxWorkTime} minutes, break: ${breakDuration} minutes`,
        maxDuration: maxWorkTime,
        breakDuration
      }];
    }

    return [];
  }

  /**
   * Calculate urgency score based on time until deadline
   */
  private calculateUrgencyScore(timeUntilDeadline: number, isHardDeadline: boolean): number {
    const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60);
    
    // Base urgency calculation
    let urgencyScore = 0;
    if (hoursUntilDeadline <= 24) {
      urgencyScore = 100; // Critical - less than 24 hours
    } else if (hoursUntilDeadline <= 72) {
      urgencyScore = 80; // High - less than 3 days
    } else if (hoursUntilDeadline <= 168) {
      urgencyScore = 60; // Medium - less than 1 week
    } else {
      urgencyScore = 40; // Low - more than 1 week
    }

    // Boost score for hard deadlines
    if (isHardDeadline) {
      urgencyScore = Math.min(100, urgencyScore + 20);
    }

    return urgencyScore;
  }

  /**
   * Calculate priority score for tasks
   */
  private calculatePriorityScore(priority: Priority): number {
    switch (priority) {
      case 'critical': return 80;
      case 'high': return 60;
      case 'medium': return 30;
      case 'low': return 10;
      default: return 10;
    }
  }

  /**
   * Get day name from day number
   */
  private getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek];
  }
}