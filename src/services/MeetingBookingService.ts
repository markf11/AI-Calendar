import { BookingLink } from '@/models/BookingLink';
import { CalendarEvent } from '@/models/CalendarEvent';
import { MeetingBookingRequest, BookingConfirmation, AvailableSlot } from '@/models/types';
import { BookingLinkRepository } from '@/repositories/BookingLinkRepository';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { BookingRecordRepository, BookingRecord } from '@/repositories/BookingRecordRepository';
import { AvailabilityCalculationService } from '@/services/AvailabilityCalculationService';
import { ReschedulingTriggerService } from '@/services/ReschedulingTriggerService';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { addMinutes, format } from 'date-fns';



export interface BookingNotification {
  type: 'confirmation' | 'reminder' | 'cancellation';
  recipientEmail: string;
  recipientName: string;
  subject: string;
  message: string;
  meetingDetails: {
    title: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    confirmationCode: string;
  };
}

export class MeetingBookingService {
  constructor(
    private bookingLinkRepository: BookingLinkRepository,
    private calendarEventRepository: CalendarEventRepository,
    private userRepository: UserRepository,
    private availabilityService: AvailabilityCalculationService,
    private reschedulingService: ReschedulingTriggerService,
    private bookingRecordRepository: BookingRecordRepository
  ) {}

  /**
   * Process a meeting booking request
   */
  async bookMeeting(
    linkId: string,
    bookingRequest: MeetingBookingRequest
  ): Promise<BookingConfirmation> {
    // Get booking link
    const bookingLink = await this.bookingLinkRepository.findById(linkId);
    if (!bookingLink || !bookingLink.isActive) {
      throw new Error('Booking link not found or inactive');
    }

    // Validate the requested time slot is available
    const isAvailable = await this.availabilityService.isTimeSlotAvailable(
      bookingLink,
      bookingRequest.startTime
    );

    if (!isAvailable) {
      throw new Error('Requested time slot is not available');
    }

    // Validate booking request
    this.validateBookingRequest(bookingRequest, bookingLink);

    // Check daily booking limits
    await this.checkDailyBookingLimits(bookingLink, bookingRequest.startTime);

    // Generate confirmation code
    const confirmationCode = this.generateConfirmationCode();

    // Calculate meeting end time
    const endTime = addMinutes(bookingRequest.startTime, bookingLink.duration);

    // Create calendar event for the meeting host
    const calendarEvent = await this.createMeetingCalendarEvent(
      bookingLink,
      bookingRequest,
      endTime,
      confirmationCode
    );

    // Create booking record
    const bookingRecord = await this.createBookingRecord(
      bookingLink,
      bookingRequest,
      endTime,
      confirmationCode,
      calendarEvent.id
    );

    // Trigger automatic rescheduling for the host
    await this.triggerRescheduling(bookingLink.userId, 'calendar_event_added');

    // Send confirmation notifications
    await this.sendBookingNotifications(bookingLink, bookingRecord, 'confirmation');

    return {
      bookingId: bookingRecord.id,
      meetingId: calendarEvent.id,
      confirmationCode,
      calendarEventId: calendarEvent.id
    };
  }

  /**
   * Cancel a meeting booking
   */
  async cancelBooking(
    confirmationCode: string,
    reason?: string
  ): Promise<void> {
    // Find booking record by confirmation code
    const bookingRecord = await this.bookingRecordRepository.findByConfirmationCode(confirmationCode);
    if (!bookingRecord) {
      throw new Error('Booking not found');
    }

    if (bookingRecord.status === 'cancelled') {
      throw new Error('Booking is already cancelled');
    }

    // Get booking link for notifications
    const bookingLink = await this.bookingLinkRepository.findById(bookingRecord.bookingLinkId);
    if (!bookingLink) {
      throw new Error('Booking link not found');
    }

    // Update booking record status
    await this.bookingRecordRepository.updateStatus(bookingRecord.id, 'cancelled');

    // Delete the calendar event
    if (bookingRecord.calendarEventId) {
      await this.calendarEventRepository.delete(bookingRecord.calendarEventId);
    }

    // Trigger automatic rescheduling for the host
    await this.triggerRescheduling(bookingLink.userId, 'calendar_event_deleted');

    // Send cancellation notifications
    await this.sendBookingNotifications(bookingLink, bookingRecord, 'cancellation');
  }

