import { MeetingBookingService } from '@/services/MeetingBookingService';
import { BookingLinkRepository } from '@/repositories/BookingLinkRepository';
import { BookingRecordRepository, BookingRecord } from '@/repositories/BookingRecordRepository';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { AvailabilityCalculationService } from '@/services/AvailabilityCalculationService';
import { ReschedulingTriggerService } from '@/services/ReschedulingTriggerService';
import { BookingLink } from '@/models/BookingLink';
import { CalendarEvent } from '@/models/CalendarEvent';
import { User } from '@/models/User';
import { MeetingBookingRequest, BookingConfirmation, AvailabilityWindow } from '@/models/types';
import { addMinutes, addHours, addDays } from 'date-fns';

// Mock dependencies
jest.mock('@/repositories/BookingLinkRepository');
jest.mock('@/repositories/BookingRecordRepository');
jest.mock('@/repositories/CalendarEventRepository');
jest.mock('@/repositories/UserRepository');
jest.mock('@/services/AvailabilityCalculationService');
jest.mock('@/services/ReschedulingTriggerService');

describe('MeetingBookingService - Meeting Booking Processor', () => {
  let meetingBookingService: MeetingBookingService;
  let mockBookingLinkRepository: jest.Mocked<BookingLinkRepository>;
  let mockBookingRecordRepository: jest.Mocked<BookingRecordRepository>;
  let mockCalendarEventRepository: jest.Mocked<CalendarEventRepository>;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockAvailabilityService: jest.Mocked<AvailabilityCalculationService>;
  let mockReschedulingService: jest.Mocked<ReschedulingTriggerService>;

  const mockUser: User = {
    id: 'user-123',
    email: 'host@example.com',
    name: 'Host User',
    passwordHash: 'hashed-password',
    timezone: 'America/New_York',
    workingHours: {
      monday: { start: '09:00', end: '17:00' },
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' }
    },
    preferences: {
      maxContinuousWorkTime: 120,
      preferredBreakDuration: 15,
      groupSimilarTasks: true,
      protectFocusTime: false,
      optimizeForEarlyCompletion: true,
      defaultMeetingBuffer: 10,
      energyPreferences: {
        highEnergyTimes: [{ start: '09:00', end: '11:00' }],
        lowEnergyTimes: [{ start: '14:00', end: '16:00' }],
        meetingPreferredTimes: [{ start: '10:00', end: '12:00' }]
      },
      autoRescheduleEnabled: true,
      notificationSettings: {
        taskReminders: true,
        scheduleChanges: true,
        deadlineAlerts: true,
        completionCelebrations: true
      }
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const availabilityWindow: AvailabilityWindow = {
    daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
    timeRange: { start: '09:00', end: '17:00' },
    advanceBookingDays: 30,
    maxBookingsPerDay: 5
  };

  const mockBookingLink: BookingLink = {
    id: 'booking-link-123',
    userId: 'user-123',
    title: 'Team Meeting',
    duration: 60,
    availabilityWindow,
    bufferBefore: 10,
    bufferAfter: 5,
    isActive: true,
    customUrl: 'team-meeting',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const validBookingRequest: MeetingBookingRequest = {
    attendeeName: 'John Doe',
    attendeeEmail: 'john.doe@example.com',
    startTime: addHours(new Date(), 24), // Tomorrow at same time
    notes: 'Looking forward to our meeting'
  };

  beforeEach(() => {
    mockBookingLinkRepository = new BookingLinkRepository({} as any) as jest.Mocked<BookingLinkRepository>;
    mockBookingRecordRepository = new BookingRecordRepository({} as any) as jest.Mocked<BookingRecordRepository>;
    mockCalendarEventRepository = new CalendarEventRepository({} as any) as jest.Mocked<CalendarEventRepository>;
    mockUserRepository = new UserRepository({} as any) as jest.Mocked<UserRepository>;
    mockAvailabilityService = new AvailabilityCalculationService({} as any, {} as any, {} as any) as jest.Mocked<AvailabilityCalculationService>;
    mockReschedulingService = new ReschedulingTriggerService({} as any, {} as any, {} as any) as jest.Mocked<ReschedulingTriggerService>;

    meetingBookingService = new MeetingBookingService(
      mockBookingLinkRepository,
      mockCalendarEventRepository,
      mockUserRepository,
      mockAvailabilityService,
      mockReschedulingService,
      mockBookingRecordRepository
    );

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('bookMeeting', () => {
    const mockCalendarEvent: CalendarEvent = {
      id: 'calendar-event-123',
      userId: 'user-123',
      externalId: null,
      title: 'Team Meeting - John Doe',
      description: 'Meeting description',
      startTime: validBookingRequest.startTime,
      endTime: addMinutes(validBookingRequest.startTime, 60),
      isFlexible: false,
      travelTimeBefore: 10,
      travelTimeAfter: 5,
      source: 'momentum',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mockBookingRecord: BookingRecord = {
      id: 'booking-record-123',
      bookingLinkId: 'booking-link-123',
      attendeeName: 'John Doe',
      attendeeEmail: 'john.doe@example.com',
      startTime: validBookingRequest.startTime,
      endTime: addMinutes(validBookingRequest.startTime, 60),
      notes: 'Looking forward to our meeting',
      confirmationCode: 'ABC12345',
      calendarEventId: 'calendar-event-123',
      status: 'confirmed',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should successfully book a meeting', async () => {
      mockBookingLinkRepository.findById.mockResolvedValue(mockBookingLink);
      mockAvailabilityService.isTimeSlotAvailable.mockResolvedValue(true);
      mockBookingRecordRepository.findByBookingLinkId.mockResolvedValue([]);
      mockCalendarEventRepository.create.mockResolvedValue(mockCalendarEvent);
      mockBookingRecordRepository.create.mockResolvedValue(mockBookingRecord);
      mockReschedulingService.triggerRescheduling.mockResolvedValue();

      const result = await meetingBookingService.bookMeeting('booking-link-123', validBookingRequest);

      expect(result).toEqual({
        bookingId: 'booking-record-123',
        meetingId: 'calendar-event-123',
        confirmationCode: 'ABC12345',
        calendarEventId: 'calendar-event-123'
      });

      expect(mockBookingLinkRepository.findById).toHaveBeenCalledWith('booking-link-123');
      expect(mockAvailabilityService.isTimeSlotAvailable).toHaveBeenCalledWith(
        mockBookingLink,
        validBookingRequest.startTime
      );
      expect(mockCalendarEventRepository.create).toHaveBeenCalled();
      expect(mockBookingRecordRepository.create).toHaveBeenCalled();
      expect(mockReschedulingService.triggerRescheduling).toHaveBeenCalledWith(
        'user-123',
        'calendar_event_added'
      );
    });

    it('should throw error when booking link not found', async () => {
      mockBookingLinkRepository.findById.mockResolvedValue(null);

      await expect(
        meetingBookingService.bookMeeting('nonexistent-link', validBookingRequest)
      ).rejects.toThrow('Booking link not found or inactive');

      expect(mockBookingLinkRepository.findById).toHaveBeenCalledWith('nonexistent-link');
    });

    it('should throw error when booking link is inactive', async () => {
      const inactiveBookingLink = { ...mockBookingLink, isActive: false };
      mockBookingLinkRepository.findById.mockResolvedValue(inactiveBookingLink);

      await expect(
        meetingBookingService.bookMeeting('booking-link-123', validBookingRequest)
      ).rejects.toThrow('Booking link not found or inactive');
    });

    it('should throw error when time slot is not available', async () => {
      mockBookingLinkRepository.findById.mockResolvedValue(mockBookingLink);
      mockAvailabilityService.isTimeSlotAvailable.mockResolvedValue(false);

      await expect(
        meetingBookingService.bookMeeting('booking-link-123', validBookingRequest)
      ).rejects.toThrow('Requested time slot is not available');

      expect(mockAvailabilityService.isTimeSlotAvailable).toHaveBeenCalledWith(
        mockBookingLink,
        validBookingRequest.startTime
      );
    });

    it('should throw error for invalid attendee name', async () => {
      const invalidRequest = { ...validBookingRequest, attendeeName: '' };
      mockBookingLinkRepository.findById.mockResolvedValue(mockBookingLink);
      mockAvailabilityService.isTimeSlotAvailable.mockResolvedValue(true);

      await expect(
        meetingBookingService.bookMeeting('booking-link-123', invalidRequest)
      ).rejects.toThrow('Attendee name is required');
    });

    it('should throw error for invalid attendee email', async () => {
      const invalidRequest = { ...validBookingRequest, attendeeEmail: 'invalid-email' };
      mockBookingLinkRepository.findById.mockResolvedValue(mockBookingLink);
      mockAvailabilityService.isTimeSlotAvailable.mockResolvedValue(true);

      await expect(
        meetingBookingService.bookMeeting('booking-link-123', invalidRequest)
      ).rejects.toThrow('Valid attendee email is required');
    });

    it('should throw error for past booking time', async () => {
      const pastRequest = { ...validBookingRequest, startTime: new Date(Date.now() - 3600000) }; // 1 hour ago
      mockBookingLinkRepository.findById.mockResolvedValue(mockBookingLink);
      mockAvailabilityService.isTimeSlotAvailable.mockResolvedValue(true);

      await expect(
        meetingBookingService.bookMeeting('booking-link-123', pastRequest)
      ).rejects.toThrow('Cannot book meetings in the past');
    });

    it('should throw error when booking too far in advance', async () => {
      const farFutureRequest = { 
        ...validBookingRequest, 
        startTime: addDays(new Date(), 100) // 100 days in future
      };
      mockBookingLinkRepository.findById.mockResolvedValue(mockBookingLink);
      mockAvailabilityService.isTimeSlotAvailable.mockResolvedValue(true);

      await expect(
        meetingBookingService.bookMeeting('booking-link-123', farFutureRequest)
      ).rejects.toThrow('Cannot book meetings more than 30 days in advance');
    });

    it('should throw error when daily booking limit is reached', async () => {
      const bookingLinkWithLimit = {
        ...mockBookingLink,
        availabilityWindow: {
          ...availabilityWindow,
          maxBookingsPerDay: 2
        }
      };

      // Mock existing bookings for the day
      const existingBookings = [
        { ...mockBookingRecord, id: 'booking-1' },
        { ...mockBookingRecord, id: 'booking-2' }
      ];

      mockBookingLinkRepository.findById.mockResolvedValue(bookingLinkWithLimit);
      mockAvailabilityService.isTimeSlotAvailable.mockResolvedValue(true);
      mockBookingRecordRepository.findByBookingLinkId.mockResolvedValue(existingBookings);

      await expect(
        meetingBookingService.bookMeeting('booking-link-123', validBookingRequest)
      ).rejects.toThrow('Maximum bookings per day reached for this date');
    });

    it('should throw error for booking on unavailable day', async () => {
      const weekendRequest = {
        ...validBookingRequest,
        startTime: new Date('2024-01-13T10:00:00.000Z') // Saturday
      };

      mockBookingLinkRepository.findById.mockResolvedValue(mockBookingLink);
      mockAvailabilityService.isTimeSlotAvailable.mockResolvedValue(true);

      await expect(
        meetingBookingService.bookMeeting('booking-link-123', weekendRequest)
      ).rejects.toThrow('Selected day is not available for booking');
    });

    it('should throw error for booking outside time range', async () => {
      const earlyRequest = {
        ...validBookingRequest,
        startTime: new Date('2024-01-15T06:00:00.000Z') // 6 AM, before 9 AM start
      };

      mockBookingLinkRepository.findById.mockResolvedValue(mockBookingLink);
      mockAvailabilityService.isTimeSlotAvailable.mockResolvedValue(true);

      await expect(
        meetingBookingService.bookMeeting('booking-link-123', earlyRequest)
      ).rejects.toThrow('Selected time must be between 09:00 and 17:00');
    });
  });

  describe('cancelBooking', () => {
    const mockBookingRecord: BookingRecord = {
      id: 'booking-record-123',
      bookingLinkId: 'booking-link-123',
      attendeeName: 'John Doe',
      attendeeEmail: 'john.doe@example.com',
      startTime: addHours(new Date(), 24),
      endTime: addHours(new Date(), 25),
      notes: 'Meeting notes',
      confirmationCode: 'ABC12345',
      calendarEventId: 'calendar-event-123',
      status: 'confirmed',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should successfully cancel a booking', async () => {
      mockBookingRecordRepository.findByConfirmationCode.mockResolvedValue(mockBookingRecord);
      mockBookingLinkRepository.findById.mockResolvedValue(mockBookingLink);
      mockBookingRecordRepository.updateStatus.mockResolvedValue({ ...mockBookingRecord, status: 'cancelled' });
      mockCalendarEventRepository.delete.mockResolvedValue();
      mockReschedulingService.triggerRescheduling.mockResolvedValue();

      await meetingBookingService.cancelBooking('ABC12345', 'No longer needed');

      expect(mockBookingRecordRepository.findByConfirmationCode).toHaveBeenCalledWith('ABC12345');
      expect(mockBookingRecordRepository.updateStatus).toHaveBeenCalledWith('booking-record-123', 'cancelled');
      expect(mockCalendarEventRepository.delete).toHaveBeenCalledWith('calendar-event-123');
      expect(mockReschedulingService.triggerRescheduling).toHaveBeenCalledWith(
        'user-123',
        'calendar_event_deleted'
      );
    });

    it('should throw error when booking not found', async () => {
      mockBookingRecordRepository.findByConfirmationCode.mockResolvedValue(null);

      await expect(
        meetingBookingService.cancelBooking('INVALID123')
      ).rejects.toThrow('Booking not found');

      expect(mockBookingRecordRepository.findByConfirmationCode).toHaveBeenCalledWith('INVALID123');
    });

    it('should throw error when booking is already cancelled', async () => {
      const cancelledBooking = { ...mockBookingRecord, status: 'cancelled' as const };
      mockBookingRecordRepository.findByConfirmationCode.mockResolvedValue(cancelledBooking);

      await expect(
        meetingBookingService.cancelBooking('ABC12345')
      ).rejects.toThrow('Booking is already cancelled');
    });
  });

  describe('rescheduleBooking', () => {
    const mockBookingRecord: BookingRecord = {
      id: 'booking-record-123',
      bookingLinkId: 'booking-link-123',
      attendeeName: 'John Doe',
      attendeeEmail: 'john.doe@example.com',
      startTime: addHours(new Date(), 24),
      endTime: addHours(new Date(), 25),
      notes: 'Meeting notes',
      confirmationCode: 'ABC12345',
      calendarEventId: 'calendar-event-123',
      status: 'confirmed',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newStartTime = addHours(new Date(), 48); // 2 days from now

    it('should successfully reschedule a booking', async () => {
      const newBookingRecord = {
        ...mockBookingRecord,
        id: 'new-booking-record-123',
        confirmationCode: 'XYZ67890',
        startTime: newStartTime,
        endTime: addMinutes(newStartTime, 60)
      };

      const newCalendarEvent = {
        id: 'new-calendar-event-123',
        userId: 'user-123',
        externalId: null,
        title: 'Team Meeting - John Doe',
        description: 'Meeting description',
        startTime: newStartTime,
        endTime: addMinutes(newStartTime, 60),
        isFlexible: false,
        travelTimeBefore: 10,
        travelTimeAfter: 5,
        source: 'momentum' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Mock the cancellation process
      mockBookingRecordRepository.findByConfirmationCode.mockResolvedValueOnce(mockBookingRecord);
      mockBookingLinkRepository.findById.mockResolvedValue(mockBookingLink);
      mockBookingRecordRepository.updateStatus.mockResolvedValue({ ...mockBookingRecord, status: 'cancelled' });
      mockCalendarEventRepository.delete.mockResolvedValue();

      // Mock the new booking process
      mockAvailabilityService.isTimeSlotAvailable.mockResolvedValue(true);
      mockBookingRecordRepository.findByBookingLinkId.mockResolvedValue([]);
      mockCalendarEventRepository.create.mockResolvedValue(newCalendarEvent);
      mockBookingRecordRepository.create.mockResolvedValue(newBookingRecord);
      mockReschedulingService.triggerRescheduling.mockResolvedValue();

      const result = await meetingBookingService.rescheduleBooking('ABC12345', newStartTime);

      expect(result).toEqual({
        bookingId: 'new-booking-record-123',
        meetingId: 'new-calendar-event-123',
        confirmationCode: 'XYZ67890',
        calendarEventId: 'new-calendar-event-123'
      });

      expect(mockAvailabilityService.isTimeSlotAvailable).toHaveBeenCalledWith(
        mockBookingLink,
        newStartTime
      );
    });

    it('should throw error when original booking not found', async () => {
      mockBookingRecordRepository.findByConfirmationCode.mockResolvedValue(null);

      await expect(
        meetingBookingService.rescheduleBooking('INVALID123', newStartTime)
      ).rejects.toThrow('Booking not found');
    });

    it('should throw error when trying to reschedule cancelled booking', async () => {
      const cancelledBooking = { ...mockBookingRecord, status: 'cancelled' as const };
      mockBookingRecordRepository.findByConfirmationCode.mockResolvedValue(cancelledBooking);

      await expect(
        meetingBookingService.rescheduleBooking('ABC12345', newStartTime)
      ).rejects.toThrow('Cannot reschedule cancelled booking');
    });

    it('should throw error when new time slot is not available', async () => {
      mockBookingRecordRepository.findByConfirmationCode.mockResolvedValue(mockBookingRecord);
      mockBookingLinkRepository.findById.mockResolvedValue(mockBookingLink);
      mockAvailabilityService.isTimeSlotAvailable.mockResolvedValue(false);

      await expect(
        meetingBookingService.rescheduleBooking('ABC12345', newStartTime)
      ).rejects.toThrow('New time slot is not available');
    });
  });

  describe('getBookingsForLink', () => {
    it('should return bookings for authorized user', async () => {
      const mockBookings: BookingRecord[] = [
        {
          id: 'booking-1',
          bookingLinkId: 'booking-link-123',
          attendeeName: 'John Doe',
          attendeeEmail: 'john@example.com',
          startTime: new Date(),
          endTime: new Date(),
          confirmationCode: 'ABC123',
          status: 'confirmed',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockBookingLinkRepository.findById.mockResolvedValue(mockBookingLink);
      mockBookingRecordRepository.findByBookingLinkId.mockResolvedValue(mockBookings);

      const result = await meetingBookingService.getBookingsForLink(
        'booking-link-123',
        'user-123'
      );

      expect(result).toEqual(mockBookings);
      expect(mockBookingLinkRepository.findById).toHaveBeenCalledWith('booking-link-123');
      expect(mockBookingRecordRepository.findByBookingLinkId).toHaveBeenCalledWith(
        'booking-link-123',
        undefined
      );
    });

    it('should throw error for unauthorized user', async () => {
      const unauthorizedBookingLink = { ...mockBookingLink, userId: 'other-user' };
      mockBookingLinkRepository.findById.mockResolvedValue(unauthorizedBookingLink);

      await expect(
        meetingBookingService.getBookingsForLink('booking-link-123', 'user-123')
      ).rejects.toThrow('Booking link not found or access denied');
    });

    it('should throw error when booking link not found', async () => {
      mockBookingLinkRepository.findById.mockResolvedValue(null);

      await expect(
        meetingBookingService.getBookingsForLink('nonexistent-link', 'user-123')
      ).rejects.toThrow('Booking link not found or access denied');
    });
  });

  describe('getBookingStatistics', () => {
    it('should return booking statistics for user', async () => {
      const mockStatistics = {
        totalBookings: 10,
        confirmedBookings: 8,
        cancelledBookings: 1,
        completedBookings: 1,
        upcomingBookings: 7,
        averageBookingsPerDay: 2.5,
        popularTimeSlots: [{ hour: 10, count: 5 }, { hour: 14, count: 3 }],
        bookingsByLink: [{ linkId: 'link-1', linkTitle: 'Meeting', count: 10 }]
      };

      mockBookingRecordRepository.getStatistics.mockResolvedValue(mockStatistics);

      const result = await meetingBookingService.getBookingStatistics('user-123');

      expect(result).toEqual(mockStatistics);
      expect(mockBookingRecordRepository.getStatistics).toHaveBeenCalledWith('user-123', undefined);
    });

    it('should return statistics with date range filter', async () => {
      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      const mockStatistics = {
        totalBookings: 5,
        confirmedBookings: 4,
        cancelledBookings: 1,
        completedBookings: 0,
        upcomingBookings: 4,
        averageBookingsPerDay: 1.2,
        popularTimeSlots: [{ hour: 10, count: 3 }],
        bookingsByLink: [{ linkId: 'link-1', linkTitle: 'Meeting', count: 5 }]
      };

      mockBookingRecordRepository.getStatistics.mockResolvedValue(mockStatistics);

      const result = await meetingBookingService.getBookingStatistics('user-123', dateRange);

      expect(result).toEqual(mockStatistics);
      expect(mockBookingRecordRepository.getStatistics).toHaveBeenCalledWith('user-123', dateRange);
    });
  });
});