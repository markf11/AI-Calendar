// @ts-nocheck
import { Task } from '@/models/Task';
import { CalendarEvent } from '@/models/CalendarEvent';
import { User } from '@/models/User';
import { ScheduledSlot, ValidationResult, ConflictReport, SchedulingConflict } from '@/models/types';
import { ConstraintCollection, ConstraintViolation } from '@/models/Constraint';
import { ConstraintCollectionService } from './ConstraintCollectionService';

/**
 * Service for validating schedules and detecting conflicts
 * Ensures all constraints are satisfied and provides conflict resolution recommendations
 */
export class ScheduleValidationService {
  
  constructor(
    private constraintCollectionService: ConstraintCollectionService
  ) {}

  /**
   * Validate a complete schedule for a user
   */
  async validateSchedule(
    user: User,
    tasks: Task[],
    calendarEvents: CalendarEvent[]
  ): Promise<ValidationResult> {
    const violations: string[] = [];
    const suggestions: string[] = [];

    try {
      // Collect all constraints
      const constraints = await this.constraintCollectionService.collectConstraints(
        user,
        calendarEvents,
        tasks
      );

      // Get all scheduled slots from tasks
      const scheduledSlots = this.extractScheduledSlots(tasks);

      // Validate working hours constraints
      const workingHoursViolations = this.validateWorkingHours(scheduledSlots, user);
      violations.push(...workingHoursViolations);

      // Validate firm event conflicts
      const firmEventViolations = this.validateFirmEventConflicts(scheduledSlots, calendarEvents);
      violations.push(...firmEventViolations);

      // Validate task dependencies
      const dependencyViolations = this.validateTaskDependencies(tasks);
      violations.push(...dependencyViolations);

      // Validate deadline constraints
      const deadlineViolations = this.validateDeadlineConstraints(tasks);
      violations.push(...deadlineViolations);

      // Validate time conflicts between tasks
      const timeConflictViolations = this.validateTimeConflicts(scheduledSlots);
      violations.push(...timeConflictViolations);

      // Validate task completeness
      const completenessViolations = this.validateTaskCompleteness(tasks);
      violations.push(...completenessViolations);

      // Generate suggestions based on violations
      if (violations.length > 0) {
        suggestions.push(...this.generateSuggestions(violations, tasks, user));
      }

      return {
        isValid: violations.length === 0,
        violations,
        suggestions
      };

    } catch (error) {
      return {
        isValid: false,
        violations: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        suggestions: ['Please check your schedule configuration and try again.']
      };
    }
  }

