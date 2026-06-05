// @ts-nocheck
import { ReschedulingTriggerService, RescheduleTrigger, ReschedulingPriority } from '@/services/ReschedulingTriggerService';
import { ConstraintSatisfactionSolver } from '@/services/ConstraintSatisfactionSolver';
import { ConstraintCollectionService } from '@/services/ConstraintCollectionService';
import { TimeSlotGenerationService } from '@/services/TimeSlotGenerationService';
import { PriorityScoringService } from '@/services/PriorityScoringService';
import { TaskRepository } from '@/repositories/TaskRepository';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { Task } from '@/models/Task';
import { CalendarEvent } from '@/models/CalendarEvent';
import { User } from '@/models/User';

// Mock dependencies
jest.mock('@/services/ConstraintSatisfactionSolver');
jest.mock('@/services/ConstraintCollectionService');
jest.mock('@/services/TimeSlotGenerationService');
jest.mock('@/repositories/TaskRepository');
jest.mock('@/repositories/CalendarEventRepository');
jest.mock('@/repositories/UserRepository');

describe('ReschedulingTriggerService', () => {
  let service: ReschedulingTriggerService;
  let mockConstraintSolver: jest.Mocked<ConstraintSatisfactionSolver>;
  let mockConstraintCollection: jest.Mocked<ConstraintCollectionService>;
  let mockTimeSlotGeneration: jest.Mocked<TimeSlotGenerationService>;
  let mockTaskRepository: jest.Mocked<TaskRepository>;
  let mockCalendarEventRepository: jest.Mocked<CalendarEventRepository>;
  let mockUserRepository: jest.Mocked<UserRepository>;

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

  beforeEach(() => {
    // Create mocked instances
    mockTimeSlotGeneration = new TimeSlotGenerationService() as jest.Mocked<TimeSlotGenerationService>;
    mockConstraintSolver = new ConstraintSatisfactionSolver(
      PriorityScoringService,
      mockTimeSlotGeneration
    ) as jest.Mocked<ConstraintSatisfactionSolver>;
    mockConstraintCollection = new ConstraintCollectionService() as jest.Mocked<ConstraintCollectionService>;
    mockTaskRepository = new TaskRepository() as jest.Mocked<TaskRepository>;
    mockCalendarEventRepository = new CalendarEventRepository() as jest.Mocked<CalendarEventRepository>;
    mockUserRepository = new UserRepository() as jest.Mocked<UserRepository>;

    // Create service instance
    service = new ReschedulingTriggerService(
      mockConstraintSolver,
      mockConstraintCollection,
      mockTimeSlotGeneration,
      mockTaskRepository,
      mockCalendarEventRepository,
      mockUserRepository
    );

    // Setup default mocks
    mockUserRepository.findById.mockResolvedValue(mockUser);
    mockTaskRepository.findByUser.mockResolvedValue([mockTask]);
    mockCalendarEventRepository.findByUser.mockResolvedValue([]);
    mockConstraintCollection.collectConstraints.mockResolvedValue({
      constraints: [],
      metadata: { totalConstraints: 0, constraintTypes: [] }
    });
    mockTimeSlotGeneration.generateAvailableSlots.mockResolvedValue([]);
    mockConstraintSolver.solve.mockResolvedValue({
      success: true,
      scheduledTasks: [],
      unscheduledTasks: [],
      violations: [],
      optimizationScore: 100,
      solvingTimeMs: 50,
      metadata: {
        totalTasks: 1,
        schedulableTasks: 1,
        availableSlots: 0,
        constraintsChecked: 0,
        backtrackingSteps: 0
      }
    });
    mockTaskRepository.updateScheduledSlots.mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clear any pending timers
    service.clearUserJobs('user-1');
  });

  describe('Event Listeners and Triggers', () => {
    it('should trigger rescheduling when task is created', async () => {
      const eventSpy = jest.fn();
      service.on('rescheduling:queued', eventSpy);

      service.emit('task:created', { userId: 'user-1', task: mockTask });

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(eventSpy).toHaveBeenCalledWith({
        userId: 'user-1',
        trigger: expect.objectContaining({
          type: 'task_created',
          entityId: 'task-1'
        }),
        priority: 'normal'
      });
    });

    it('should trigger high priority rescheduling when task is completed', async () => {
      const eventSpy = jest.fn();
      service.on('rescheduling:queued', eventSpy);

      service.emit('task:completed', { userId: 'user-1', taskId: 'task-1' });

      // Wait for debounce (should be shorter for high priority)
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(eventSpy).toHaveBeenCalledWith({
        userId: 'user-1',
        trigger: expect.objectContaining({
          type: 'task_completed',
          entityId: 'task-1'
        }),
        priority: 'high'
      });
    });

    it('should trigger high priority rescheduling for calendar event changes', async () => {
      const eventSpy = jest.fn();
      service.on('rescheduling:queued', eventSpy);

      const mockEvent: CalendarEvent = {
        id: 'event-1',
        userId: 'user-1',
        title: 'Meeting',
        startTime: new Date(),
        endTime: new Date(),
        isFlexible: false,
        source: 'google',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      service.emit('calendar:event:created', { userId: 'user-1', event: mockEvent });

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(eventSpy).toHaveBeenCalledWith({
        userId: 'user-1',
        trigger: expect.objectContaining({
          type: 'calendar_event_created',
          entityId: 'event-1'
        }),
        priority: 'high'
      });
    });

    it('should determine high priority for critical task updates', async () => {
      const eventSpy = jest.fn();
      service.on('rescheduling:queued', eventSpy);

      service.emit('task:updated', {
        userId: 'user-1',
        taskId: 'task-1',
        changes: { deadline: new Date(), priority: 'critical' }
      });

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(eventSpy).toHaveBeenCalledWith({
        userId: 'user-1',
        trigger: expect.objectContaining({
          type: 'task_updated',
          entityId: 'task-1'
        }),
        priority: 'high'
      });
    });

    it('should use normal priority for non-critical task updates', async () => {
      const eventSpy = jest.fn();
      service.on('rescheduling:queued', eventSpy);

      service.emit('task:updated', {
        userId: 'user-1',
        taskId: 'task-1',
        changes: { title: 'New Title', description: 'New Description' }
      });

      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(eventSpy).toHaveBeenCalledWith({
        userId: 'user-1',
        trigger: expect.objectContaining({
          type: 'task_updated',
          entityId: 'task-1'
        }),
        priority: 'normal'
      });
    });
  });

  describe('Debouncing and Queue Management', () => {
    it('should debounce multiple rapid triggers for the same user', async () => {
      const eventSpy = jest.fn();
      service.on('rescheduling:started', eventSpy);

      // Trigger multiple events rapidly
      service.emit('task:created', { userId: 'user-1', task: mockTask });
      service.emit('task:updated', { userId: 'user-1', taskId: 'task-1', changes: { title: 'Updated' } });
      service.emit('task:created', { userId: 'user-1', task: { ...mockTask, id: 'task-2' } });

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should only process once due to debouncing
      expect(eventSpy).toHaveBeenCalledTimes(1);
    });

    it('should process high priority triggers faster', async () => {
      const eventSpy = jest.fn();
      service.on('rescheduling:started', eventSpy);

      service.emit('task:completed', { userId: 'user-1', taskId: 'task-1' });

      // High priority should process in 500ms
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(eventSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple users independently', async () => {
      const eventSpy = jest.fn();
      service.on('rescheduling:started', eventSpy);

      mockUserRepository.findById.mockImplementation(async (userId) => {
        return { ...mockUser, id: userId };
      });

      service.emit('task:created', { userId: 'user-1', task: mockTask });
      service.emit('task:created', { userId: 'user-2', task: { ...mockTask, userId: 'user-2' } });

      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(eventSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Rescheduling Process', () => {
    it('should successfully perform rescheduling', async () => {
      const completedSpy = jest.fn();
      service.on('rescheduling:completed', completedSpy);

      await service.triggerRescheduling('user-1', {
        type: 'manual_trigger',
        entityId: 'user-1',
        timestamp: new Date()
      }, 'high');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-1');
      expect(mockTaskRepository.findByUser).toHaveBeenCalledWith('user-1', {
        status: ['pending', 'scheduled', 'in_progress', 'blocked']
      });
      expect(mockConstraintSolver.solve).toHaveBeenCalled();
      expect(completedSpy).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-1',
        result: expect.objectContaining({ success: true })
      }));
    });

    it('should handle rescheduling failures with retries', async () => {
      const failedSpy = jest.fn();
      service.on('rescheduling:failed', failedSpy);

      mockConstraintSolver.solve.mockRejectedValue(new Error('Solver failed'));

      await service.triggerRescheduling('user-1', {
        type: 'manual_trigger',
        entityId: 'user-1',
        timestamp: new Date()
      }, 'high');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(failedSpy).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-1',
        error: 'Solver failed',
        retryCount: 1
      }));
    });

    it('should stop retrying after max retries', async () => {
      const maxRetriesSpy = jest.fn();
      service.on('rescheduling:max_retries_exceeded', maxRetriesSpy);

      mockConstraintSolver.solve.mockRejectedValue(new Error('Persistent failure'));

      await service.triggerRescheduling('user-1', {
        type: 'manual_trigger',
        entityId: 'user-1',
        timestamp: new Date()
      }, 'high');

      // Wait for all retries to complete
      await new Promise(resolve => setTimeout(resolve, 10000));

      expect(maxRetriesSpy).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-1'
      }));
    }, 15000);

    it('should handle user not found error', async () => {
      const failedSpy = jest.fn();
      service.on('rescheduling:failed', failedSpy);

      mockUserRepository.findById.mockResolvedValue(null);

      await service.triggerRescheduling('user-1', {
        type: 'manual_trigger',
        entityId: 'user-1',
        timestamp: new Date()
      }, 'high');

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(failedSpy).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user-1',
        error: 'User not found: user-1'
      }));
    });
  });

  describe('Queue Status and Management', () => {
    it('should provide accurate queue status', () => {
      service.triggerRescheduling('user-1', {
        type: 'task_created',
        entityId: 'task-1',
        timestamp: new Date()
      });

      service.triggerRescheduling('user-2', {
        type: 'task_updated',
        entityId: 'task-2',
        timestamp: new Date()
      });

      const status = service.getQueueStatus();

      expect(status.totalJobs).toBe(2);
      expect(status.pendingJobs).toBe(2);
      expect(status.processingJobs).toBe(0);
      expect(status.failedJobs).toBe(0);
    });

    it('should get user job status', () => {
      service.triggerRescheduling('user-1', {
        type: 'task_created',
        entityId: 'task-1',
        timestamp: new Date()
      });

      const jobStatus = service.getUserJobStatus('user-1');

      expect(jobStatus).toMatchObject({
        userId: 'user-1',
        status: 'pending',
        retryCount: 0
      });
    });

    it('should clear user jobs', () => {
      service.triggerRescheduling('user-1', {
        type: 'task_created',
        entityId: 'task-1',
        timestamp: new Date()
      });

      expect(service.getUserJobStatus('user-1')).not.toBeNull();

      service.clearUserJobs('user-1');

      expect(service.getUserJobStatus('user-1')).toBeNull();
    });

    it('should process all pending jobs manually', async () => {
      const startedSpy = jest.fn();
      service.on('rescheduling:started', startedSpy);

      service.triggerRescheduling('user-1', {
        type: 'task_created',
        entityId: 'task-1',
        timestamp: new Date()
      });

      service.triggerRescheduling('user-2', {
        type: 'task_created',
        entityId: 'task-2',
        timestamp: new Date()
      });

      mockUserRepository.findById.mockImplementation(async (userId) => {
        return { ...mockUser, id: userId };
      });

      await service.processAllPendingJobs();

      expect(startedSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Dependency Change Handling', () => {
    it('should trigger rescheduling when dependency is added', async () => {
      const eventSpy = jest.fn();
      service.on('rescheduling:queued', eventSpy);

      service.emit('task:dependency:added', {
        userId: 'user-1',
        taskId: 'task-1',
        dependencyId: 'task-2'
      });

      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(eventSpy).toHaveBeenCalledWith({
        userId: 'user-1',
        trigger: expect.objectContaining({
          type: 'dependency_changed',
          entityId: 'task-1',
          metadata: { dependencyId: 'task-2' }
        }),
        priority: 'normal'
      });
    });

    it('should trigger rescheduling when dependency is removed', async () => {
      const eventSpy = jest.fn();
      service.on('rescheduling:queued', eventSpy);

      service.emit('task:dependency:removed', {
        userId: 'user-1',
        taskId: 'task-1',
        dependencyId: 'task-2'
      });

      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(eventSpy).toHaveBeenCalledWith({
        userId: 'user-1',
        trigger: expect.objectContaining({
          type: 'dependency_changed',
          entityId: 'task-1'
        }),
        priority: 'normal'
      });
    });
  });

  describe('User Preferences Updates', () => {
    it('should trigger rescheduling when user preferences are updated', async () => {
      const eventSpy = jest.fn();
      service.on('rescheduling:queued', eventSpy);

      service.emit('user:preferences:updated', {
        userId: 'user-1',
        changes: { groupSimilarTasks: false }
      });

      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(eventSpy).toHaveBeenCalledWith({
        userId: 'user-1',
        trigger: expect.objectContaining({
          type: 'user_preferences_updated',
          entityId: 'user-1'
        }),
        priority: 'normal'
      });
    });

    it('should trigger high priority rescheduling when working hours are updated', async () => {
      const eventSpy = jest.fn();
      service.on('rescheduling:queued', eventSpy);

      service.emit('user:working_hours:updated', { userId: 'user-1' });

      await new Promise(resolve => setTimeout(resolve, 600));

      expect(eventSpy).toHaveBeenCalledWith({
        userId: 'user-1',
        trigger: expect.objectContaining({
          type: 'working_hours_updated',
          entityId: 'user-1'
        }),
        priority: 'high'
      });
    });
  });
});