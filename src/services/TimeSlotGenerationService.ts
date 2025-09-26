import { User } from '@/models/User';
import { Task } from '@/models/Task';
import { CalendarEvent } from '@/models/CalendarEvent';
import { SchedulingConstraint, ConstraintCollection } from '@/models/Constraint';
import { TimeRange, AvailableSlot } from '@/models/types';
import { ConstraintCollectionService } from './ConstraintCollectionService';

/**
 * Time slot generation engine for AI scheduling
 * Calculates available time slots considering all constraints and handles task chunking
 */
export class TimeSlotGenerationService {
  
  constructor(
    private constraintCollectionService: ConstraintCollectionService
  ) {}

  /**
   * Generate available time slots for a user within a date range
   */
  async generateAvailableSlots(
    userId: string,
    startDate: Date,
    endDate: Date,
    minSlotDuration: number = 15 // minimum slot duration in minutes
  ): Promise<AvailableSlot[]> {
    // Collect all constraints for the time period
    const constraints = await this.constraintCollectionService.collectConstraints(
      userId,
      startDate,
      endDate
    );

    // Generate time slots day by day
    const availableSlots: AvailableSlot[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const daySlots = this.generateDaySlots(currentDate, constraints, minSlotDuration);
      availableSlots.push(...daySlots);
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return availableSlots;
  }

  /**
   * Generate available slots for a specific day
   */
  private generateDaySlots(
    date: Date,
    constraints: ConstraintCollection,
    minSlotDuration: number
  ): AvailableSlot[] {
    const dayOfWeek = date.getDay();
    
    // Get working hours for this day
    const workingHoursConstraints = constraints.constraints.filter(
      c => c.type === 'working_hours' && 
      (c as any).dayOfWeek === dayOfWeek
    );

    if (workingHoursConstraints.length === 0) {
      return []; // No working hours defined for this day
    }

    const workingHours = (workingHoursConstraints[0] as any).timeRange;
    
    // Create initial time slots based on working hours
    const dayStart = this.createDateTime(date, workingHours.start);
    const dayEnd = this.createDateTime(date, workingHours.end);
    
    // Get all blocking constraints for this day
    const blockingConstraints = this.getBlockingConstraintsForDay(date, constraints);
    
    // Generate available slots by subtracting blocked time
    return this.subtractBlockedTime(dayStart, dayEnd, blockingConstraints, minSlotDuration);
  }

  /**
   * Get all constraints that block time for a specific day
   */
  private getBlockingConstraintsForDay(
    date: Date,
    constraints: ConstraintCollection
  ): Array<{ startTime: Date; endTime: Date; type: string }> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const blockingConstraints: Array<{ startTime: Date; endTime: Date; type: string }> = [];

    constraints.constraints.forEach(constraint => {
      switch (constraint.type) {
        case 'lunch_break':
          const lunchConstraint = constraint as any;
          const lunchStart = this.createDateTime(date, lunchConstraint.timeRange.start);
          const lunchEnd = this.createDateTime(date, lunchConstraint.timeRange.end);
          blockingConstraints.push({
            startTime: lunchStart,
            endTime: lunchEnd,
            type: 'lunch_break'
          });
          break;

        case 'firm_event':
          const eventConstraint = constraint as any;
          if (this.isDateInRange(eventConstraint.startTime, dayStart, dayEnd)) {
            blockingConstraints.push({
              startTime: eventConstraint.startTime,
              endTime: eventConstraint.endTime,
              type: 'firm_event'
            });
          }
          break;

        case 'buffer_time':
          const bufferConstraint = constraint as any;
          if (this.isDateInRange(bufferConstraint.startTime, dayStart, dayEnd)) {
            blockingConstraints.push({
              startTime: bufferConstraint.startTime,
              endTime: bufferConstraint.endTime,
              type: 'buffer_time'
            });
          }
          break;

        case 'travel_time':
          const travelConstraint = constraint as any;
          if (this.isDateInRange(travelConstraint.startTime, dayStart, dayEnd)) {
            blockingConstraints.push({
              startTime: travelConstraint.startTime,
              endTime: travelConstraint.endTime,
              type: 'travel_time'
            });
          }
          break;
      }
    });

    // Sort by start time
    blockingConstraints.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    return blockingConstraints;
  }