  /**
   * Detect scheduling conflicts and provide detailed analysis
   */
  async detectConflicts(
    user: User,
    tasks: Task[],
    calendarEvents: CalendarEvent[]
  ): Promise<ConflictReport> {
    const conflicts: SchedulingConflict[] = [];
    const recommendations: string[] = [];

    try {
      // Detect time overlap conflicts
      const timeOverlapConflicts = this.detectTimeOverlapConflicts(tasks, calendarEvents);
      conflicts.push(...timeOverlapConflicts);

      // Detect impossible deadline scenarios
      const deadlineConflicts = this.detectDeadlineConflicts(tasks, user);
      conflicts.push(...deadlineConflicts);

      // Detect dependency cycles
      const dependencyCycles = this.detectDependencyCycles(tasks);
      conflicts.push(...dependencyCycles);

      // Detect overallocation conflicts
      const overallocationConflicts = this.detectOverallocationConflicts(tasks, user);
      conflicts.push(...overallocationConflicts);

      // Generate recommendations based on conflicts
      if (conflicts.length > 0) {
        recommendations.push(...this.generateConflictRecommendations(conflicts, tasks, user));
      }

      return {
        hasConflicts: conflicts.length > 0,
        conflicts,
        recommendations
      };

    } catch (error) {
      return {
        hasConflicts: true,
        conflicts: [{
          type: 'time_overlap',
          description: `Conflict detection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          affectedTasks: [],
          suggestedResolution: 'Please review your schedule and try again.'
        }],
        recommendations: ['Check your schedule configuration and contact support if the issue persists.']
      };
    }
  }

  /**
   * Validate that all scheduled tasks respect working hours
   */
  private validateWorkingHours(scheduledSlots: ScheduledSlot[], user: User): string[] {
    const violations: string[] = [];

    for (const slot of scheduledSlots) {
      const dayOfWeek = slot.startTime.getDay();
      const dayName = this.getDayName(dayOfWeek);
      
      const workingHours = this.getWorkingHoursForDay(user, dayOfWeek);
      
      if (!workingHours) {
        violations.push(`Task scheduled on ${dayName} but no working hours defined for this day`);
        continue;
      }

      const slotStart = this.getTimeString(slot.startTime);
      const slotEnd = this.getTimeString(slot.endTime);

      if (slotStart < workingHours.start || slotEnd > workingHours.end) {
        violations.push(
          `Task scheduled outside working hours on ${dayName} (${slotStart}-${slotEnd}, working hours: ${workingHours.start}-${workingHours.end})`
        );
      }

      // Check lunch break conflicts
      if (user.workingHours.lunchBreak) {
        const lunchStart = user.workingHours.lunchBreak.start;
        const lunchEnd = user.workingHours.lunchBreak.end;
        
        if (this.hasTimeOverlap(slotStart, slotEnd, lunchStart, lunchEnd)) {
          violations.push(`Task scheduled during lunch break (${lunchStart}-${lunchEnd})`);
        }
      }
    }

    return violations;
  }

  /**
   * Validate that scheduled tasks don't conflict with firm calendar events
   */
  private validateFirmEventConflicts(scheduledSlots: ScheduledSlot[], calendarEvents: CalendarEvent[]): string[] {
    const violations: string[] = [];
    const firmEvents = calendarEvents.filter(event => !event.isFlexible);

    for (const slot of scheduledSlots) {
      for (const event of firmEvents) {
        if (this.hasTimeOverlap(
          slot.startTime,
          slot.endTime,
          event.startTime,
          event.endTime
        )) {
          violations.push(
            `Task conflicts with firm calendar event "${event.title}" (${this.formatDateTime(event.startTime)} - ${this.formatDateTime(event.endTime)})`
          );
        }
      }
    }

    return violations;
  }

  /**
   * Validate task dependencies are properly ordered
   */
  private validateTaskDependencies(tasks: Task[]): string[] {
    const violations: string[] = [];
    const taskMap = new Map(tasks.map(task => [task.id, task]));

    for (const task of tasks) {
      if (task.status === 'completed') continue;

      for (const dependencyId of task.dependencies) {
        const dependencyTask = taskMap.get(dependencyId);
        
        if (!dependencyTask) {
          violations.push(`Task "${task.title}" depends on non-existent task ${dependencyId}`);
          continue;
        }

        if (dependencyTask.status !== 'completed') {
          // Check if dependency is scheduled before this task
          const taskSlots = task.scheduledSlots;
          const dependencySlots = dependencyTask.scheduledSlots;

          if (taskSlots.length > 0 && dependencySlots.length > 0) {
            const taskEarliestStart = Math.min(...taskSlots.map(slot => slot.startTime.getTime()));
            const dependencyLatestEnd = Math.max(...dependencySlots.map(slot => slot.endTime.getTime()));

            if (taskEarliestStart <= dependencyLatestEnd) {
              violations.push(
                `Task "${task.title}" is scheduled before its dependency "${dependencyTask.title}" is completed`
              );
            }
          } else if (taskSlots.length > 0 && dependencySlots.length === 0) {
            violations.push(
              `Task "${task.title}" is scheduled but its dependency "${dependencyTask.title}" is not scheduled`
            );
          }
        }
      }
    }

    return violations;
  }

  /**
   * Validate deadline constraints
   */
  private validateDeadlineConstraints(tasks: Task[]): string[] {
    const violations: string[] = [];

    for (const task of tasks) {
      if (!task.deadline || task.status === 'completed') continue;

      const latestScheduledEnd = task.scheduledSlots.length > 0
        ? Math.max(...task.scheduledSlots.map(slot => slot.endTime.getTime()))
        : null;

      if (latestScheduledEnd && latestScheduledEnd > task.deadline.getTime()) {
        const deadlineType = task.isHardDeadline ? 'hard' : 'soft';
        violations.push(
          `Task "${task.title}" is scheduled to complete after its ${deadlineType} deadline (${this.formatDateTime(task.deadline)})`
        );
      }

      // Check if task can realistically be completed by deadline
      if (task.status === 'pending' && task.scheduledSlots.length === 0) {
        const timeUntilDeadline = task.deadline.getTime() - Date.now();
        const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60);
        const taskHours = task.remainingMinutes / 60;

        if (taskHours > hoursUntilDeadline) {
          violations.push(
            `Task "${task.title}" requires ${taskHours.toFixed(1)} hours but only ${hoursUntilDeadline.toFixed(1)} hours remain until deadline`
          );
        }
      }
    }

    return violations;
  }

  /**
   * Validate that no two tasks are scheduled at the same time
   */
  private validateTimeConflicts(scheduledSlots: ScheduledSlot[]): string[] {
    const violations: string[] = [];

    for (let i = 0; i < scheduledSlots.length; i++) {
      for (let j = i + 1; j < scheduledSlots.length; j++) {
        const slot1 = scheduledSlots[i];
        const slot2 = scheduledSlots[j];

        if (this.hasTimeOverlap(slot1.startTime, slot1.endTime, slot2.startTime, slot2.endTime)) {
          violations.push(
            `Time conflict between tasks: ${this.formatDateTime(slot1.startTime)}-${this.formatDateTime(slot1.endTime)} and ${this.formatDateTime(slot2.startTime)}-${this.formatDateTime(slot2.endTime)}`
          );
        }
      }
    }

    return violations;
  }

  /**
   * Validate that all tasks have appropriate scheduling
   */
  private validateTaskCompleteness(tasks: Task[]): string[] {
    const violations: string[] = [];
    const pendingTasks = tasks.filter(task => 
      task.status === 'pending' && 
      task.scheduledSlots.length === 0 &&
      task.dependencies.every(depId => {
        const depTask = tasks.find(t => t.id === depId);
        return depTask?.status === 'completed';
      })
    );

    if (pendingTasks.length > 0) {
      violations.push(
        `${pendingTasks.length} tasks are ready to be scheduled but have no time slots assigned: ${pendingTasks.map(t => `"${t.title}"`).join(', ')}`
      );
    }

    return violations;
  }

  /**
   * Detect time overlap conflicts between tasks and calendar events
   */
  private detectTimeOverlapConflicts(tasks: Task[], calendarEvents: CalendarEvent[]): SchedulingConflict[] {
    const conflicts: SchedulingConflict[] = [];
    const scheduledSlots = this.extractScheduledSlots(tasks);
    const firmEvents = calendarEvents.filter(event => !event.isFlexible);

    // Task vs Calendar Event conflicts
    for (const slot of scheduledSlots) {
      for (const event of firmEvents) {
        if (this.hasTimeOverlap(slot.startTime, slot.endTime, event.startTime, event.endTime)) {
          const affectedTask = tasks.find(task => task.scheduledSlots.some(s => s.id === slot.id));
          
          conflicts.push({
            type: 'time_overlap',
            description: `Task "${affectedTask?.title || 'Unknown'}" conflicts with calendar event "${event.title}"`,
            affectedTasks: affectedTask ? [affectedTask.id] : [],
            suggestedResolution: `Reschedule the task to avoid conflict with the firm calendar event`
          });
        }
      }
    }

    // Task vs Task conflicts
    for (let i = 0; i < scheduledSlots.length; i++) {
      for (let j = i + 1; j < scheduledSlots.length; j++) {
        const slot1 = scheduledSlots[i];
        const slot2 = scheduledSlots[j];

        if (this.hasTimeOverlap(slot1.startTime, slot1.endTime, slot2.startTime, slot2.endTime)) {
          const task1 = tasks.find(task => task.scheduledSlots.some(s => s.id === slot1.id));
          const task2 = tasks.find(task => task.scheduledSlots.some(s => s.id === slot2.id));

          conflicts.push({
            type: 'time_overlap',
            description: `Tasks "${task1?.title || 'Unknown'}" and "${task2?.title || 'Unknown'}" have overlapping time slots`,
            affectedTasks: [task1?.id, task2?.id].filter(Boolean) as string[],
            suggestedResolution: 'Reschedule one of the conflicting tasks to a different time slot'
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect impossible deadline scenarios
   */
  private detectDeadlineConflicts(tasks: Task[], user: User): SchedulingConflict[] {
    const conflicts: SchedulingConflict[] = [];
    const now = new Date();

    for (const task of tasks) {
      if (!task.deadline || task.status === 'completed') continue;

      const timeUntilDeadline = task.deadline.getTime() - now.getTime();
      const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60);
      const taskHours = task.remainingMinutes / 60;

      // Calculate available working hours until deadline
      const availableWorkingHours = this.calculateAvailableWorkingHours(now, task.deadline, user);

      if (taskHours > availableWorkingHours) {
        conflicts.push({
          type: 'deadline_impossible',
          description: `Task "${task.title}" requires ${taskHours.toFixed(1)} hours but only ${availableWorkingHours.toFixed(1)} working hours available until deadline`,
          affectedTasks: [task.id],
          suggestedResolution: task.isHardDeadline 
            ? 'Extend the deadline or reduce the task duration'
            : 'Consider extending the deadline or breaking the task into smaller parts'
        });
      }

      // Check for very tight deadlines (less than 24 hours)
      if (hoursUntilDeadline < 24 && taskHours > hoursUntilDeadline * 0.8) {
        conflicts.push({
          type: 'deadline_impossible',
          description: `Task "${task.title}" has a very tight deadline with insufficient buffer time`,
          affectedTasks: [task.id],
          suggestedResolution: 'Consider prioritizing this task or extending the deadline'
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect circular dependencies
   */
  private detectDependencyCycles(tasks: Task[]): SchedulingConflict[] {
    const conflicts: SchedulingConflict[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const taskMap = new Map(tasks.map(task => [task.id, task]));

    const hasCycle = (taskId: string, path: string[]): boolean => {
      if (recursionStack.has(taskId)) {
        // Found a cycle
        const cycleStart = path.indexOf(taskId);
        const cycleTasks = path.slice(cycleStart);
        const cycleTaskNames = cycleTasks.map(id => taskMap.get(id)?.title || id);
        
        conflicts.push({
          type: 'dependency_cycle',
          description: `Circular dependency detected: ${cycleTaskNames.join(' → ')} → ${taskMap.get(taskId)?.title || taskId}`,
          affectedTasks: cycleTasks,
          suggestedResolution: 'Remove one of the dependencies to break the cycle'
        });
        
        return true;
      }

      if (visited.has(taskId)) {
        return false;
      }

      visited.add(taskId);
      recursionStack.add(taskId);

      const task = taskMap.get(taskId);
      if (task) {
        for (const dependencyId of task.dependencies) {
          if (hasCycle(dependencyId, [...path, taskId])) {
            return true;
          }
        }
      }

      recursionStack.delete(taskId);
      return false;
    };

    for (const task of tasks) {
      if (!visited.has(task.id)) {
        hasCycle(task.id, []);
      }
    }

    return conflicts;
  }

  /**
   * Detect overallocation conflicts (too many tasks for available time)
   */
  private detectOverallocationConflicts(tasks: Task[], user: User): SchedulingConflict[] {
    const conflicts: SchedulingConflict[] = [];
    const pendingTasks = tasks.filter(task => task.status !== 'completed');
    
    if (pendingTasks.length === 0) return conflicts;

    // Calculate total remaining work
    const totalRemainingMinutes = pendingTasks.reduce((sum, task) => sum + task.remainingMinutes, 0);
    const totalRemainingHours = totalRemainingMinutes / 60;

    // Calculate available working hours for the next 30 days
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const availableHours = this.calculateAvailableWorkingHours(now, thirtyDaysFromNow, user);

    if (totalRemainingHours > availableHours * 0.9) { // 90% threshold
      const overallocation = totalRemainingHours - availableHours;
      
      conflicts.push({
        type: 'time_overlap', // Using time_overlap as closest match
        description: `Schedule overallocated: ${totalRemainingHours.toFixed(1)} hours of work but only ${availableHours.toFixed(1)} hours available in next 30 days`,
        affectedTasks: pendingTasks.map(task => task.id),
        suggestedResolution: `Consider reducing task scope, extending deadlines, or increasing working hours by ${overallocation.toFixed(1)} hours`
      });
    }

    return conflicts;
  }

  /**
   * Generate suggestions based on validation violations
   */
  private generateSuggestions(violations: string[], tasks: Task[], user: User): string[] {
    const suggestions: string[] = [];

    if (violations.some(v => v.includes('working hours'))) {
      suggestions.push('Review and adjust your working hours settings to accommodate scheduled tasks');
    }

    if (violations.some(v => v.includes('firm calendar event'))) {
      suggestions.push('Consider rescheduling flexible tasks to avoid conflicts with firm calendar events');
    }

    if (violations.some(v => v.includes('dependency'))) {
      suggestions.push('Review task dependencies and ensure prerequisite tasks are completed or scheduled first');
    }

    if (violations.some(v => v.includes('deadline'))) {
      suggestions.push('Consider extending deadlines or breaking large tasks into smaller, more manageable parts');
    }

    if (violations.some(v => v.includes('Time conflict'))) {
      suggestions.push('Run automatic rescheduling to resolve time conflicts between tasks');
    }

    if (violations.some(v => v.includes('ready to be scheduled'))) {
      suggestions.push('Run automatic scheduling to assign time slots to pending tasks');
    }

    return suggestions;
  }

  /**
   * Generate recommendations based on detected conflicts
   */
  private generateConflictRecommendations(conflicts: SchedulingConflict[], tasks: Task[], user: User): string[] {
    const recommendations: string[] = [];

    const hasTimeOverlap = conflicts.some(c => c.type === 'time_overlap');
    const hasDeadlineIssues = conflicts.some(c => c.type === 'deadline_impossible');
    const hasDependencyCycles = conflicts.some(c => c.type === 'dependency_cycle');

    if (hasTimeOverlap) {
      recommendations.push('Run automatic rescheduling to resolve time conflicts');
      recommendations.push('Consider adjusting working hours or task durations to create more availability');
    }

    if (hasDeadlineIssues) {
      recommendations.push('Review task deadlines and consider extending those that are unrealistic');
      recommendations.push('Break large tasks into smaller parts to improve scheduling flexibility');
      recommendations.push('Consider increasing daily working hours temporarily for urgent deadlines');
    }

    if (hasDependencyCycles) {
      recommendations.push('Review task dependencies and remove unnecessary connections');
      recommendations.push('Consider parallel execution of some dependent tasks where possible');
    }

    if (conflicts.length > 5) {
      recommendations.push('Consider reducing the number of active tasks or extending project timelines');
    }

    return recommendations;
  }

  /**
   * Helper methods
   */
  private extractScheduledSlots(tasks: Task[]): ScheduledSlot[] {
    return tasks.flatMap(task => task.scheduledSlots);
  }

  private getWorkingHoursForDay(user: User, dayOfWeek: number): { start: string; end: string } | null {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const dayName = dayNames[dayOfWeek];
    return user.workingHours[dayName] || null;
  }

  private getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek];
  }

  private getTimeString(date: Date): string {
    return date.toTimeString().slice(0, 5); // HH:mm format
  }

  private hasTimeOverlap(start1: Date | string, end1: Date | string, start2: Date | string, end2: Date | string): boolean {
    const s1 = typeof start1 === 'string' ? start1 : this.getTimeString(start1);
    const e1 = typeof end1 === 'string' ? end1 : this.getTimeString(end1);
    const s2 = typeof start2 === 'string' ? start2 : this.getTimeString(start2);
    const e2 = typeof end2 === 'string' ? end2 : this.getTimeString(end2);

    return s1 < e2 && s2 < e1;
  }

  private formatDateTime(date: Date): string {
    return date.toLocaleString();
  }

  private calculateAvailableWorkingHours(startDate: Date, endDate: Date, user: User): number {
    let totalHours = 0;
    const currentDate = new Date(startDate);

    while (currentDate < endDate) {
      const dayOfWeek = currentDate.getDay();
      const workingHours = this.getWorkingHoursForDay(user, dayOfWeek);

      if (workingHours) {
        const [startHour, startMinute] = workingHours.start.split(':').map(Number);
        const [endHour, endMinute] = workingHours.end.split(':').map(Number);
        
        const dayHours = (endHour + endMinute / 60) - (startHour + startMinute / 60);
        
        // Subtract lunch break if defined
        if (user.workingHours.lunchBreak) {
          const [lunchStartHour, lunchStartMinute] = user.workingHours.lunchBreak.start.split(':').map(Number);
          const [lunchEndHour, lunchEndMinute] = user.workingHours.lunchBreak.end.split(':').map(Number);
          const lunchHours = (lunchEndHour + lunchEndMinute / 60) - (lunchStartHour + lunchStartMinute / 60);
          totalHours += Math.max(0, dayHours - lunchHours);
        } else {
          totalHours += dayHours;
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return totalHours;
  }
}