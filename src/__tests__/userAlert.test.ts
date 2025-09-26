import { UserAlertService } from '@/services/UserAlertService';
import { ScheduleValidationService } from '@/services/ScheduleValidationService';
import { User } from '@/models/User';
import { Task } from '@/models/Task';

// Mock dependencies
jest.mock('@/services/ScheduleValidationService');

describe('UserAlertService', () => {
  let service: UserAlertService;
  let mockScheduleValidation: jest.Mocked<ScheduleValidationService>;

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
      friday: { start: '09:00', end: '17:00' }
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
    mockScheduleValidation = new ScheduleValidationService(null as any) as jest.Mocked<ScheduleValidationService>;
    service = new UserAlertService(mockScheduleValidation);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSchedulingAlert', () => {
    it('should generate success alert for valid schedule', async () => {
      mockScheduleValidation.validateSchedule.mockResolvedValue({
        isValid: true,
        violations: [],
        suggestions: []
      });

      mockScheduleValidation.detectConflicts.mockResolvedValue({
        hasConflicts: false,
        conflicts: [],
        recommendations: []
      });

      const result = await service.generateSchedulingAlert(mockUser, [], []);

      expect(result.severity).toBe('info');
      expect(result.title).toBe('Schedule Validated Successfully');
      expect(result.affectedTasks).toHaveLength(0);
    });

    it('should generate error alert for critical issues', async () => {
      mockScheduleValidation.validateSchedule.mockResolvedValue({
        isValid: false,
        violations: ['Task conflicts with firm calendar event'],
        suggestions: ['Reschedule conflicting tasks']
      });

      mockScheduleValidation.detectConflicts.mockResolvedValue({
        hasConflicts: true,
        conflicts: [{
          type: 'deadline_impossible',
          description: 'Task cannot meet deadline',
          affectedTasks: ['task-1'],
          suggestedResolution: 'Extend deadline'
        }],
        recommendations: ['Review deadlines']
      });

      const result = await service.generateSchedulingAlert(mockUser, [], []);

      expect(result.severity).toBe('error');
      expect(result.title).toBe('Critical Scheduling Issues Detected');
      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          title: 'Address Deadline Issues',
          priority: 'critical'
        })
      );
    });

    it('should handle validation errors gracefully', async () => {
      mockScheduleValidation.validateSchedule.mockRejectedValue(new Error('Validation failed'));

      const result = await service.generateSchedulingAlert(mockUser, [], []);

      expect(result.severity).toBe('error');
      expect(result.title).toBe('Schedule Validation Error');
      expect(result.message).toContain('Validation failed');
    });
  });

  describe('generateImpossibleScheduleAlert', () => {
    it('should generate alert for impossible scheduling scenarios', () => {
      const impossibleTasks: Task[] = [{
        id: 'task-1',
        userId: 'user-1',
        title: 'Impossible Task',
        duration: 480,
        priority: 'high',
        deadline: new Date(),
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

      const result = service.generateImpossibleScheduleAlert(
        'user-1',
        impossibleTasks,
        'Insufficient time before deadline'
      );

      expect(result.severity).toBe('error');
      expect(result.title).toBe('Impossible Schedule Detected');
      expect(result.affectedTasks).toEqual(['task-1']);
      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          title: 'Extend Deadlines',
          priority: 'high'
        })
      );
    });
  });

  describe('generateDeadlineConflictAlert', () => {
    it('should generate alert for deadline conflicts', () => {
      const conflictingTasks: Task[] = [
        {
          id: 'task-1',
          userId: 'user-1',
          title: 'Hard Deadline Task',
          duration: 240,
          priority: 'high',
          deadline: new Date(),
          isHardDeadline: true,
          isBlocking: false,
          dependencies: [],
          dependents: [],
          status: 'pending',
          completedMinutes: 0,
          remainingMinutes: 240,
          scheduledSlots: [],
          completionHistory: [],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'task-2',
          userId: 'user-1',
          title: 'Soft Deadline Task',
          duration: 120,
          priority: 'medium',
          deadline: new Date(),
          isHardDeadline: false,
          isBlocking: false,
          dependencies: [],
          dependents: [],
          status: 'pending',
          completedMinutes: 0,
          remainingMinutes: 120,
          scheduledSlots: [],
          completionHistory: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const result = service.generateDeadlineConflictAlert('user-1', conflictingTasks);

      expect(result.severity).toBe('error'); // Has hard deadline tasks
      expect(result.title).toBe('Deadline Conflicts Detected');
      expect(result.affectedTasks).toEqual(['task-1', 'task-2']);
      expect(result.metadata.hardDeadlineCount).toBe(1);
      expect(result.metadata.softDeadlineCount).toBe(1);
    });
  });

  describe('generateOverallocationAlert', () => {
    it('should generate alert for schedule overallocation', () => {
      const overallocatedTasks: Task[] = Array.from({ length: 5 }, (_, i) => ({
        id: `task-${i + 1}`,
        userId: 'user-1',
        title: `Task ${i + 1}`,
        duration: 480,
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

      const result = service.generateOverallocationAlert(
        'user-1',
        40, // Total hours
        30, // Available hours
        overallocatedTasks
      );

      expect(result.severity).toBe('warning'); // 33% overallocation
      expect(result.title).toBe('Schedule Overallocated');
      expect(result.message).toContain('33% overallocated');
      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          title: 'Reduce Task Scope',
          priority: 'high'
        })
      );
    });

    it('should generate error severity for severe overallocation', () => {
      const result = service.generateOverallocationAlert(
        'user-1',
        60, // Total hours
        30, // Available hours (100% overallocation)
        []
      );

      expect(result.severity).toBe('error');
      expect(result.metadata.overallocationPercentage).toBe(100);
    });
  });
});