  /**
   * Subtract blocked time from available time to generate free slots
   */
  private subtractBlockedTime(
    dayStart: Date,
    dayEnd: Date,
    blockingConstraints: Array<{ startTime: Date; endTime: Date; type: string }>,
    minSlotDuration: number
  ): AvailableSlot[] {
    const availableSlots: AvailableSlot[] = [];
    let currentTime = new Date(dayStart);

    for (const constraint of blockingConstraints) {
      // If there's a gap before this constraint, add it as available time
      if (currentTime < constraint.startTime) {
        const slotDuration = constraint.startTime.getTime() - currentTime.getTime();
        const slotDurationMinutes = Math.floor(slotDuration / (1000 * 60));
        
        if (slotDurationMinutes >= minSlotDuration) {
          availableSlots.push({
            startTime: new Date(currentTime),
            endTime: new Date(constraint.startTime),
            duration: slotDurationMinutes
          });
        }
      }
      
      // Move current time to after this constraint
      currentTime = new Date(Math.max(currentTime.getTime(), constraint.endTime.getTime()));
    }

    // Add remaining time at end of day if available
    if (currentTime < dayEnd) {
      const slotDuration = dayEnd.getTime() - currentTime.getTime();
      const slotDurationMinutes = Math.floor(slotDuration / (1000 * 60));
      
      if (slotDurationMinutes >= minSlotDuration) {
        availableSlots.push({
          startTime: new Date(currentTime),
          endTime: new Date(dayEnd),
          duration: slotDurationMinutes
        });
      }
    }

    return availableSlots;
  }

  /**
   * Generate optimal time slots for a specific task
   */
  async generateTaskSlots(
    task: Task,
    user: User,
    availableSlots: AvailableSlot[],
    constraints: ConstraintCollection
  ): Promise<AvailableSlot[]> {
    const taskDuration = task.remainingMinutes || task.duration;
    
    if (task.isBlocking) {
      // Blocking tasks cannot be split - find slots that can fit the entire duration
      return this.findBlockingTaskSlots(taskDuration, availableSlots);
    } else {
      // Non-blocking tasks can be chunked
      return this.generateChunkedTaskSlots(
        taskDuration,
        availableSlots,
        user.preferences.maxContinuousWorkTime,
        user.preferences.preferredBreakDuration
      );
    }
  }

  /**
   * Find slots that can accommodate blocking tasks (cannot be split)
   */
  private findBlockingTaskSlots(
    taskDuration: number,
    availableSlots: AvailableSlot[]
  ): AvailableSlot[] {
    return availableSlots.filter(slot => slot.duration >= taskDuration);
  }

  /**
   * Generate chunked slots for non-blocking tasks
   */
  private generateChunkedTaskSlots(
    taskDuration: number,
    availableSlots: AvailableSlot[],
    maxContinuousWorkTime: number,
    preferredBreakDuration: number
  ): AvailableSlot[] {
    const chunkedSlots: AvailableSlot[] = [];
    let remainingDuration = taskDuration;

    for (const slot of availableSlots) {
      if (remainingDuration <= 0) break;

      // Determine chunk size for this slot
      const maxChunkSize = Math.min(
        slot.duration,
        maxContinuousWorkTime,
        remainingDuration
      );

      if (maxChunkSize >= 15) { // Minimum chunk size of 15 minutes
        // Create chunks within this slot
        const chunks = this.createChunksInSlot(
          slot,
          maxChunkSize,
          remainingDuration,
          preferredBreakDuration
        );
        
        chunkedSlots.push(...chunks);
        
        // Update remaining duration
        const totalChunkDuration = chunks.reduce((sum, chunk) => sum + chunk.duration, 0);
        remainingDuration -= totalChunkDuration;
      }
    }

    return chunkedSlots;
  }

  /**
   * Create task chunks within a single available slot
   */
  private createChunksInSlot(
    slot: AvailableSlot,
    maxChunkSize: number,
    remainingTaskDuration: number,
    preferredBreakDuration: number
  ): AvailableSlot[] {
    const chunks: AvailableSlot[] = [];
    let currentTime = new Date(slot.startTime);
    let remainingSlotTime = slot.duration;
    let remainingDuration = remainingTaskDuration;

    while (remainingSlotTime > 0 && remainingDuration > 0) {
      // Calculate chunk duration
      const chunkDuration = Math.min(
        maxChunkSize,
        remainingSlotTime,
        remainingDuration
      );

      if (chunkDuration < 15) break; // Don't create chunks smaller than 15 minutes

      // Create chunk
      const chunkEnd = new Date(currentTime.getTime() + chunkDuration * 60000);
      chunks.push({
        startTime: new Date(currentTime),
        endTime: chunkEnd,
        duration: chunkDuration
      });

      // Update counters
      remainingDuration -= chunkDuration;
      remainingSlotTime -= chunkDuration;
      currentTime = chunkEnd;

      // Add break time if there's more work to do and slot time remaining
      if (remainingDuration > 0 && remainingSlotTime >= preferredBreakDuration + 15) {
        currentTime = new Date(currentTime.getTime() + preferredBreakDuration * 60000);
        remainingSlotTime -= preferredBreakDuration;
      }
    }

    return chunks;
  }

  /**
   * Apply buffer time around slots
   */
  applyBufferTime(
    slots: AvailableSlot[],
    bufferBefore: number = 0,
    bufferAfter: number = 0
  ): AvailableSlot[] {
    return slots.map(slot => {
      const bufferedStart = new Date(slot.startTime.getTime() + bufferBefore * 60000);
      const bufferedEnd = new Date(slot.endTime.getTime() - bufferAfter * 60000);
      const bufferedDuration = Math.floor((bufferedEnd.getTime() - bufferedStart.getTime()) / (1000 * 60));

      // Only return slot if it still has meaningful duration after buffering
      if (bufferedDuration >= 15) {
        return {
          startTime: bufferedStart,
          endTime: bufferedEnd,
          duration: bufferedDuration
        };
      }
      return null;
    }).filter(slot => slot !== null) as AvailableSlot[];
  }

