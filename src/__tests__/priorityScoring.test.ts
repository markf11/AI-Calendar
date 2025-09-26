import { PriorityScoringService } from '@/services/PriorityScoringService';
import { Task } from '@/models/Task';
import { User } from '@/models/User';
import { Priority } from '@/models/types';

describe('PriorityScoringService', () => {
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

  const createMockTask = (overrides: Partial<Task> = {}): Task => ({
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
    updatedAt: new Date(),
    ...overrides
  });

  describe('getBasePriorityScore', () => {
    it('should return correct base scores for each priority level', () => {
      expect(PriorityScoringService.getBasePriorityScore('critical')).toBe(80);
      expect(PriorityScoringService.getBasePriorityScore('high')).toBe(60);
      expect(PriorityScoringService.getBasePriorityScore('medium')).toBe(30);
      expect(PriorityScoringService.getBasePriorityScore('low')).toBe(10);
    });

    it('should maintain priority hierarchy', () => {
      const critical = PriorityScoringService.getBasePriorityScore('critical');
      const high = PriorityScoringService.getBasePriorityScore('high');
      const medium = PriorityScoringService.getBasePriorityScore('medium');
      const low = PriorityScoringService.getBasePriorityScore('low');

      expect(critical).toBeGreaterThan(high);
      expect(high).toBeGreaterThan(medium);
      expect(medium).toBeGreaterThan(low);
    });
  });

  describe('calculateDeadlineUrgencyScore', () => {
    const currentTime = new Date('2024-01-15T10:00:00Z');

    it('should calculate higher urgency for closer deadlines', () => {
      const overdueDeadline = new Date('2024-01-14T10:00:00Z'); // 1 day ago
      const urgentDeadline = new Date('2024-01-15T22:00:00Z'); // 12 hours from now
      const soonDeadline = new Date('2024-01-17T10:00:00Z'); // 2 days from now
      const distantDeadline = new Date('2024-01-25T10:00:00Z'); // 10 days from now

      const overdueScore = PriorityScoringService.calculateDeadlineUrgencyScore(
        overdueDeadline, currentTime, false
      );
      const urgentScore = PriorityScoringService.calculateDeadlineUrgencyScore(
        urgentDeadline, currentTime, false
      );
      const soonScore = PriorityScoringService.calculateDeadlineUrgencyScore(
        soonDeadline, currentTime, false
      );
      const distantScore = PriorityScoringService.calculateDeadlineUrgencyScore(
        distantDeadline, currentTime, false
      );

      expect(overdueScore).toBeGreaterThan(urgentScore);
      expect(urgentScore).toBeGreaterThan(soonScore);
      expect(soonScore).toBeGreaterThan(distantScore);
    });

    it('should give higher scores to hard deadlines', () => {
      const deadline = new Date('2024-01-15T22:00:00Z'); // 12 hours from now

      const softDeadlineScore = PriorityScoringService.calculateDeadlineUrgencyScore(
        deadline, currentTime, false
      );
      const hardDeadlineScore = PriorityScoringService.calculateDeadlineUrgencyScore(
        deadline, currentTime, true
      );

      expect(hardDeadlineScore).toBeGreaterThan(softDeadlineScore);
    });

    it('should handle overdue tasks with maximum urgency', () => {
      const overdueDeadline = new Date('2024-01-14T10:00:00Z'); // 1 day ago

      const overdueScore = PriorityScoringService.calculateDeadlineUrgencyScore(
        overdueDeadline, currentTime, false
      );

      expect(overdueScore).toBeGreaterThan(0);
    });
  });

  describe('calculateImportanceWeight', () => {
    it('should apply project importance multiplier for tasks with projects', () => {
      const taskWithProject = createMockTask({ projectId: 'project-1' });
      const taskWithoutProject = createMockTask({ projectId: undefined });

      const weightWithProject = PriorityScoringService.calculateImportanceWeight(
        taskWithProject, mockUser
      );
      const weightWithoutProject = PriorityScoringService.calculateImportanceWeight(
        taskWithoutProject, mockUser
      );

      expect(weightWithProject).toBeGreaterThan(weightWithoutProject);
    });

    it('should boost blocking tasks when protect focus time is enabled', () => {
      const blockingTask = createMockTask({ isBlocking: true });
      const nonBlockingTask = createMockTask({ isBlocking: false });

      const blockingWeight = PriorityScoringService.calculateImportanceWeight(
        blockingTask, mockUser
      );
      const nonBlockingWeight = PriorityScoringService.calculateImportanceWeight(
        nonBlockingTask, mockUser
      );

      expect(blockingWeight).toBeGreaterThan(nonBlockingWeight);
    });

    it('should boost tasks with deadlines when optimize for early completion is enabled', () => {
      const userWithEarlyCompletion = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          optimizeForEarlyCompletion: true
        }
      };

      const taskWithDeadline = createMockTask({ 
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000) 
      });
      const taskWithoutDeadline = createMockTask({ deadline: undefined });

      const weightWithDeadline = PriorityScoringService.calculateImportanceWeight(
        taskWithDeadline, userWithEarlyCompletion
      );
      const weightWithoutDeadline = PriorityScoringService.calculateImportanceWeight(
        taskWithoutDeadline, userWithEarlyCompletion
      );

      expect(weightWithDeadline).toBeGreaterThan(weightWithoutDeadline);
    });
  });

  describe('calculateTaskPriorityScore', () => {
    const currentTime = new Date('2024-01-15T10:00:00Z');

    it('should calculate comprehensive priority scores', () => {
      const criticalTask = createMockTask({ 
        priority: 'critical',
        deadline: new Date('2024-01-15T22:00:00Z'), // 12 hours from now
        isHardDeadline: true
      });

      const score = PriorityScoringService.calculateTaskPriorityScore(
        criticalTask, mockUser, currentTime
      );

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should respect priority hierarchy in final scores', () => {
      const criticalTask = createMockTask({ priority: 'critical' });
      const highTask = createMockTask({ priority: 'high' });
      const mediumTask = createMockTask({ priority: 'medium' });
      const lowTask = createMockTask({ priority: 'low' });

      const criticalScore = PriorityScoringService.calculateTaskPriorityScore(
        criticalTask, mockUser, currentTime
      );
      const highScore = PriorityScoringService.calculateTaskPriorityScore(
        highTask, mockUser, currentTime
      );
      const mediumScore = PriorityScoringService.calculateTaskPriorityScore(
        mediumTask, mockUser, currentTime
      );
      const lowScore = PriorityScoringService.calculateTaskPriorityScore(
        lowTask, mockUser, currentTime
      );

      expect(criticalScore).toBeGreaterThan(highScore);
      expect(highScore).toBeGreaterThan(mediumScore);
      expect(mediumScore).toBeGreaterThan(lowScore);
    });

    it('should cap scores at 100', () => {
      const maxPriorityTask = createMockTask({
        priority: 'critical',
        deadline: new Date('2024-01-14T10:00:00Z'), // Overdue
        isHardDeadline: true,
        projectId: 'project-1',
        isBlocking: true
      });

      const score = PriorityScoringService.calculateTaskPriorityScore(
        maxPriorityTask, mockUser, currentTime
      );

      expect(score).toBeLessThanOrEqual(100);
    });

    it('should ensure minimum score of 0', () => {
      const minPriorityTask = createMockTask({
        priority: 'low',
        deadline: undefined,
        isHardDeadline: false
      });

      const score = PriorityScoringService.calculateTaskPriorityScore(
        minPriorityTask, mockUser, currentTime
      );

      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateRelativePriorities', () => {
    it('should sort tasks by priority score', () => {
      const tasks = [
        createMockTask({ id: 'low-task', priority: 'low' }),
        createMockTask({ id: 'critical-task', priority: 'critical' }),
        createMockTask({ id: 'medium-task', priority: 'medium' }),
        createMockTask({ id: 'high-task', priority: 'high' })
      ];

      const result = PriorityScoringService.calculateRelativePriorities(
        tasks, mockUser
      );

      expect(result).toHaveLength(4);
      expect(result[0].task.id).toBe('critical-task');
      expect(result[1].task.id).toBe('high-task');
      expect(result[2].task.id).toBe('medium-task');
      expect(result[3].task.id).toBe('low-task');

      // Check rankings
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
      expect(result[2].rank).toBe(3);
      expect(result[3].rank).toBe(4);
    });

    it('should handle tasks with same priority correctly', () => {
      const tasks = [
        createMockTask({ id: 'task-1', priority: 'high' }),
        createMockTask({ id: 'task-2', priority: 'high' })
      ];

      const result = PriorityScoringService.calculateRelativePriorities(
        tasks, mockUser
      );

      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
    });
  });

  describe('getPriorityHierarchy', () => {
    it('should return correct priority hierarchy', () => {
      const hierarchy = PriorityScoringService.getPriorityHierarchy();

      expect(hierarchy).toHaveLength(6);
      expect(hierarchy[0].type).toBe('hard_deadline');
      expect(hierarchy[1].type).toBe('critical');
      expect(hierarchy[2].type).toBe('high');
      expect(hierarchy[3].type).toBe('soft_deadline');
      expect(hierarchy[4].type).toBe('medium');
      expect(hierarchy[5].type).toBe('low');

      // Check that scores are in descending order
      for (let i = 0; i < hierarchy.length - 1; i++) {
        expect(hierarchy[i].minScore).toBeGreaterThanOrEqual(hierarchy[i + 1].minScore);
      }
    });
  });

  describe('categorizePriority', () => {
    it('should categorize scores correctly', () => {
      expect(PriorityScoringService.categorizePriority(95).category).toBe('hard_deadline');
      expect(PriorityScoringService.categorizePriority(85).category).toBe('critical');
      expect(PriorityScoringService.categorizePriority(65).category).toBe('high');
      expect(PriorityScoringService.categorizePriority(55).category).toBe('soft_deadline');
      expect(PriorityScoringService.categorizePriority(35).category).toBe('medium');
      expect(PriorityScoringService.categorizePriority(15).category).toBe('low');
      expect(PriorityScoringService.categorizePriority(5).category).toBe('low');
    });
  });

  describe('calculateContextSwitchingAdjustment', () => {
    it('should give bonus for same project tasks', () => {
      const currentTask = createMockTask({ projectId: 'project-1' });
      const previousTask = createMockTask({ projectId: 'project-1' });

      const adjustment = PriorityScoringService.calculateContextSwitchingAdjustment(
        currentTask, previousTask, mockUser
      );

      expect(adjustment).toBeGreaterThan(0);
    });

    it('should give bonus for same priority tasks', () => {
      const currentTask = createMockTask({ priority: 'high' });
      const previousTask = createMockTask({ priority: 'high' });

      const adjustment = PriorityScoringService.calculateContextSwitchingAdjustment(
        currentTask, previousTask, mockUser
      );

      expect(adjustment).toBeGreaterThan(0);
    });

    it('should give bonus for same blocking type', () => {
      const currentTask = createMockTask({ isBlocking: true });
      const previousTask = createMockTask({ isBlocking: true });

      const adjustment = PriorityScoringService.calculateContextSwitchingAdjustment(
        currentTask, previousTask, mockUser
      );

      expect(adjustment).toBeGreaterThan(0);
    });

    it('should return 0 when grouping is disabled', () => {
      const userWithoutGrouping = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          groupSimilarTasks: false
        }
      };

      const currentTask = createMockTask({ projectId: 'project-1' });
      const previousTask = createMockTask({ projectId: 'project-1' });

      const adjustment = PriorityScoringService.calculateContextSwitchingAdjustment(
        currentTask, previousTask, userWithoutGrouping
      );

      expect(adjustment).toBe(0);
    });

    it('should return 0 when no previous task', () => {
      const currentTask = createMockTask();

      const adjustment = PriorityScoringService.calculateContextSwitchingAdjustment(
        currentTask, null, mockUser
      );

      expect(adjustment).toBe(0);
    });
  });

  describe('calculateEnergyBasedAdjustment', () => {
    it('should boost high priority tasks during high energy times', () => {
      const highPriorityTask = createMockTask({ priority: 'critical' });
      const highEnergyTime = new Date('2024-01-15T09:30:00Z'); // 9:30 AM

      const adjustment = PriorityScoringService.calculateEnergyBasedAdjustment(
        highPriorityTask, mockUser, highEnergyTime
      );

      expect(adjustment).toBeGreaterThan(0);
    });

    it('should boost low priority tasks during low energy times', () => {
      const lowPriorityTask = createMockTask({ priority: 'low' });
      const lowEnergyTime = new Date('2024-01-15T15:00:00Z'); // 3:00 PM

      const adjustment = PriorityScoringService.calculateEnergyBasedAdjustment(
        lowPriorityTask, mockUser, lowEnergyTime
      );

      expect(adjustment).toBeGreaterThan(0);
    });

    it('should return 0 for mismatched energy levels', () => {
      const highPriorityTask = createMockTask({ priority: 'critical' });
      const lowEnergyTime = new Date('2024-01-15T15:00:00Z'); // 3:00 PM

      const adjustment = PriorityScoringService.calculateEnergyBasedAdjustment(
        highPriorityTask, mockUser, lowEnergyTime
      );

      expect(adjustment).toBe(0);
    });
  });

  describe('getDebugInfo', () => {
    it('should provide comprehensive debug information', () => {
      const task = createMockTask({
        priority: 'high',
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isHardDeadline: true
      });

      const debugInfo = PriorityScoringService.getDebugInfo(task, mockUser);

      expect(debugInfo.taskId).toBe(task.id);
      expect(debugInfo.taskTitle).toBe(task.title);
      expect(debugInfo.basePriorityScore).toBe(60); // High priority
      expect(debugInfo.urgencyScore).toBeGreaterThan(0);
      expect(debugInfo.importanceWeight).toBeGreaterThan(0);
      expect(debugInfo.hardDeadlineBonus).toBe(20);
      expect(debugInfo.finalScore).toBeGreaterThan(0);
      expect(debugInfo.category).toBeDefined();
    });
  });
});