import { AvailableSlot, DateRange, TimeRange, AvailabilityWindow } from '@/models/types';
import { BookingLink } from '@/models/BookingLink';
import { CalendarEvent } from '@/models/CalendarEvent';
import { Task } from '@/models/Task';
import { User } from '@/models/User';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import { TaskRepository } from '@/repositories/TaskRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { ScheduledSlot } from '@/models/types';
import { addDays, addMinutes, format, isAfter, isBefore, isWithinInterval, parseISO, startOfDay } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

export interface AvailabilityOptions {
  includeBufferTime?: boolean;
  optimizeForSchedule?: boolean;
  preferredTimeSlots?: TimeRange[];
  minimumSlotDuration?: number;
}

export interface OptimizedSlot extends AvailableSlot {
  isPreferred: boolean;
  conflictScore: number; // Lower is better
  energyLevel: 'high' | 'medium' | 'low';
  recommendation: string;
}

export class AvailabilityCalculationService {
  constructor(
    private calendarEventRepository: CalendarEventRepository,
    private taskRepository: TaskRepository,
    private userRepository: UserRepository
  ) {}

  /**
   * Calculate real-time availability for a booking link
   */
  async calculateAvailability(
    bookingLink: BookingLink,
    dateRange: DateRange,
    options: AvailabilityOptions = {}
  ): Promise<AvailableSlot[]> {
    // Get user information for timezone and preferences
    const user = await this.userRepository.findById(bookingLink.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get all calendar events in the date range
    const calendarEvents = await this.calendarEventRepository.findByUserIdAndDateRange(
      bookingLink.userId,
      dateRange.start,
      dateRange.end
    );

    // Get all scheduled tasks in the date range
    const scheduledTasks = await this.taskRepository.findScheduledByUserIdAndDateRange(
      bookingLink.userId,
      dateRange.start,
      dateRange.end
    );

    // Calculate available slots
    const availableSlots = this.calculateAvailableSlots(
      bookingLink,
      user,
      calendarEvents,
      scheduledTasks,
      dateRange,
      options
    );

    return availableSlots;
  }

  /**
   * Get intelligent time slot suggestions that optimize user's schedule
   */
  async getOptimizedAvailability(
    bookingLink: BookingLink,
    dateRange: DateRange,
    options: AvailabilityOptions = {}
  ): Promise<OptimizedSlot[]> {
    const user = await this.userRepository.findById(bookingLink.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const availableSlots = await this.calculateAvailability(bookingLink, dateRange, options);

    // Convert to optimized slots with additional metadata
    const optimizedSlots = availableSlots.map(slot => 
      this.optimizeSlot(slot, bookingLink, user)
    );

    // Sort by optimization score (best first)
    return optimizedSlots.sort((a, b) => {
      // Preferred slots first
      if (a.isPreferred && !b.isPreferred) return -1;
      if (!a.isPreferred && b.isPreferred) return 1;
      
      // Then by conflict score (lower is better)
      return a.conflictScore - b.conflictScore;
    });
  }

  /**
   * Check if a specific time slot is available
   */
  async isTimeSlotAvailable(
    bookingLink: BookingLink,
    startTime: Date,
    options: AvailabilityOptions = {}
  ): Promise<boolean> {
    const endTime = addMinutes(startTime, bookingLink.duration);
    const dateRange: DateRange = {
      start: startTime,
      end: endTime
    };

    const availableSlots = await this.calculateAvailability(bookingLink, dateRange, options);
    
    return availableSlots.some(slot => 
      slot.startTime <= startTime && slot.endTime >= endTime
    );
  }

  /**
   * Get next available slot after a given time
   */
  async getNextAvailableSlot(
    bookingLink: BookingLink,
    afterTime: Date,
    options: AvailabilityOptions = {}
  ): Promise<AvailableSlot | null> {
    const endDate = addDays(afterTime, bookingLink.availabilityWindow.advanceBookingDays);
    const dateRange: DateRange = {
      start: afterTime,
      end: endDate
    };

    const availableSlots = await this.calculateAvailability(bookingLink, dateRange, options);
    
    return availableSlots.length > 0 ? availableSlots[0] : null;
  }

  /**
   * Calculate available time slots considering all constraints
   */
  private calculateAvailableSlots(
    bookingLink: BookingLink,
    user: User,
    calendarEvents: CalendarEvent[],
    scheduledTasks: Task[],
    dateRange: DateRange,
    options: AvailabilityOptions
  ): AvailableSlot[] {
    const availableSlots: AvailableSlot[] = [];
    const { availabilityWindow, duration, bufferBefore, bufferAfter } = bookingLink;
    
    // Calculate total duration needed including buffers
    const totalDuration = duration + (options.includeBufferTime !== false ? bufferBefore + bufferAfter : 0);
    const minimumDuration = options.minimumSlotDuration || duration;

    // Get all busy periods (calendar events + scheduled tasks)
    const busyPeriods = this.getBusyPeriods(calendarEvents, scheduledTasks, user.timezone);

    // Iterate through each day in the date range
    let currentDate = startOfDay(dateRange.start);
    const endDate = startOfDay(dateRange.end);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      
      // Check if this day is available according to availability window
      if (!availabilityWindow.daysOfWeek.includes(dayOfWeek)) {
        currentDate = addDays(currentDate, 1);
        continue;
      }

      // Get working hours for this day
      const daySlots = this.getDayAvailableSlots(
        currentDate,
        availabilityWindow.timeRange,
        user.timezone,
        busyPeriods,
        totalDuration,
        minimumDuration
      );

      availableSlots.push(...daySlots);
      currentDate = addDays(currentDate, 1);
    }

    // Filter slots that are within the requested date range
    return availableSlots.filter(slot => 
      slot.startTime >= dateRange.start && slot.endTime <= dateRange.end
    );
  }

  /**
   * Get all busy periods from calendar events and scheduled tasks
   */
  private getBusyPeriods(
    calendarEvents: CalendarEvent[],
    scheduledTasks: Task[],
    timezone: string
  ): Array<{ start: Date; end: Date; type: 'event' | 'task' }> {
    const busyPeriods: Array<{ start: Date; end: Date; type: 'event' | 'task' }> = [];

    // Add calendar events
    calendarEvents.forEach(event => {
      busyPeriods.push({
        start: event.startTime,
        end: event.endTime,
        type: 'event'
      });
    });

    // Add scheduled task slots
    scheduledTasks.forEach(task => {
      if (task.scheduledSlots) {
        task.scheduledSlots.forEach(slot => {
          busyPeriods.push({
            start: slot.startTime,
            end: slot.endTime,
            type: 'task'
          });
        });
      }
    });

    // Sort by start time
    return busyPeriods.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  /**
   * Calculate available slots for a specific day
   */
  private getDayAvailableSlots(
    date: Date,
    timeRange: TimeRange,
    timezone: string,
    busyPeriods: Array<{ start: Date; end: Date; type: 'event' | 'task' }>,
    requiredDuration: number,
    minimumDuration: number
  ): AvailableSlot[] {
    const availableSlots: AvailableSlot[] = [];

    // Convert time range to actual dates in user's timezone
    const dayStart = this.parseTimeInTimezone(date, timeRange.start, timezone);
    const dayEnd = this.parseTimeInTimezone(date, timeRange.end, timezone);

    // Get busy periods for this day
    const dayBusyPeriods = busyPeriods.filter(period => 
      this.isDateInSameDay(period.start, date) || this.isDateInSameDay(period.end, date)
    );

    // Find free slots between busy periods
    let currentTime = dayStart;

    for (const busyPeriod of dayBusyPeriods) {
      // If there's a gap before this busy period
      if (currentTime < busyPeriod.start) {
        const gapDuration = (busyPeriod.start.getTime() - currentTime.getTime()) / (1000 * 60);
        
        if (gapDuration >= minimumDuration) {
          // Create slots within this gap
          const gapSlots = this.createSlotsInTimeRange(
            currentTime,
            busyPeriod.start,
            requiredDuration,
            minimumDuration
          );
          availableSlots.push(...gapSlots);
        }
      }

      // Move current time to after this busy period
      currentTime = new Date(Math.max(currentTime.getTime(), busyPeriod.end.getTime()));
    }

    // Check for availability after the last busy period
    if (currentTime < dayEnd) {
      const remainingDuration = (dayEnd.getTime() - currentTime.getTime()) / (1000 * 60);
      
      if (remainingDuration >= minimumDuration) {
        const finalSlots = this.createSlotsInTimeRange(
          currentTime,
          dayEnd,
          requiredDuration,
          minimumDuration
        );
        availableSlots.push(...finalSlots);
      }
    }

    return availableSlots;
  }

  /**
   * Create available slots within a time range
   */
  private createSlotsInTimeRange(
    startTime: Date,
    endTime: Date,
    requiredDuration: number,
    minimumDuration: number
  ): AvailableSlot[] {
    const slots: AvailableSlot[] = [];
    const totalAvailableMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

    // If the entire range can fit the required duration
    if (totalAvailableMinutes >= requiredDuration) {
      // Create slots every 15 minutes (or required duration, whichever is smaller)
      const slotInterval = Math.min(15, requiredDuration);
      let currentSlotStart = startTime;

      while (currentSlotStart.getTime() + (requiredDuration * 60 * 1000) <= endTime.getTime()) {
        const slotEnd = addMinutes(currentSlotStart, requiredDuration);
        
        slots.push({
          startTime: new Date(currentSlotStart),
          endTime: slotEnd,
          duration: requiredDuration
        });

        currentSlotStart = addMinutes(currentSlotStart, slotInterval);
      }
    }

    return slots;
  }

  /**
   * Optimize a slot with additional metadata for intelligent suggestions
   */
  private optimizeSlot(
    slot: AvailableSlot,
    bookingLink: BookingLink,
    user: User
  ): OptimizedSlot {
    const isPreferred = this.isPreferredTimeSlot(slot, user.preferences.energyPreferences.meetingPreferredTimes);
    const conflictScore = this.calculateConflictScore(slot, user);
    const energyLevel = this.getEnergyLevel(slot, user.preferences.energyPreferences);
    const recommendation = this.generateRecommendation(slot, isPreferred, conflictScore, energyLevel);

    return {
      ...slot,
      isPreferred,
      conflictScore,
      energyLevel,
      recommendation
    };
  }

  /**
   * Check if a slot falls within preferred meeting times
   */
  private isPreferredTimeSlot(slot: AvailableSlot, preferredTimes: TimeRange[]): boolean {
    const slotTime = format(slot.startTime, 'HH:mm');
    
    return preferredTimes.some(range => 
      slotTime >= range.start && slotTime <= range.end
    );
  }

  /**
   * Calculate conflict score based on proximity to other events and user preferences
   */
  private calculateConflictScore(slot: AvailableSlot, user: User): number {
    let score = 0;

    // Lower score is better
    // Add score based on time of day preferences
    const hour = slot.startTime.getHours();
    
    // Prefer business hours (9 AM - 5 PM)
    if (hour < 9 || hour > 17) {
      score += 20;
    }

    // Prefer not too early or too late
    if (hour < 8 || hour > 18) {
      score += 40;
    }

    // Prefer not during typical lunch hours (12-1 PM)
    if (hour === 12) {
      score += 10;
    }

    return score;
  }

  /**
   * Determine energy level for a time slot based on user preferences
   */
  private getEnergyLevel(
    slot: AvailableSlot,
    energyPreferences: User['preferences']['energyPreferences']
  ): 'high' | 'medium' | 'low' {
    const slotTime = format(slot.startTime, 'HH:mm');

    // Check if it's in high energy times
    if (energyPreferences.highEnergyTimes.some(range => 
      slotTime >= range.start && slotTime <= range.end
    )) {
      return 'high';
    }

    // Check if it's in low energy times
    if (energyPreferences.lowEnergyTimes.some(range => 
      slotTime >= range.start && slotTime <= range.end
    )) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Generate a recommendation message for a time slot
   */
  private generateRecommendation(
    slot: AvailableSlot,
    isPreferred: boolean,
    conflictScore: number,
    energyLevel: 'high' | 'medium' | 'low'
  ): string {
    if (isPreferred && energyLevel === 'high') {
      return 'Optimal time - preferred meeting hours with high energy';
    }

    if (isPreferred) {
      return 'Good time - within preferred meeting hours';
    }

    if (energyLevel === 'high') {
      return 'High energy time - great for important meetings';
    }

    if (conflictScore > 30) {
      return 'Available but outside typical business hours';
    }

    if (energyLevel === 'low') {
      return 'Available during low energy hours';
    }

    return 'Available time slot';
  }

  /**
   * Parse time string in specific timezone
   */
  private parseTimeInTimezone(date: Date, timeString: string, timezone: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const localDate = new Date(date);
    localDate.setHours(hours, minutes, 0, 0);
    
    // Convert to UTC considering timezone
    return zonedTimeToUtc(localDate, timezone);
  }

  /**
   * Check if two dates are in the same day
   */
  private isDateInSameDay(date1: Date, date2: Date): boolean {
    return format(date1, 'yyyy-MM-dd') === format(date2, 'yyyy-MM-dd');
  }
}