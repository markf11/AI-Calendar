import { format, parseISO, isValid, addMinutes, subMinutes, startOfDay, endOfDay } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime, format as formatTz } from 'date-fns-tz';

export class DateUtils {
  /**
   * Convert a date to UTC from a specific timezone
   */
  static toUTC(date: Date | string, timezone: string): Date {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return zonedTimeToUtc(dateObj, timezone);
  }

  /**
   * Convert a UTC date to a specific timezone
   */
  static fromUTC(date: Date, timezone: string): Date {
    return utcToZonedTime(date, timezone);
  }

  /**
   * Format a date in a specific timezone
   */
  static formatInTimezone(date: Date, timezone: string, formatString: string = 'yyyy-MM-dd HH:mm:ss'): string {
    return formatTz(date, formatString, { timeZone: timezone });
  }

  /**
   * Check if a date string is valid
   */
  static isValidDate(date: string | Date): boolean {
    if (typeof date === 'string') {
      const parsed = parseISO(date);
      return isValid(parsed);
    }
    return isValid(date);
  }

  /**
   * Get the start of day in a specific timezone
   */
  static getStartOfDay(date: Date, timezone: string): Date {
    const zonedDate = this.fromUTC(date, timezone);
    const startOfDayLocal = startOfDay(zonedDate);
    return this.toUTC(startOfDayLocal, timezone);
  }

  /**
   * Get the end of day in a specific timezone
   */
  static getEndOfDay(date: Date, timezone: string): Date {
    const zonedDate = this.fromUTC(date, timezone);
    const endOfDayLocal = endOfDay(zonedDate);
    return this.toUTC(endOfDayLocal, timezone);
  }

  /**
   * Add minutes to a date
   */
  static addMinutes(date: Date, minutes: number): Date {
    return addMinutes(date, minutes);
  }

  /**
   * Subtract minutes from a date
   */
  static subtractMinutes(date: Date, minutes: number): Date {
    return subMinutes(date, minutes);
  }

  /**
   * Calculate duration between two dates in minutes
   */
  static getDurationInMinutes(startDate: Date, endDate: Date): number {
    return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
  }

  /**
   * Check if two date ranges overlap
   */
  static doRangesOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): boolean {
    return start1 < end2 && start2 < end1;
  }

  /**
   * Parse time string (HH:mm) and return minutes from midnight
   */
  static parseTimeToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes from midnight to time string (HH:mm)
   */
  static minutesToTimeString(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Get current date in ISO string format
   */
  static now(): string {
    return new Date().toISOString();
  }

  /**
   * Create a date from date and time components in a specific timezone
   */
  static createDateInTimezone(
    dateString: string, // YYYY-MM-DD
    timeString: string, // HH:mm
    timezone: string
  ): Date {
    const dateTimeString = `${dateString}T${timeString}:00`;
    const localDate = parseISO(dateTimeString);
    return this.toUTC(localDate, timezone);
  }
}