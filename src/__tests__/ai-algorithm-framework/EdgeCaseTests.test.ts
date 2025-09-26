import { ConstraintSatisfactionSolver } from '@/services/ConstraintSatisfactionSolver';
import { PriorityScoringService } from '@/services/PriorityScoringService';
import { TimeSlotGenerationService } from '@/services/TimeSlotGenerationService';
import { Task } from '@/models/Task';
import { User } from '@/models/User';
import { ConstraintCollection, Constraint } from '@/models/Constraint';
import { AvailableSlot } from '@/models/types';

/**
 * Edge case test suite for AI scheduling algorithms
 * Tests boundary conditions, error scenarios, and unusual input combinations
 */
describe('AI Algorithm - Edge Case Framework', () => {
  let solver: ConstraintSatisfactionSolver;
  let timeSlotService: jest.Mocked<TimeSlotGenerationService>;

  const mockUser: User = {
    id: 'edge-test-user',
    email: 'edge@example.com',
    name: 'Edge Test User',
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

  beforeEach(() => {
    timeSlotService = {
      generateTaskSlots: jest.fn(),
      generateAvailableSlots: jest.fn()
    } as any;

    solver = new ConstraintSatisfactionSolver(PriorityScoringService, timeSlotService);
  });

  describe('Empty and Null Input Edge Cases', () => {
    it('should handle empty task list gracefully', async () => {
      const result = await solver.solve([], mockUser, createEmptyConstraints(), []);

      expect(result.success).toBe(true);
      expect(result.scheduledTasks).toHaveLength(0);
      expect(result.unscheduledTasks).toHaveLength(0);
      expect(result.violations).toHaveLength(0);
      expect(result.optimizationScore).toBe(0);
    });

    it('should handle empty available slots gracefully', async () => {
      const tasks = [createTask({ title: 'Orphaned Task', duration: 60 })];
      
      timeSlotService.generateTaskSlots.mockResolvedValue([]);

      const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);

      expect(result.success).toBe(false);
      expect(result.scheduledTasks).toHaveLength(0);
      expect(result.unscheduledTasks).toHaveLength(1);
      expect(result.unscheduledTasks[0]).toBe(tasks[0]);
    });

    it('should handle null and undefined task properties', async () => {
      const taskWithNulls = createTask({
        title: 'Task with Nulls',
        description: undefined,
        deadline: null as any,
        projectId: undefined,
        dependencies: [],
        dependents: []
      });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z')
      ]);

      const result = await solver.solve([taskWithNulls], mockUser, createEmptyConstraints(), []);

      expect(result.success).toBe(true);
      expect(result.scheduledTasks).toHaveLength(1);
    });
  });

  describe('Extreme Duration Edge Cases', () => {
    it('should handle zero-duration tasks', async () => {
      const zeroTask = createTask({ title: 'Zero Duration Task', duration: 0 });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z')
      ]);

      const result = await solver.solve([zeroTask], mockUser, createEmptyConstraints(), []);

      // Zero duration tasks should be handled gracefully (either scheduled instantly or filtered out)
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle extremely long tasks', async () => {
      const longTask = createTask({ 
        title: 'Extremely Long Task', 
        duration: 24 * 60 * 7, // 1 week
        isBlocking: true
      });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T17:00:00Z') // 8 hours
      ]);

      const result = await solver.solve([longTask], mockUser, createEmptyConstraints(), []);

      // Should fail to schedule or report constraint violations
      if (!result.success) {
        expect(result.unscheduledTasks).toContain(longTask);
      } else {
        // If somehow scheduled, should respect blocking constraint
        expect(result.scheduledTasks).toHaveLength(1);
      }
    });

    it('should handle negative duration gracefully', async () => {
      const negativeTask = createTask({ 
        title: 'Negative Duration Task', 
        duration: -30 
      });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z')
      ]);

      const result = await solver.solve([negativeTask], mockUser, createEmptyConstraints(), []);

      // Should handle gracefully - either filter out or report error
      expect(result).toBeDefined();
      expect(result.violations.some(v => v.taskId === negativeTask.id)).toBe(true);
    });
  });

  describe('Circular Dependency Edge Cases', () => {
    it('should detect simple circular dependencies', async () => {
      const taskA = createTask({ 
        id: 'circular-a', 
        title: 'Task A', 
        dependencies: ['circular-b'] 
      });
      const taskB = createTask({ 
        id: 'circular-b', 
        title: 'Task B', 
        dependencies: ['circular-a'] 
      });

      const result = await solver.solve([taskA, taskB], mockUser, createEmptyConstraints(), []);

      expect(result.violations).toContainEqual(
        expect.objectContaining({
          constraintType: 'circular_dependency',
          severity: 'error'
        })
      );
    });

    it('should detect complex circular dependencies', async () => {
      const taskA = createTask({ 
        id: 'complex-a', 
        title: 'Task A', 
        dependencies: ['complex-c'] 
      });
      const taskB = createTask({ 
        id: 'complex-b', 
        title: 'Task B', 
        dependencies: ['complex-a'] 
      });
      const taskC = createTask({ 
        id: 'complex-c', 
        title: 'Task C', 
        dependencies: ['complex-b'] 
      });

      const result = await solver.solve([taskA, taskB, taskC], mockUser, createEmptyConstraints(), []);

      expect(result.violations).toContainEqual(
        expect.objectContaining({
          constraintType: 'circular_dependency',
          severity: 'error'
        })
      );
    });

    it('should handle self-referencing dependencies', async () => {
      const selfTask = createTask({ 
        id: 'self-ref', 
        title: 'Self Referencing Task', 
        dependencies: ['self-ref'] 
      });

      const result = await solver.solve([selfTask], mockUser, createEmptyConstraints(), []);

      expect(result.violations).toContainEqual(
        expect.objectContaining({
          constraintType: 'circular_dependency',
          severity: 'error',
          taskId: 'self-ref'
        })
      );
    });

    it('should handle orphaned dependencies gracefully', async () => {
      const orphanTask = createTask({ 
        id: 'orphan', 
        title: 'Orphaned Task', 
        dependencies: ['non-existent-task'] 
      });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z')
      ]);

      const result = await solver.solve([orphanTask], mockUser, createEmptyConstraints(), []);

      // Should either schedule the task (ignoring missing dependency) or report violation
      expect(result).toBeDefined();
      if (!result.success || result.scheduledTasks.length === 0) {
        expect(result.violations.some(v => v.taskId === 'orphan')).toBe(true);
      }
    });
  });

  describe('Extreme Deadline Edge Cases', () => {
    it('should handle past deadlines', async () => {
      const pastTask = createTask({
        title: 'Past Deadline Task',
        duration: 60,
        deadline: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        isHardDeadline: true
      });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z')
      ]);

      const result = await solver.solve([pastTask], mockUser, createEmptyConstraints(), []);

      expect(result.violations).toContainEqual(
        expect.objectContaining({
          constraintType: 'deadline',
          severity: 'error',
          taskId: pastTask.id
        })
      );
    });

    it('should handle very distant future deadlines', async () => {
      const futureTask = createTask({
        title: 'Far Future Task',
        duration: 60,
        deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        isHardDeadline: false
      });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z')
      ]);

      const result = await solver.solve([futureTask], mockUser, createEmptyConstraints(), []);

      expect(result.success).toBe(true);
      expect(result.scheduledTasks).toHaveLength(1);
    });

    it('should handle invalid deadline dates', async () => {
      const invalidTask = createTask({
        title: 'Invalid Deadline Task',
        duration: 60,
        deadline: new Date('invalid-date'),
        isHardDeadline: true
      });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z')
      ]);

      const result = await solver.solve([invalidTask], mockUser, createEmptyConstraints(), []);

      // Should handle invalid dates gracefully
      expect(result).toBeDefined();
      if (result.violations.length > 0) {
        expect(result.violations.some(v => v.taskId === invalidTask.id)).toBe(true);
      }
    });
  });

  describe('Extreme Time Slot Edge Cases', () => {
    it('should handle overlapping time slots', async () => {
      const task = createTask({ title: 'Overlap Test Task', duration: 60 });

      const overlappingSlots = [
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T11:00:00Z'),
        createSlot('2024-01-15T10:00:00Z', '2024-01-15T12:00:00Z') // Overlaps with first
      ];

      timeSlotService.generateTaskSlots.mockResolvedValue(overlappingSlots);

      const result = await solver.solve([task], mockUser, createEmptyConstraints(), []);

      // Should handle overlapping slots gracefully
      expect(result).toBeDefined();
      if (result.success) {
        expect(result.scheduledTasks).toHaveLength(1);
      }
    });

    it('should handle zero-duration time slots', async () => {
      const task = createTask({ title: 'Zero Slot Task', duration: 30 });

      const zeroSlot = createSlot('2024-01-15T09:00:00Z', '2024-01-15T09:00:00Z'); // Same start/end

      timeSlotService.generateTaskSlots.mockResolvedValue([zeroSlot]);

      const result = await solver.solve([task], mockUser, createEmptyConstraints(), []);

      // Should not be able to schedule in zero-duration slot
      expect(result.scheduledTasks).toHaveLength(0);
      expect(result.unscheduledTasks).toContain(task);
    });

    it('should handle invalid time slot dates', async () => {
      const task = createTask({ title: 'Invalid Slot Task', duration: 60 });

      const invalidSlot = {
        startTime: new Date('invalid-date'),
        endTime: new Date('2024-01-15T10:00:00Z'),
        duration: 60
      };

      timeSlotService.generateTaskSlots.mockResolvedValue([invalidSlot as any]);

      const result = await solver.solve([task], mockUser, createEmptyConstraints(), []);

      // Should handle invalid dates gracefully
      expect(result).toBeDefined();
      expect(result.scheduledTasks).toHaveLength(0);
    });

    it('should handle backwards time slots (end before start)', async () => {
      const task = createTask({ title: 'Backwards Slot Task', duration: 60 });

      const backwardsSlot = createSlot('2024-01-15T10:00:00Z', '2024-01-15T09:00:00Z'); // End before start

      timeSlotService.generateTaskSlots.mockResolvedValue([backwardsSlot]);

      const result = await solver.solve([task], mockUser, createEmptyConstraints(), []);

      // Should handle backwards slots gracefully
      expect(result).toBeDefined();
      expect(result.scheduledTasks).toHaveLength(0);
    });
  });

  describe('Extreme User Preference Edge Cases', () => {
    it('should handle zero max continuous work time', async () => {
      const userWithZeroMax = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          maxContinuousWorkTime: 0
        }
      };

      const task = createTask({ title: 'Zero Max Task', duration: 60 });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z')
      ]);

      const result = await solver.solve([task], userWithZeroMax, createEmptyConstraints(), []);

      // Should handle zero max work time gracefully
      expect(result).toBeDefined();
    });

    it('should handle negative break duration', async () => {
      const userWithNegativeBreak = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          preferredBreakDuration: -15
        }
      };

      const task = createTask({ title: 'Negative Break Task', duration: 60 });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z')
      ]);

      const result = await solver.solve([task], userWithNegativeBreak, createEmptyConstraints(), []);

      // Should handle negative break duration gracefully
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle empty working hours', async () => {
      const userWithNoWorkingHours = {
        ...mockUser,
        workingHours: {} as any
      };

      const task = createTask({ title: 'No Hours Task', duration: 60 });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z')
      ]);

      const result = await solver.solve([task], userWithNoWorkingHours, createEmptyConstraints(), []);

      // Should handle missing working hours gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Memory and Resource Edge Cases', () => {
    it('should handle extremely large task titles and descriptions', async () => {
      const largeText = 'A'.repeat(10000); // 10KB string
      
      const largeTask = createTask({
        title: largeText,
        description: largeText,
        duration: 60
      });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z')
      ]);

      const result = await solver.solve([largeTask], mockUser, createEmptyConstraints(), []);

      expect(result.success).toBe(true);
      expect(result.scheduledTasks).toHaveLength(1);
    });

    it('should handle tasks with many dependencies', async () => {
      const manyDeps = Array.from({ length: 100 }, (_, i) => `dep-${i}`);
      
      const taskWithManyDeps = createTask({
        title: 'Task with Many Dependencies',
        duration: 60,
        dependencies: manyDeps
      });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z')
      ]);

      const result = await solver.solve([taskWithManyDeps], mockUser, createEmptyConstraints(), []);

      // Should handle many dependencies gracefully
      expect(result).toBeDefined();
      expect(result.violations.some(v => v.taskId === taskWithManyDeps.id)).toBe(true);
    });
  });

  describe('Timezone and Date Edge Cases', () => {
    it('should handle different timezone scenarios', async () => {
      const userInDifferentTZ = {
        ...mockUser,
        timezone: 'Asia/Tokyo'
      };

      const task = createTask({ 
        title: 'Timezone Task', 
        duration: 60,
        deadline: new Date('2024-01-15T15:00:00Z') // UTC time
      });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z')
      ]);

      const result = await solver.solve([task], userInDifferentTZ, createEmptyConstraints(), []);

      expect(result).toBeDefined();
    });

    it('should handle daylight saving time transitions', async () => {
      // Test around DST transition dates
      const dstTask = createTask({
        title: 'DST Task',
        duration: 60,
        deadline: new Date('2024-03-10T10:00:00Z') // DST transition in US
      });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-03-10T08:00:00Z', '2024-03-10T09:00:00Z')
      ]);

      const result = await solver.solve([dstTask], mockUser, createEmptyConstraints(), []);

      expect(result).toBeDefined();
    });
  });

  // Helper functions
  function createTask(overrides: Partial<Task> = {}): Task {
    return {
      id: `edge-task-${Math.random().toString(36).substr(2, 9)}`,
      userId: 'edge-test-user',
      title: 'Edge Test Task',
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
    };
  }

  function createSlot(startTime: string, endTime: string): AvailableSlot {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return {
      startTime: start,
      endTime: end,
      duration: Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60))
    };
  }

  function createEmptyConstraints(): ConstraintCollection {
    return {
      userId: 'edge-test-user',
      constraints: [],
      collectedAt: new Date(),
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }
});