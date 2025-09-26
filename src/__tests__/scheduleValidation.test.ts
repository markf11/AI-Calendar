import { ScheduleValidationService } from '@/services/ScheduleValidationService';
import { ConstraintCollectionService } from '@/services/ConstraintCollectionService';
import { Task } from '@/models/Task';
import { CalendarEvent } from '@/models/CalendarEvent';
import { User } from '@/models/User';
import { ScheduledSlot } from '@/models/types';

// Mock dependencies
jest.mock('@/services/ConstraintCollectionService');

describe('ScheduleValidationService', () => {
  let service: ScheduleValidationService;
  let mockConstraintCollection: jest.Mocked<ConstraintCollectionService>;

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
      maxContinuousWorkTime: 120,
      preferredBreakDuration: 15,
      groupSimilarTasks: true,
      protectFocusTime: false,
      optimizeForEarlyCompletion: true,
      defaultMeetingBuffer: 15,
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

  beforeEach(() => {
    mockConstraintCollection = new ConstraintCollectionService() as jest.Mocked<ConstraintCollectionService>;
    service = new ScheduleValidationService(mockConstraintCollection);

    // Setup default mock
    mockConstraintCollection.collectConstraints.mockResolvedValue({
      constraints: [],
      metadata: { totalConstraints: 0, constraintTypes: [] }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateSchedule', () => {
    it('should validate a valid schedule with no violations', async () => {
      const tasks: Task[] = [{
        id: 'task-1',
        userId: 'user-1',
        title: 'Valid Task',
        duration: 60,
        priority: 'medium',
        isHardDeadline: false,
        isBlocking: false,
        dependencies: [],
        dependents: [],
        status: 'scheduled',
        completedMinutes: 0,
        remainingMinutes: 60,
        scheduledSlots: [{
          id: 'slot-1',
          taskId: 'task-1',
          startTime: new Date('2024-01-15T10:00:00'),
          endTime: new Date('2024-01-15T11:00:00'),
          duration: 60,
          isConfirmed: true
        }],
        completionHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      const calendarEvents: CalendarEvent[] = [];

      const result = await service.validateSchedule(mockUser, tasks, calendarEvents);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });

    it('should detect working hours violations', async () => {
      const tasks: Task[] = [{
        id: 'task-1',
        userId: 'user-1',
        title: 'Early Task',
        duration: 60,
        priority: 'medium',
        isHardDeadline: false,
        isBlocking: false,
        dependencies: [],
        dependents: [],
        status: 'scheduled',
        completedMinutes: 0,
        remainingMinutes: 60,
        scheduledSlots: [{
          id: 'slot-1',
          taskId: 'task-1',
          startTime: new Date('2024-01-15T08:00:00'), // Before working hours
          endTime: new Date('2024-01-15T09:00:00'),
          duration: 60,
          isConfirmed: true
        }],
        completionHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      const result = await service.validateSchedule(mockUser, tasks, []);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain(
        expect.stringContaining('scheduled outside working hours')
      );
      expect(result.suggestions).toContain(
        expect.stringContaining('working hours settings')
      );
    });

    it('should detect lunch break conflicts', async () => {
      const tasks: Task[] = [{
        id: 'task-1',
        userId: 'user-1',
        title: 'Lunch Task',
        duration: 60,
        priority: 'medium',
        isHardDeadline: false,
        isBlocking: false,
        dependencies: [],
        dependents: [],
        status: 'scheduled',
        completedMinutes: 0,
        remainingMinutes: 60,
        scheduledSlots: [{
          id: 'slot-1',
          taskId: 'task-1',
          startTime: new Date('2024-01-15T12:30:00'), // During lunch break
          endTime: new Date('2024-01-15T13:30:00'),
          duration: 60,
          isConfirmed: true
        }],
        completionHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      const result = await service.validateSchedule(mockUser, tasks, []);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain(
        expect.stringContaining('lunch break')
      );
    });

    it('should detect firm event conflicts', async () => {
      const tasks: Task[] = [{
        id: 'task-1',
        userId: 'user-1',
        title: 'Conflicting Task',
        duration: 60,
        priority: 'medium',
        isHardDeadline: false,
        isBlocking: false,
        dependencies: [],
        dependents: [],
        status: 'scheduled',
        completedMinutes: 0,
        remainingMinutes: 60,
        scheduledSlots: [{
          id: 'slot-1',
          taskId: 'task-1',
          startTime: new Date('2024-01-15T10:00:00'),
          endTime: new Date('2024-01-15T11:00:00'),
          duration: 60,
          isConfirmed: true
        }],
        completionHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      const calendarEvents: CalendarEvent[] = [{
        id: 'event-1',
        userId: 'user-1',
        title: 'Important Meeting',
        startTime: new Date('2024-01-15T10:30:00'),
        endTime: new Date('2024-01-15T11:30:00'),
        isFlexible: false,
        source: 'google',
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      const result = await service.validateSchedule(mockUser, tasks, calendarEvents);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain(
        expect.stringContaining('conflicts with firm calendar event')
      );
    });

    it('should detect dependency violations', async () => {
      const tasks: Task[] = [
        {
          id: 'task-1',
          userId: 'user-1',
          title: 'Dependent Task',
          duration: 60,
          priority: 'medium',
          isHardDeadline: false,
          isBlocking: false,
          dependencies: ['task-2'],
          dependents: [],
          status: 'scheduled',
          completedMinutes: 0,
          remainingMinutes: 60,
          scheduledSlots: [{
            id: 'slot-1',
            taskId: 'task-1',
            startTime: new Date('2024-01-15T10:00:00'),
            endTime: new Date('2024-01-15T11:00:00'),
            duration: 60,
            isConfirmed: true
          }],
          completionHistory: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'task-2',
          userId: 'user-1',
          title: 'Prerequisite Task',
          duration: 60,
          priority: 'medium',
          isHardDeadline: false,
          isBlocking: false,
          dependencies: [],
          dependents: ['task-1'],
          status: 'scheduled',
          completedMinutes: 0,
          remainingMinutes: 60,
          scheduledSlots: [{
            id: 'slot-2',
            taskId: 'task-2',
            startTime: new Date('2024-01-15T11:00:00'), // After dependent task
            endTime: new Date('2024-01-15T12:00:00'),
            duration: 60,
            isConfirmed: true
          }],
          completionHistory: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const result = await service.validateSchedule(mockUser, tasks, []);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain(
        expect.stringContaining('scheduled before its dependency')
      );
    });

    it('should detect deadline violations', async () => {
      const tasks: Task[] = [{
        id: 'task-1',
        userId: 'user-1',
        title: 'Late Task',
        duration: 60,
        priority: 'medium',
        deadline: new Date('2024-01-15T10:00:00'),
        isHardDeadline: true,
        isBlocking: false,
        dependencies: [],
        dependents: [],
        status: 'scheduled',
        completedMinutes: 0,
        remainingMinutes: 60,
        scheduledSlots: [{
          id: 'slot-1',
          taskId: 'task-1',
          startTime: new Date('2024-01-15T11:00:00'), // After deadline
          endTime: new Date('2024-01-15T12:00:00'),
          duration: 60,
          isConfirmed: true
        }],
        completionHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      const result = await service.validateSchedule(mockUser, tasks, []);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain(
        expect.stringContaining('scheduled to complete after its hard deadline')
      );
    });

    it('should detect time conflicts between tasks', async () => {
      const tasks: Task[] = [
        {
          id: 'task-1',
          userId: 'user-1',
          title: 'Task 1',
          duration: 60,
          priority: 'medium',
          isHardDeadline: false,
          isBlocking: false,
          dependencies: [],
          dependents: [],
          status: 'scheduled',
          completedMinutes: 0,
          remainingMinutes: 60,
          scheduledSlots: [{
            id: 'slot-1',
            taskId: 'task-1',
            startTime: new Date('2024-01-15T10:00:00'),
            endTime: new Date('2024-01-15T11:00:00'),
            duration: 60,
            isConfirmed: true
          }],
          completionHistory: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'task-2',
          userId: 'user-1',
          title: 'Task 2',
          duration: 60,
          priority: 'medium',
          isHardDeadline: false,
          isBlocking: false,
          dependencies: [],
          dependents: [],
          status: 'scheduled',
          completedMinutes: 0,
          remainingMinutes: 60,
          scheduledSlots: [{
            id: 'slot-2',
            taskId: 'task-2',
            startTime: new Date('2024-01-15T10:30:00'), // Overlaps with task-1
            endTime: new Date('2024-01-15T11:30:00'),
            duration: 60,
            isConfirmed: true
          }],
          completionHistory: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const result = await service.validateSchedule(mockUser, tasks, []);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain(
        expect.stringContaining('Time conflict between tasks')
      );
    });

    it('should detect unscheduled ready tasks', async () => {
      const tasks: Task[] = [{
        id: 'task-1',
        userId: 'user-1',
        title: 'Unscheduled Task',
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
      }];

      const result = await service.validateSchedule(mockUser, tasks, []);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain(
        expect.stringContaining('ready to be scheduled but have no time slots')
      );
    });
  });

  describe('detectConflicts', () => {
    it('should detect no conflicts in a valid schedule', async () => {
      const tasks: Task[] = [{
        id: 'task-1',
        userId: 'user-1',
        title: 'Valid Task',
        duration: 60,
        priority: 'medium',
        isHardDeadline: false,
        isBlocking: false,
        dependencies: [],
        dependents: [],
        status: 'scheduled',
        completedMinutes: 0,
        remainingMinutes: 60,
        scheduledSlots: [{
          id: 'slot-1',
          taskId: 'task-1',
          startTime: new Date('2024-01-15T10:00:00'),
          endTime: new Date('2024-01-15T11:00:00'),
          duration: 60,
          isConfirmed: true
        }],
        completionHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      const result = await service.detectConflicts(mockUser, tasks, []);

      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
    });

    it('should detect time overlap conflicts', async () => {
      const tasks: Task[] = [
        {
          id: 'task-1',
          userId: 'user-1',
          title: 'Task 1',
          duration: 60,
          priority: 'medium',
          isHardDeadline: false,
          isBlocking: false,
          dependencies: [],
          dependents: [],
          status: 'scheduled',
          completedMinutes: 0,
          remainingMinutes: 60,
          scheduledSlots: [{
            id: 'slot-1',
            taskId: 'task-1',
            startTime: new Date('2024-01-15T10:00:00'),
            endTime: new Date('2024-01-15T11:00:00'),
            duration: 60,
            isConfirmed: true
          }],
          completionHistory: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'task-2',
          userId: 'user-1',
          title: 'Task 2',
          duration: 60,
          priority: 'medium',
          isHardDeadline: false,
          isBlocking: false,
          dependencies: [],
          dependents: [],
          status: 'scheduled',
          completedMinutes: 0,
          remainingMinutes: 60,
          scheduledSlots: [{
            id: 'slot-2',
            taskId: 'task-2',
            startTime: new Date('2024-01-15T10:30:00'),
            endTime: new Date('2024-01-15T11:30:00'),
            duration: 60,
            isConfirmed: true
          }],
          completionHistory: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const result = await service.detectConflicts(mockUser, tasks, []);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('time_overlap');
      expect(result.conflicts[0].affectedTasks).toEqual(['task-1', 'task-2']);
      expect(result.recommendations).toContain(
        expect.stringContaining('automatic rescheduling')
      );
    });

    it('should detect impossible deadline scenarios', async () => {
      const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
      
      const tasks: Task[] = [{
        id: 'task-1',
        userId: 'user-1',
        title: 'Impossible Task',
        duration: 480, // 8 hours
        priority: 'medium',
        deadline: futureDate,
        isHardDeadline: true,
        isBlocking: false,
        dependencies: [],
        dependents: [],
        status: 'pending',
        completedMinutes: 0,
        remainingMinutes: 480,
        scheduledSlots: [],
        completionHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      const result = await service.detectConflicts(mockUser, tasks, []);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some(c => c.type === 'deadline_impossible')).toBe(true);
      expect(result.recommendations).toContain(
        expect.stringContaining('deadline')
      );
    });

    it('should detect circular dependencies', async () => {
      const tasks: Task[] = [
        {
          id: 'task-1',
          userId: 'user-1',
          title: 'Task 1',
          duration: 60,
          priority: 'medium',
          isHardDeadline: false,
          isBlocking: false,
          dependencies: ['task-2'],
          dependents: ['task-3'],
          status: 'pending',
          completedMinutes: 0,
          remainingMinutes: 60,
          scheduledSlots: [],
          completionHistory: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'task-2',
          userId: 'user-1',
          title: 'Task 2',
          duration: 60,
          priority: 'medium',
          isHardDeadline: false,
          isBlocking: false,
          dependencies: ['task-3'],
          dependents: ['task-1'],
          status: 'pending',
          completedMinutes: 0,
          remainingMinutes: 60,
          scheduledSlots: [],
          completionHistory: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'task-3',
          userId: 'user-1',
          title: 'Task 3',
          duration: 60,
          priority: 'medium',
          isHardDeadline: false,
          isBlocking: false,
          dependencies: ['task-1'],
          dependents: ['task-2'],
          status: 'pending',
          completedMinutes: 0,
          remainingMinutes: 60,
          scheduledSlots: [],
          completionHistory: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const result = await service.detectConflicts(mockUser, tasks, []);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some(c => c.type === 'dependency_cycle')).toBe(true);
      expect(result.recommendations).toContain(
        expect.stringContaining('dependencies')
      );
    });

    it('should detect overallocation conflicts', async () => {
      // Create many tasks that exceed available working hours
      const tasks: Task[] = Array.from({ length: 20 }, (_, i) => ({
        id: `task-${i + 1}`,
        userId: 'user-1',
        title: `Task ${i + 1}`,
        duration: 480, // 8 hours each
        priority: 'medium' as const,
        isHardDeadline: false,
        isBlocking: false,
        dependencies: [],
        dependents: [],
        status: 'pending' as const,
        completedMinutes: 0,
        remainingMinutes: 480,
        scheduledSlots: [],
        completionHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const result = await service.detectConflicts(mockUser, tasks, []);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some(c => c.description.includes('overallocated'))).toBe(true);
      expect(result.recommendations).toContain(
        expect.stringContaining('reducing task scope')
      );
    });

    it('should handle errors gracefully', async () => {
      mockConstraintCollection.collectConstraints.mockRejectedValue(new Error('Test error'));

      const result = await service.detectConflicts(mockUser, [], []);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].description).toContain('Conflict detection error');
    });
  });

  describe('Edge Cases', () => {
    it('should handle tasks with no scheduled slots', async () => {
      const tasks: Task[] = [{
        id: 'task-1',
        userId: 'user-1',
        title: 'Unscheduled Task',
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
      }];

      const result = await service.validateSchedule(mockUser, tasks, []);

      expect(result.violations).toContain(
        expect.stringContaining('ready to be scheduled')
      );
    });

    it('should handle completed tasks correctly', async () => {
      const tasks: Task[] = [{
        id: 'task-1',
        userId: 'user-1',
        title: 'Completed Task',
        duration: 60,
        priority: 'medium',
        isHardDeadline: false,
        isBlocking: false,
        dependencies: [],
        dependents: [],
        status: 'completed',
        completedMinutes: 60,
        remainingMinutes: 0,
        scheduledSlots: [],
        completionHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      const result = await service.validateSchedule(mockUser, tasks, []);

      // Completed tasks should not cause violations
      expect(result.isValid).toBe(true);
    });

    it('should handle weekend working hours', async () => {
      const userWithWeekends: User = {
        ...mockUser,
        workingHours: {
          ...mockUser.workingHours,
          saturday: { start: '10:00', end: '14:00' },
          sunday: { start: '10:00', end: '14:00' }
        }
      };

      const tasks: Task[] = [{
        id: 'task-1',
        userId: 'user-1',
        title: 'Weekend Task',
        duration: 60,
        priority: 'medium',
        isHardDeadline: false,
        isBlocking: false,
        dependencies: [],
        dependents: [],
        status: 'scheduled',
        completedMinutes: 0,
        remainingMinutes: 60,
        scheduledSlots: [{
          id: 'slot-1',
          taskId: 'task-1',
          startTime: new Date('2024-01-13T11:00:00'), // Saturday
          endTime: new Date('2024-01-13T12:00:00'),
          duration: 60,
          isConfirmed: true
        }],
        completionHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      const result = await service.validateSchedule(userWithWeekends, tasks, []);

      expect(result.isValid).toBe(true);
    });
  });
});