  /**
   * Reschedule a meeting booking
   */
  async rescheduleBooking(
    confirmationCode: string,
    newStartTime: Date
  ): Promise<BookingConfirmation> {
    // Find existing booking
    const existingBooking = await this.bookingRecordRepository.findByConfirmationCode(confirmationCode);
    if (!existingBooking) {
      throw new Error('Booking not found');
    }

    if (existingBooking.status === 'cancelled') {
      throw new Error('Cannot reschedule cancelled booking');
    }

    // Get booking link
    const bookingLink = await this.bookingLinkRepository.findById(existingBooking.bookingLinkId);
    if (!bookingLink || !bookingLink.isActive) {
      throw new Error('Booking link not found or inactive');
    }

    // Validate new time slot is available
    const isAvailable = await this.availabilityService.isTimeSlotAvailable(
      bookingLink,
      newStartTime
    );

    if (!isAvailable) {
      throw new Error('New time slot is not available');
    }

    // Cancel existing booking
    await this.cancelBooking(confirmationCode, 'Rescheduled to new time');

    // Create new booking
    const newBookingRequest: MeetingBookingRequest = {
      attendeeName: existingBooking.attendeeName,
      attendeeEmail: existingBooking.attendeeEmail,
      startTime: newStartTime,
      notes: existingBooking.notes
    };

    return await this.bookMeeting(bookingLink.id, newBookingRequest);
  }

  /**
   * Get booking details by confirmation code
   */
  async getBookingDetails(confirmationCode: string): Promise<BookingRecord | null> {
    return await this.bookingRecordRepository.findByConfirmationCode(confirmationCode);
  }

  /**
   * Get booking link by ID
   */
  async getBookingLink(linkId: string): Promise<BookingLink | null> {
    const bookingLink = await this.bookingLinkRepository.findById(linkId);
    return bookingLink && bookingLink.isActive ? bookingLink : null;
  }

  /**
   * Get all bookings for a booking link
   */
  async getBookingsForLink(
    linkId: string,
    userId: string,
    filters?: {
      status?: BookingRecord['status'][];
      dateRange?: { start: Date; end: Date };
    }
  ): Promise<BookingRecord[]> {
    // Verify user owns the booking link
    const bookingLink = await this.bookingLinkRepository.findById(linkId);
    if (!bookingLink || bookingLink.userId !== userId) {
      throw new Error('Booking link not found or access denied');
    }

    return await this.bookingRecordRepository.findByBookingLinkId(linkId, filters);
  }

  /**
   * Get booking statistics for a user
   */
  async getBookingStatistics(
    userId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    totalBookings: number;
    confirmedBookings: number;
    cancelledBookings: number;
    completedBookings: number;
    upcomingBookings: number;
    averageBookingsPerDay: number;
    popularTimeSlots: Array<{ hour: number; count: number }>;
    bookingsByLink: Array<{ linkId: string; linkTitle: string; count: number }>;
  }> {
    return await this.bookingRecordRepository.getStatistics(userId, dateRange);
  }

  /**
   * Send booking reminder notifications
   */
  async sendBookingReminders(): Promise<void> {
    // Get bookings that need reminders (e.g., 24 hours before)
    const upcomingBookings = await this.bookingRecordRepository.findUpcomingBookings(24); // 24 hours

    for (const booking of upcomingBookings) {
      const bookingLink = await this.bookingLinkRepository.findById(booking.bookingLinkId);
      if (bookingLink) {
        await this.sendBookingNotifications(bookingLink, booking, 'reminder');
      }
    }
  }

  /**
   * Validate booking request
   */
  private validateBookingRequest(
    request: MeetingBookingRequest,
    bookingLink: BookingLink
  ): void {
    if (!request.attendeeName || request.attendeeName.trim().length === 0) {
      throw new Error('Attendee name is required');
    }

    if (!request.attendeeEmail || !this.isValidEmail(request.attendeeEmail)) {
      throw new Error('Valid attendee email is required');
    }

    if (!request.startTime || !(request.startTime instanceof Date)) {
      throw new Error('Valid start time is required');
    }

    // Check if booking is within advance booking window
    const now = new Date();
    const maxAdvanceDate = new Date();
    maxAdvanceDate.setDate(now.getDate() + bookingLink.availabilityWindow.advanceBookingDays);

    if (request.startTime < now) {
      throw new Error('Cannot book meetings in the past');
    }

    if (request.startTime > maxAdvanceDate) {
      throw new Error(`Cannot book meetings more than ${bookingLink.availabilityWindow.advanceBookingDays} days in advance`);
    }

    // Validate day of week
    const dayOfWeek = request.startTime.getDay();
    if (!bookingLink.availabilityWindow.daysOfWeek.includes(dayOfWeek)) {
      throw new Error('Selected day is not available for booking');
    }

    // Validate time of day
    const timeString = format(request.startTime, 'HH:mm');
    const { start, end } = bookingLink.availabilityWindow.timeRange;
    
    if (timeString < start || timeString >= end) {
      throw new Error(`Selected time must be between ${start} and ${end}`);
    }
  }

