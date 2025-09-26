import { AvailabilityCalculationService, AvailabilityOptions, OptimizedSlot } from '@/services/AvailabilityCalculationService';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import { TaskRepository } from '@/repositories/TaskRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { BookingLink } from '@/models/BookingLink';
import { CalendarEvent } from '@/models/CalendarEvent';
import { Task } from '@/models/Task';
import { User } from '@/models/User';
import { AvailableSlot, DateRange, AvailabilityWindow } from '@/models/types';
import { addDays, addHours, addMinutes, startOfDay } from 'date-fns';

// Mock dependencies
jest.mock('@/repositories/CalendarEventRepository');
jest.mock('@/repositories/TaskRepository');
jest.mock('@/repositories/UserRepository');

describe('AvailabilityCalculationService', () => {
  let availabilityService: AvailabilityCalculationService;
  let mockCalendarEventRepository: jest.Mocked<CalendarEventRepository>;
  let mockTaskRepository: jest.Mocked<TaskRepository>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
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
        meetingPreferredTimes: [{ start: '10:00', end: '12:00' }, { start: '14:00', end: '16:00' }]
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

  beforeEach(() => {
    mockCalendarEventRepository = new CalendarEventRepository({} as any) as jest.Mocked<CalendarEventRepository>;
    mockTaskRepository = new TaskRepository() as jest.Mocked<TaskRepository>;
    mockUserRepository = new UserRepository({} as any) as jest.Mocked<UserRepository>;

    availabilityService = new AvailabilityCalculationService(
      mockCalendarEventRepository,
      mockTaskRepository,
      mockUserRepository
    );

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('calculateAvailability', () => {
    const baseDate = startOfDay(new Date('2024-01-15')); // Monday
    const dateRange: DateRange = {
      start: baseDate,
      end: addDays(baseDate, 4) // Friday
    };

    it('should calculate availability with no conflicts', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCalendarEventRepository.findByUserIdAndDateRange.mockResolvedValue([]);
      mockTaskRepository.findScheduledByUserIdAndDateRange.mockResolvedValue([]);

      const result = await availabilityService.calculateAvailability(mockBookingLink, dateRange);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // Should have slots for each weekday (Monday-Friday)
      const uniqueDays = new Set(result.map(slot => slot.startTime.toDateString()));
      expect(uniqueDays.size).toBe(5); // 5 weekdays

      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(mockCalendarEventRepository.findByUserIdAndDateRange).toHaveBeenCalledWith(
        'user-123',
        dateRange.start,
        dateRange.end
      );
      expect(mockTaskRepository.findScheduledByUserIdAndDateRange).toHaveBeenCalledWith(
        'user-123',
        dateRange.start,
        dateRange.end
      );
    });

    it('should exclude time slots with calendar events', async () => {
      const conflictingEvent: CalendarEvent = {
        id: 'event-123',
        userId: 'user-123',
        externalId: 'ext-123',
        title: 'Existing Meeting',
        description: 'Important meeting',
        startTime: addHours(baseDate, 10), // 10 AM on Monday
        endTime: addHours(baseDate, 11), // 11 AM on Monday
        isFlexible: false,
        travelTimeBefore: 0,
        travelTimeAfter: 0,
        source: 'google',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCalendarEventRepository.findByUserIdAndDateRange.mockResolvedValue([conflictingEvent]);
      mockTaskRepository.findScheduledByUserIdAndDateRange.mockResolvedValue([]);

      const result = await availabilityService.calculateAvailability(mockBookingLink, dateRange);

      // Should not have any slots that conflict with the existing event
      const conflictingSlots = result.filter(slot => 
        slot.startTime < conflictingEvent.endTime && slot.endTime > conflictingEvent.startTime
      );
      expect(conflictingSlots).toHaveLength(0);
    });

    it('should exclude time slots with scheduled tasks', async () => {
      const scheduledTask: Task = {
        id: 'task-123',
        userId: 'user-123',
        projectId: 'project-123',
        title: 'Important Task',
        description: 'Task description',
        duration: 60,
        priority: 'high',
        deadline: addDays(new Date(), 7),
        isHardDeadline: false,
        isBlocking: false,
        dependencies: [],
        dependents: [],
        status: 'scheduled',
        completedMinutes: 0,
        remainingMinutes: 60,
        scheduledSlots: [{
          id: 'slot-123',
          taskId: 'task-123',
          startTime: addHours(baseDate, 14), // 2 PM on Monday
          endTime: addHours(baseDate, 15), // 3 PM on Monday
          duration: 60,
          isConfirmed: true
        }],
        completionHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCalendarEventRepository.findByUserIdAndDateRange.mockResolvedValue([]);
      mockTaskRepository.findScheduledByUserIdAndDateRange.mockResolvedValue([scheduledTask]);

      const result = await availabilityService.calculateAvailability(mockBookingLink, dateRange);

      // Should not have any slots that conflict with the scheduled task
      const taskSlot = scheduledTask.scheduledSlots![0];
      const conflictingSlots = result.filter(slot => 
        slot.startTime < taskSlot.endTime && slot.endTime > taskSlot.startTime
      );
      expect(conflictingSlots).toHaveLength(0);
    });

    it('should respect availability window days of week', async () => {
      const weekendBookingLink = {
        ...mockBookingLink,
        availabilityWindow: {
          ...availabilityWindow,
          daysOfWeek: [0, 6] // Sunday and Saturday only
        }
      };

      const weekendDateRange: DateRange = {
        start: startOfDay(new Date('2024-01-14')), // Sunday
        end: addDays(startOfDay(new Date('2024-01-14')), 6) // Saturday
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCalendarEventRepository.findByUserIdAndDateRange.mockResolvedValue([]);
      mockTaskRepository.findScheduledByUserIdAndDateRange.mockResolvedValue([]);

      const result = await availabilityService.calculateAvailability(
        weekendBookingLink, 
        weekendDateRange
      );

      // Should only have slots on Sunday (day 0) and Saturday (day 6)
      const slotDays = result.map(slot => slot.startTime.getDay());
      const uniqueDays = new Set(slotDays);
      
      expect(uniqueDays.size).toBeLessThanOrEqual(2);
      if (uniqueDays.size > 0) {
        expect([...uniqueDays].every(day => [0, 6].includes(day))).toBe(true);
      }
    });

    it('should include buffer time when requested', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCalendarEventRepository.findByUserIdAndDateRange.mockResolvedValue([]);
      mockTaskRepository.findScheduledByUserIdAndDateRange.mockResolvedValue([]);

      const options: AvailabilityOptions = {
        includeBufferTime: true
      };

      const result = await availabilityService.calculateAvailability(
        mockBookingLink, 
        dateRange, 
        options
      );

      // Each slot should account for the total duration including buffers
      const totalDurationWithBuffer = mockBookingLink.duration + mockBookingLink.bufferBefore + mockBookingLink.bufferAfter;
      
      result.forEach(slot => {
        expect(slot.duration).toBe(totalDurationWithBuffer);
      });
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        availabilityService.calculateAvailability(mockBookingLink, dateRange)
      ).rejects.toThrow('User not found');

      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getOptimizedAvailability', () => {
    const baseDate = startOfDay(new Date('2024-01-15')); // Monday
    const dateRange: DateRange = {
      start: baseDate,
      end: addDays(baseDate, 1) // Tuesday
    };

    it('should return optimized slots with metadata', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCalendarEventRepository.findByUserIdAndDateRange.mockResolvedValue([]);
      mockTaskRepository.findScheduledByUserIdAndDateRange.mockResolvedValue([]);

      const result = await availabilityService.getOptimizedAvailability(mockBookingLink, dateRange);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      if (result.length > 0) {
        const slot = result[0];
        expect(slot).toHaveProperty('isPreferred');
        expect(slot).toHaveProperty('conflictScore');
        expect(slot).toHaveProperty('energyLevel');
        expect(slot).toHaveProperty('recommendation');
        expect(typeof slot.isPreferred).toBe('boolean');
        expect(typeof slot.conflictScore).toBe('number');
        expect(['high', 'medium', 'low']).toContain(slot.energyLevel);
        expect(typeof slot.recommendation).toBe('string');
      }
    });

    it('should prioritize preferred time slots', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCalendarEventRepository.findByUserIdAndDateRange.mockResolvedValue([]);
      mockTaskRepository.findScheduledByUserIdAndDateRange.mockResolvedValue([]);

      const result = await availabilityService.getOptimizedAvailability(mockBookingLink, dateRange);

      if (result.length > 1) {
        // Preferred slots should come first
        const preferredSlots = result.filter(slot => slot.isPreferred);
        const nonPreferredSlots = result.filter(slot => !slot.isPreferred);
        
        if (preferredSlots.length > 0 && nonPreferredSlots.length > 0) {
          const firstPreferredIndex = result.findIndex(slot => slot.isPreferred);
          const firstNonPreferredIndex = result.findIndex(slot => !slot.isPreferred);
          
          expect(firstPreferredIndex).toBeLessThan(firstNonPreferredIndex);
        }
      }
    });

    it('should assign correct energy levels based on user preferences', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCalendarEventRepository.findByUserIdAndDateRange.mockResolvedValue([]);
      mockTaskRepository.findScheduledByUserIdAndDateRange.mockResolvedValue([]);

      const result = await availabilityService.getOptimizedAvailability(mockBookingLink, dateRange);

      // Check that slots in high energy times (9-11 AM) are marked as high energy
      const highEnergySlots = result.filter(slot => {
        const hour = slot.startTime.getHours();
        return hour >= 9 && hour < 11;
      });

      highEnergySlots.forEach(slot => {
        expect(slot.energyLevel).toBe('high');
      });

      // Check that slots in low energy times (2-4 PM) are marked as low energy
      const lowEnergySlots = result.filter(slot => {
        const hour = slot.startTime.getHours();
        return hour >= 14 && hour < 16;
      });

      lowEnergySlots.forEach(slot => {
        expect(slot.energyLevel).toBe('low');
      });
    });
  });

  describe('isTimeSlotAvailable', () => {
    it('should return true for available time slot', async () => {
      const requestedTime = addHours(startOfDay(new Date('2024-01-15')), 10); // 10 AM Monday

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCalendarEventRepository.findByUserIdAndDateRange.mockResolvedValue([]);
      mockTaskRepository.findScheduledByUserIdAndDateRange.mockResolvedValue([]);

      const result = await availabilityService.isTimeSlotAvailable(mockBookingLink, requestedTime);

      expect(result).toBe(true);
    });

    it('should return false for conflicting time slot', async () => {
      const requestedTime = addHours(startOfDay(new Date('2024-01-15')), 10); // 10 AM Monday
      
      const conflictingEvent: CalendarEvent = {
        id: 'event-123',
        userId: 'user-123',
        externalId: 'ext-123',
        title: 'Existing Meeting',
        description: 'Important meeting',
        startTime: requestedTime,
        endTime: addMinutes(requestedTime, 60),
        isFlexible: false,
        travelTimeBefore: 0,
        travelTimeAfter: 0,
        source: 'google',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCalendarEventRepository.findByUserIdAndDateRange.mockResolvedValue([conflictingEvent]);
      mockTaskRepository.findScheduledByUserIdAndDateRange.mockResolvedValue([]);

      const result = await availabilityService.isTimeSlotAvailable(mockBookingLink, requestedTime);

      expect(result).toBe(false);
    });

    it('should return false for time outside availability window', async () => {
      const requestedTime = addHours(startOfDay(new Date('2024-01-13')), 10); // Saturday 10 AM

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCalendarEventRepository.findByUserIdAndDateRange.mockResolvedValue([]);
      mockTaskRepository.findScheduledByUserIdAndDateRange.mockResolvedValue([]);

      const result = await availabilityService.isTimeSlotAvailable(mockBookingLink, requestedTime);

      expect(result).toBe(false);
    });
  });

  describe('getNextAvailableSlot', () => {
    it('should return next available slot after given time', async () => {
      const afterTime = addHours(startOfDay(new Date('2024-01-15')), 12); // 12 PM Monday

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCalendarEventRepository.findByUserIdAndDateRange.mockResolvedValue([]);
      mockTaskRepository.findScheduledByUserIdAndDateRange.mockResolvedValue([]);

      const result = await availabilityService.getNextAvailableSlot(mockBookingLink, afterTime);

      expect(result).toBeDefined();
      if (result) {
        expect(result.startTime).toBeInstanceOf(Date);
        expect(result.startTime.getTime()).toBeGreaterThanOrEqual(afterTime.getTime());
        expect(result.duration).toBe(mockBookingLink.duration);
      }
    });

    it('should return null when no slots available', async () => {
      const afterTime = addDays(new Date(), 100); // Far in the future

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCalendarEventRepository.findByUserIdAndDateRange.mockResolvedValue([]);
      mockTaskRepository.findScheduledByUserIdAndDateRange.mockResolvedValue([]);

      const result = await availabilityService.getNextAvailableSlot(mockBookingLink, afterTime);

      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle booking link with very short duration', async () => {
      const shortBookingLink = {
        ...mockBookingLink,
        duration: 15 // 15 minutes
      };

      const dateRange: DateRange = {
        start: startOfDay(new Date('2024-01-15')),
        end: addDays(startOfDay(new Date('2024-01-15')), 1)
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCalendarEventRepository.findByUserIdAndDateRange.mockResolvedValue([]);
      mockTaskRepository.findScheduledByUserIdAndDateRange.mockResolvedValue([]);

      const result = await availabilityService.calculateAvailability(shortBookingLink, dateRange);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      result.forEach(slot => {
        expect(slot.duration).toBe(15);
      });
    });

    it('should handle booking link with very long duration', async () => {
      const longBookingLink = {
        ...mockBookingLink,
        duration: 240 // 4 hours
      };

      const dateRange: DateRange = {
        start: startOfDay(new Date('2024-01-15')),
        end: addDays(startOfDay(new Date('2024-01-15')), 1)
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCalendarEventRepository.findByUserIdAndDateRange.mockResolvedValue([]);
      mockTaskRepository.findScheduledByUserIdAndDateRange.mockResolvedValue([]);

      const result = await availabilityService.calculateAvailability(longBookingLink, dateRange);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      result.forEach(slot => {
        expect(slot.duration).toBe(240);
      });
    });

    it('should handle user with different timezone', async () => {
      const userInDifferentTimezone = {
        ...mockUser,
        timezone: 'America/Los_Angeles' // PST/PDT
      };

      const dateRange: DateRange = {
        start: startOfDay(new Date('2024-01-15')),
        end: addDays(startOfDay(new Date('2024-01-15')), 1)
      };

      mockUserRepository.findById.mockResolvedValue(userInDifferentTimezone);
      mockCalendarEventRepository.findByUserIdAndDateRange.mockResolvedValue([]);
      mockTaskRepository.findScheduledByUserIdAndDateRange.mockResolvedValue([]);

      const result = await availabilityService.calculateAvailability(mockBookingLink, dateRange);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});