  /**
   * Filter slots based on energy preferences
   */
  filterSlotsByEnergyPreferences(
    slots: AvailableSlot[],
    task: Task,
    user: User
  ): AvailableSlot[] {
    const energyPrefs = user.preferences.energyPreferences;
    const isHighEnergyTask = task.priority === 'critical' || task.priority === 'high';
    const isLowEnergyTask = task.priority === 'low';

    return slots.filter(slot => {
      const slotTimeString = slot.startTime.toTimeString().substring(0, 5); // HH:MM format

      if (isHighEnergyTask) {
        // High energy tasks should be scheduled during high energy times
        return energyPrefs.highEnergyTimes.some(range =>
          slotTimeString >= range.start && slotTimeString <= range.end
        );
      } else if (isLowEnergyTask) {
        // Low energy tasks can be scheduled during low energy times
        return energyPrefs.lowEnergyTimes.some(range =>
          slotTimeString >= range.start && slotTimeString <= range.end
        );
      } else {
        // Medium priority tasks can use any time
        return true;
      }
    });
  }

  /**
   * Optimize slot selection for task scheduling
   */
  optimizeSlotSelection(
    slots: AvailableSlot[],
    task: Task,
    user: User,
    previousTask?: Task
  ): AvailableSlot[] {
    let optimizedSlots = [...slots];

    // Apply energy-based filtering if enabled
    const energyFilteredSlots = this.filterSlotsByEnergyPreferences(optimizedSlots, task, user);
    if (energyFilteredSlots.length > 0) {
      optimizedSlots = energyFilteredSlots;
    }

    // Sort slots by preference
    optimizedSlots.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Prefer earlier slots for high priority tasks
      if (task.priority === 'critical' || task.priority === 'high') {
        scoreA += (24 * 60 - this.getMinutesFromMidnight(a.startTime)) / 100;
        scoreB += (24 * 60 - this.getMinutesFromMidnight(b.startTime)) / 100;
      }

      // Prefer longer slots for better focus
      scoreA += a.duration / 10;
      scoreB += b.duration / 10;

      // Prefer slots that minimize context switching
      if (previousTask && user.preferences.groupSimilarTasks) {
        // This would need more context about previous task scheduling
        // For now, just prefer slots closer in time to previous task
      }

      return scoreB - scoreA; // Higher score first
    });

    return optimizedSlots;
  }

  /**
   * Calculate total available time within a date range
   */
  async calculateTotalAvailableTime(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalMinutes: number;
    availableSlots: AvailableSlot[];
    utilizationByDay: Array<{
      date: Date;
      availableMinutes: number;
      workingHoursMinutes: number;
      utilization: number;
    }>;
  }> {
    const availableSlots = await this.generateAvailableSlots(userId, startDate, endDate);
    const totalMinutes = availableSlots.reduce((sum, slot) => sum + slot.duration, 0);

    // Calculate utilization by day
    const utilizationByDay: Array<{
      date: Date;
      availableMinutes: number;
      workingHoursMinutes: number;
      utilization: number;
    }> = [];

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const daySlots = availableSlots.filter(slot => 
        this.isSameDay(slot.startTime, currentDate)
      );
      
      const availableMinutes = daySlots.reduce((sum, slot) => sum + slot.duration, 0);
      const workingHoursMinutes = this.calculateWorkingHoursForDay(currentDate, userId);
      const utilization = workingHoursMinutes > 0 ? availableMinutes / workingHoursMinutes : 0;

      utilizationByDay.push({
        date: new Date(currentDate),
        availableMinutes,
        workingHoursMinutes,
        utilization
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      totalMinutes,
      availableSlots,
      utilizationByDay
    };
  }

  /**
   * Helper method to create a DateTime from a date and time string
   */
  private createDateTime(date: Date, timeString: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const dateTime = new Date(date);
    dateTime.setHours(hours, minutes, 0, 0);
    return dateTime;
  }

  /**
   * Helper method to check if a date is within a range
   */
  private isDateInRange(date: Date, rangeStart: Date, rangeEnd: Date): boolean {
    return date >= rangeStart && date <= rangeEnd;
  }

  /**
   * Helper method to check if two dates are on the same day
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  /**
   * Helper method to get minutes from midnight
   */
  private getMinutesFromMidnight(date: Date): number {
    return date.getHours() * 60 + date.getMinutes();
  }

  /**
   * Helper method to calculate working hours for a specific day
   * This is a placeholder - would need access to user data
   */
  private calculateWorkingHoursForDay(date: Date, userId: string): number {
    // This would typically fetch user working hours and calculate total minutes
    // For now, return a default 8-hour workday
    return 8 * 60; // 480 minutes
  }
}