  /**
   * Check daily booking limits
   */
  private async checkDailyBookingLimits(
    bookingLink: BookingLink,
    requestedDate: Date
  ): Promise<void> {
    if (!bookingLink.availabilityWindow.maxBookingsPerDay) {
      return; // No limit set
    }

    const dayStart = new Date(requestedDate);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(requestedDate);
    dayEnd.setHours(23, 59, 59, 999);

    const existingBookings = await this.bookingRecordRepository.findByBookingLinkId(
      bookingLink.id,
      {
        status: ['confirmed'],
        dateRange: { start: dayStart, end: dayEnd }
      }
    );

    if (existingBookings.length >= bookingLink.availabilityWindow.maxBookingsPerDay) {
      throw new Error('Maximum bookings per day reached for this date');
    }
  }

  /**
   * Create calendar event for the meeting
   */
  private async createMeetingCalendarEvent(
    bookingLink: BookingLink,
    request: MeetingBookingRequest,
    endTime: Date,
    confirmationCode: string
  ): Promise<CalendarEvent> {
    const eventTitle = `${bookingLink.title} - ${request.attendeeName}`;
    const eventDescription = this.generateMeetingDescription(
      bookingLink,
      request,
      confirmationCode
    );

    return await this.calendarEventRepository.create(bookingLink.userId, {
      title: eventTitle,
      description: eventDescription,
      startTime: request.startTime,
      endTime: endTime,
      isFlexible: false, // Booked meetings are firm
      travelTimeBefore: bookingLink.bufferBefore,
      travelTimeAfter: bookingLink.bufferAfter,
      source: 'momentum'
    });
  }

  /**
   * Create booking record
   */
  private async createBookingRecord(
    bookingLink: BookingLink,
    request: MeetingBookingRequest,
    endTime: Date,
    confirmationCode: string,
    calendarEventId: string
  ): Promise<BookingRecord> {
    return await this.bookingRecordRepository.create({
      id: uuidv4(),
      bookingLinkId: bookingLink.id,
      attendeeName: request.attendeeName,
      attendeeEmail: request.attendeeEmail,
      startTime: request.startTime,
      endTime: endTime,
      notes: request.notes,
      confirmationCode,
      calendarEventId,
      status: 'confirmed'
    });
  }

  /**
   * Trigger automatic rescheduling
   */
  private async triggerRescheduling(
    userId: string,
    trigger: 'calendar_event_added' | 'calendar_event_deleted'
  ): Promise<void> {
    try {
      await this.reschedulingService.triggerRescheduling(userId, trigger);
    } catch (error) {
      // Log error but don't fail the booking process
      console.error('Failed to trigger rescheduling:', error);
    }
  }

  /**
   * Send booking notifications
   */
  private async sendBookingNotifications(
    bookingLink: BookingLink,
    bookingRecord: BookingRecord,
    type: 'confirmation' | 'reminder' | 'cancellation'
  ): Promise<void> {
    // Get host user information
    const hostUser = await this.userRepository.findById(bookingLink.userId);
    if (!hostUser) {
      throw new Error('Host user not found');
    }

    // Create notifications for both attendee and host
    const notifications: BookingNotification[] = [];

    // Attendee notification
    const attendeeNotification = this.createAttendeeNotification(
      type,
      bookingRecord,
      bookingLink,
      hostUser.name
    );
    notifications.push(attendeeNotification);

    // Host notification
    const hostNotification = this.createHostNotification(
      type,
      bookingRecord,
      bookingLink,
      hostUser.email,
      hostUser.name
    );
    notifications.push(hostNotification);

    // Send notifications (implementation would depend on email service)
    for (const notification of notifications) {
      await this.sendNotification(notification);
    }
  }

