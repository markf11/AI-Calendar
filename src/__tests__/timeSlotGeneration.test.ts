import { TimeSlotGenerationService } from '@/services/TimeSlotGenerationService';
import { ConstraintCollectionService } from '@/services/ConstraintCollectionService';
import { Task } from '@/models/Task';
import { User } from '@/models/User';
import { AvailableSlot } from '@/models/types';
import { ConstraintCollection } from '@/models/Constraint';

// Mock the ConstraintCollectionService
jest.mock('@/services/ConstraintCollectionService');

describe('TimeSlotGenerationService', () => {
  let service: TimeSlotGenerationService;
  let mockConstraintService: jest.Mocked<ConstraintCollectionService>;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    timezone: 'America/New_York',
    workingHours: {
      monday: { start: '09:00', end: '17:00' },
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' },
      lunchBreak: { start: '12:00', end: '13:00' }
    },
    preferences: {
      maxContinuousWorkTime: 120, // 2 hours
      preferredBreakDuration: 15,
      groupSimilarTasks: true,
      protectFocusTime: true,
      optimizeForEarlyCompletion: false,
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
    connectedCalendars: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockTask: Task = {
    id: 'task-1',
    userId: 'user-1',
    title: 'Test Task',
    duration: 60,
    priority: 'medium',
    isHardDeadline: false,
    isBlocking: false,
    dependencies: [],
    dependents: [],
    status: 'pending',
    completedMinutes: 0,
    remainingMinutes: 60,
    scheduledSlots: [],
    completionHistory: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockConstraints: ConstraintCollection = {
    userId: 'user-1',
    constraints: [
      {
        id: 'wh-1',
        type: 'working_hours',
        priority: 100,
        description: 'Working hours Monday',
        dayOfWeek: 1, // Monday
        timeRange: { start: '09:00', end: '17:00' },
        timezone: 'America/New_York'
      } as any,
      {
        id: 'lb-1',
        type: 'lunch_break',
        priority: 90,
        description: 'Lunch break',
        timeRange: { start: '12:00', end: '13:00' },
        timezone: 'America/New_York'
      } as any
    ],
    collectedAt: new Date(),
    validFrom: new Date(),
    validUntil: new Date()
  };

  beforeEach(() => {
    mockConstraintService = new ConstraintCollectionService({} as any, {} as any, {} as any) as jest.Mocked<ConstraintCollectionService>;
    service = new TimeSlotGenerationService(mockConstraintService);

    // Setup default mock
    mockConstraintService.collectConstraints.mockResolvedValue(mockConstraints);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAvailableSlots', () => {
    it('should generate available slots for a date range', async () => {
      const startDate = new Date('2024-01-15T00:00:00Z'); // Monday
      const endDate = new Date('2024-01-15T23:59:59Z');

      const slots = await service.generateAvailableSlots('user-1', startDate, endDate);

      expect(mockConstraintService.collectConstraints).toHaveBeenCalledWith(
        'user-1',
        startDate,
        endDate
      );
      expect(slots).toBeDefined();
      expect(Array.isArray(slots)).toBe(true);
    });

    it('should respect minimum slot duration', async () => {
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-15T23:59:59Z');
      const minSlotDuration = 30;

      const slots = await service.generateAvailableSlots('user-1', startDate, endDate, minSlotDuration);

      // All slots should be at least 30 minutes
      slots.forEach(slot => {
        expect(slot.duration).toBeGreaterThanOrEqual(minSlotDuration);
      });
    });

    it('should handle multiple days', async () => {
      const startDate = new Date('2024-01-15T00:00:00Z'); // Monday
      const endDate = new Date('2024-01-17T23:59:59Z'); // Wednesday

      // Add working hours for multiple days
      const multiDayConstraints = {
        ...mockConstraints,
        constraints: [
          ...mockConstraints.constraints,
          {
            id: 'wh-2',
            type: 'working_hours',
            priority: 100,
            description: 'Working hours Tuesday',
            dayOfWeek: 2, // Tuesday
            timeRange: { start: '09:00', end: '17:00' },
            timezone: 'America/New_York'
          } as any,
          {
            id: 'wh-3',
            type: 'working_hours',
            priority: 100,
            description: 'Working hours Wednesday',
            dayOfWeek: 3, // Wednesday
            timeRange: { start: '09:00', end: '17:00' },
            timezone: 'America/New_York'
          } as any
        ]
      };

      mockConstraintService.collectConstraints.mockResolvedValue(multiDayConstraints);

      const slots = await service.generateAvailableSlots('user-1', startDate, endDate);

      expect(slots.length).toBeGreaterThan(0);
      // Should have slots across multiple days
      const uniqueDays = new Set(slots.map(slot => slot.startTime.getDate()));
      expect(uniqueDays.size).toBeGreaterThan(1);
    });

    it('should return empty array for days without working hours', async () => {
      const startDate = new Date('2024-01-13T00:00:00Z'); // Saturday
      const endDate = new Date('2024-01-14T23:59:59Z'); // Sunday

      // No working hours constraints for weekends
      const weekendConstraints = {
        ...mockConstraints,
        constraints: []
      };

      mockConstraintService.collectConstraints.mockResolvedValue(weekendConstraints);

      const slots = await service.generateAvailableSlots('user-1', startDate, endDate);

      expect(slots).toHaveLength(0);
    });
  });

  describe('generateTaskSlots', () => {
    const mockAvailableSlots: AvailableSlot[] = [
      {
        startTime: new Date('2024-01-15T09:00:00Z'),
        endTime: new Date('2024-01-15T12:00:00Z'),
        duration: 180 // 3 hours
      },
      {
        startTime: new Date('2024-01-15T13:00:00Z'),
        endTime: new Date('2024-01-15T17:00:00Z'),
        duration: 240 // 4 hours
      }
    ];

    it('should find slots for blocking tasks', async () => {
      const blockingTask = { ...mockTask, isBlocking: true, duration: 120 }; // 2 hours

      const taskSlots = await service.generateTaskSlots(
        blockingTask,
        mockUser,
        mockAvailableSlots,
        mockConstraints
      );

      expect(taskSlots.length).toBeGreaterThan(0);
      // All slots should be able to fit the entire task
      taskSlots.forEach(slot => {
        expect(slot.duration).toBeGreaterThanOrEqual(120);
      });
    });

    it('should generate chunked slots for non-blocking tasks', async () => {
      const nonBlockingTask = { ...mockTask, isBlocking: false, duration: 300 }; // 5 hours

      const taskSlots = await service.generateTaskSlots(
        nonBlockingTask,
        mockUser,
        mockAvailableSlots,
        mockConstraints
      );

      expect(taskSlots.length).toBeGreaterThan(0);
      // Should be able to chunk the task across multiple slots
      const totalDuration = taskSlots.reduce((sum, slot) => sum + slot.duration, 0);
      expect(totalDuration).toBeLessThanOrEqual(300);
    });

    it('should respect max continuous work time for chunking', async () => {
      const longTask = { ...mockTask, isBlocking: false, duration: 300 }; // 5 hours
      const userWithShortWorkTime = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          maxContinuousWorkTime: 60 // 1 hour max
        }
      };

      const taskSlots = await service.generateTaskSlots(
        longTask,
        userWithShortWorkTime,
        mockAvailableSlots,
        mockConstraints
      );

      // No individual chunk should exceed max continuous work time
      taskSlots.forEach(slot => {
        expect(slot.duration).toBeLessThanOrEqual(60);
      });
    });

    it('should not create chunks smaller than 15 minutes', async () => {
      const shortTask = { ...mockTask, isBlocking: false, duration: 10 }; // 10 minutes

      const taskSlots = await service.generateTaskSlots(
        shortTask,
        mockUser,
        mockAvailableSlots,
        mockConstraints
      );

      // Should either have no slots or slots of at least 15 minutes
      taskSlots.forEach(slot => {
        expect(slot.duration).toBeGreaterThanOrEqual(15);
      });
    });
  });

  describe('applyBufferTime', () => {
    const testSlots: AvailableSlot[] = [
      {
        startTime: new Date('2024-01-15T09:00:00Z'),
        endTime: new Date('2024-01-15T10:00:00Z'),
        duration: 60
      }
    ];

    it('should apply buffer time to slots', () => {
      const bufferedSlots = service.applyBufferTime(testSlots, 5, 5); // 5 minutes before and after

      expect(bufferedSlots).toHaveLength(1);
      expect(bufferedSlots[0].duration).toBe(50); // 60 - 5 - 5
      expect(bufferedSlots[0].startTime.getTime()).toBeGreaterThan(testSlots[0].startTime.getTime());
      expect(bufferedSlots[0].endTime.getTime()).toBeLessThan(testSlots[0].endTime.getTime());
    });

    it('should filter out slots that become too small after buffering', () => {
      const smallSlots: AvailableSlot[] = [
        {
          startTime: new Date('2024-01-15T09:00:00Z'),
          endTime: new Date('2024-01-15T09:20:00Z'),
          duration: 20
        }
      ];

      const bufferedSlots = service.applyBufferTime(smallSlots, 10, 10); // 20 minutes buffer total

      expect(bufferedSlots).toHaveLength(0); // Slot becomes too small
    });

    it('should handle zero buffer time', () => {
      const bufferedSlots = service.applyBufferTime(testSlots, 0, 0);

      expect(bufferedSlots).toHaveLength(1);
      expect(bufferedSlots[0]).toEqual(testSlots[0]);
    });
  });

  describe('filterSlotsByEnergyPreferences', () => {
    const testSlots: AvailableSlot[] = [
      {
        startTime: new Date('2024-01-15T09:30:00Z'), // High energy time
        endTime: new Date('2024-01-15T10:30:00Z'),
        duration: 60
      },
      {
        startTime: new Date('2024-01-15T14:30:00Z'), // Low energy time
        endTime: new Date('2024-01-15T15:30:00Z'),
        duration: 60
      },
      {
        startTime: new Date('2024-01-15T16:30:00Z'), // Outside energy preferences
        endTime: new Date('2024-01-15T17:30:00Z'),
        duration: 60
      }
    ];

    it('should filter slots for high energy tasks', () => {
      const highEnergyTask = { ...mockTask, priority: 'critical' as const };

      const filteredSlots = service.filterSlotsByEnergyPreferences(
        testSlots,
        highEnergyTask,
        mockUser
      );

      expect(filteredSlots).toHaveLength(1);
      expect(filteredSlots[0].startTime.getHours()).toBe(9); // Should be the high energy slot
    });

    it('should filter slots for low energy tasks', () => {
      const lowEnergyTask = { ...mockTask, priority: 'low' as const };

      const filteredSlots = service.filterSlotsByEnergyPreferences(
        testSlots,
        lowEnergyTask,
        mockUser
      );

      expect(filteredSlots).toHaveLength(1);
      expect(filteredSlots[0].startTime.getHours()).toBe(14); // Should be the low energy slot
    });

    it('should allow all slots for medium priority tasks', () => {
      const mediumEnergyTask = { ...mockTask, priority: 'medium' as const };

      const filteredSlots = service.filterSlotsByEnergyPreferences(
        testSlots,
        mediumEnergyTask,
        mockUser
      );

      expect(filteredSlots).toHaveLength(3); // All slots should be available
    });
  });

  describe('optimizeSlotSelection', () => {
    const testSlots: AvailableSlot[] = [
      {
        startTime: new Date('2024-01-15T14:00:00Z'), // Afternoon
        endTime: new Date('2024-01-15T15:00:00Z'),
        duration: 60
      },
      {
        startTime: new Date('2024-01-15T09:00:00Z'), // Morning
        endTime: new Date('2024-01-15T11:00:00Z'),
        duration: 120
      }
    ];

    it('should prioritize earlier slots for high priority tasks', () => {
      const highPriorityTask = { ...mockTask, priority: 'critical' as const };

      const optimizedSlots = service.optimizeSlotSelection(
        testSlots,
        highPriorityTask,
        mockUser
      );

      expect(optimizedSlots).toHaveLength(2);
      // Morning slot should come first for high priority task
      expect(optimizedSlots[0].startTime.getHours()).toBe(9);
    });

    it('should prioritize longer slots for better focus', () => {
      const optimizedSlots = service.optimizeSlotSelection(
        testSlots,
        mockTask,
        mockUser
      );

      expect(optimizedSlots).toHaveLength(2);
      // Longer slot should be prioritized
      expect(optimizedSlots[0].duration).toBeGreaterThan(optimizedSlots[1].duration);
    });

    it('should apply energy filtering when appropriate', () => {
      const highEnergyTask = { ...mockTask, priority: 'critical' as const };

      const optimizedSlots = service.optimizeSlotSelection(
        testSlots,
        highEnergyTask,
        mockUser
      );

      // Should only include the morning slot (high energy time)
      expect(optimizedSlots).toHaveLength(1);
      expect(optimizedSlots[0].startTime.getHours()).toBe(9);
    });
  });

  describe('calculateTotalAvailableTime', () => {
    it('should calculate total available time and utilization', async () => {
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-15T23:59:59Z');

      // Mock generateAvailableSlots to return predictable results
      const mockSlots: AvailableSlot[] = [
        {
          startTime: new Date('2024-01-15T09:00:00Z'),
          endTime: new Date('2024-01-15T12:00:00Z'),
          duration: 180
        },
        {
          startTime: new Date('2024-01-15T13:00:00Z'),
          endTime: new Date('2024-01-15T17:00:00Z'),
          duration: 240
        }
      ];

      jest.spyOn(service, 'generateAvailableSlots').mockResolvedValue(mockSlots);

      const result = await service.calculateTotalAvailableTime('user-1', startDate, endDate);

      expect(result.totalMinutes).toBe(420); // 180 + 240
      expect(result.availableSlots).toEqual(mockSlots);
      expect(result.utilizationByDay).toHaveLength(1);
      expect(result.utilizationByDay[0].availableMinutes).toBe(420);
    });

    it('should handle multiple days correctly', async () => {
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-16T23:59:59Z');

      const mockSlots: AvailableSlot[] = [
        {
          startTime: new Date('2024-01-15T09:00:00Z'),
          endTime: new Date('2024-01-15T12:00:00Z'),
          duration: 180
        },
        {
          startTime: new Date('2024-01-16T09:00:00Z'),
          endTime: new Date('2024-01-16T12:00:00Z'),
          duration: 180
        }
      ];

      jest.spyOn(service, 'generateAvailableSlots').mockResolvedValue(mockSlots);

      const result = await service.calculateTotalAvailableTime('user-1', startDate, endDate);

      expect(result.totalMinutes).toBe(360); // 180 + 180
      expect(result.utilizationByDay).toHaveLength(2);
    });
  });
});