  /**
   * Create attendee notification
   */
  private createAttendeeNotification(
    type: 'confirmation' | 'reminder' | 'cancellation',
    bookingRecord: BookingRecord,
    bookingLink: BookingLink,
    hostName: string
  ): BookingNotification {
    const meetingDetails = {
      title: bookingLink.title,
      startTime: bookingRecord.startTime,
      endTime: bookingRecord.endTime,
      duration: bookingLink.duration,
      confirmationCode: bookingRecord.confirmationCode
    };

    let subject: string;
    let message: string;

    switch (type) {
      case 'confirmation':
        subject = `Meeting Confirmed: ${bookingLink.title}`;
        message = `Your meeting "${bookingLink.title}" with ${hostName} has been confirmed for ${format(bookingRecord.startTime, 'PPpp')}. Confirmation code: ${bookingRecord.confirmationCode}`;
        break;
      case 'reminder':
        subject = `Meeting Reminder: ${bookingLink.title}`;
        message = `Reminder: You have a meeting "${bookingLink.title}" with ${hostName} scheduled for ${format(bookingRecord.startTime, 'PPpp')}. Confirmation code: ${bookingRecord.confirmationCode}`;
        break;
      case 'cancellation':
        subject = `Meeting Cancelled: ${bookingLink.title}`;
        message = `Your meeting "${bookingLink.title}" with ${hostName} scheduled for ${format(bookingRecord.startTime, 'PPpp')} has been cancelled.`;
        break;
    }

    return {
      type,
      recipientEmail: bookingRecord.attendeeEmail,
      recipientName: bookingRecord.attendeeName,
      subject,
      message,
      meetingDetails
    };
  }

  /**
   * Create host notification
   */
  private createHostNotification(
    type: 'confirmation' | 'reminder' | 'cancellation',
    bookingRecord: BookingRecord,
    bookingLink: BookingLink,
    hostEmail: string,
    hostName: string
  ): BookingNotification {
    const meetingDetails = {
      title: bookingLink.title,
      startTime: bookingRecord.startTime,
      endTime: bookingRecord.endTime,
      duration: bookingLink.duration,
      confirmationCode: bookingRecord.confirmationCode
    };

    let subject: string;
    let message: string;

    switch (type) {
      case 'confirmation':
        subject = `New Booking: ${bookingLink.title}`;
        message = `New meeting booked: "${bookingLink.title}" with ${bookingRecord.attendeeName} (${bookingRecord.attendeeEmail}) for ${format(bookingRecord.startTime, 'PPpp')}. Confirmation code: ${bookingRecord.confirmationCode}`;
        break;
      case 'reminder':
        subject = `Meeting Reminder: ${bookingLink.title}`;
        message = `Reminder: You have a meeting "${bookingLink.title}" with ${bookingRecord.attendeeName} scheduled for ${format(bookingRecord.startTime, 'PPpp')}.`;
        break;
      case 'cancellation':
        subject = `Meeting Cancelled: ${bookingLink.title}`;
        message = `Meeting "${bookingLink.title}" with ${bookingRecord.attendeeName} scheduled for ${format(bookingRecord.startTime, 'PPpp')} has been cancelled.`;
        break;
    }

    return {
      type,
      recipientEmail: hostEmail,
      recipientName: hostName,
      subject,
      message,
      meetingDetails
    };
  }

  /**
   * Generate meeting description
   */
  private generateMeetingDescription(
    bookingLink: BookingLink,
    request: MeetingBookingRequest,
    confirmationCode: string
  ): string {
    let description = `Meeting: ${bookingLink.title}\n`;
    description += `Attendee: ${request.attendeeName} (${request.attendeeEmail})\n`;
    description += `Duration: ${bookingLink.duration} minutes\n`;
    description += `Confirmation Code: ${confirmationCode}\n`;
    
    if (request.notes) {
      description += `\nNotes: ${request.notes}`;
    }

    return description;
  }

  /**
   * Generate unique confirmation code
   */
  private generateConfirmationCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Send notification (placeholder - would integrate with actual email service)
   */
  private async sendNotification(notification: BookingNotification): Promise<void> {
    // This would integrate with an actual email service like SendGrid, AWS SES, etc.
    console.log(`Sending ${notification.type} notification to ${notification.recipientEmail}:`, {
      subject: notification.subject,
      message: notification.message
    });
    
    // For now, just log the notification
    // In a real implementation, this would send actual emails
  }
}

