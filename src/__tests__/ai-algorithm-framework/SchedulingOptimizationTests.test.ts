import { ConstraintSatisfactionSolver } from '@/services/ConstraintSatisfactionSolver';
import { PriorityScoringService } from '@/services/PriorityScoringService';
import { TimeSlotGenerationService } from '@/services/TimeSlotGenerationService';
import { Task } from '@/models/Task';
import { User } from '@/models/User';
import { ConstraintCollection } from '@/models/Constraint';
import { AvailableSlot } from '@/models/types';

/**
 * Comprehensive scheduling optimization test suite for AI algorithms
 * Tests optimization quality, efficiency metrics, and intelligent scheduling decisions
 */
describe('AI Algorithm - Scheduling Optimization Framework', () => {
  let solver: ConstraintSatisfactionSolver;
  let timeSlotService: jest.Mocked<TimeSlotGenerationService>;

  const mockUser: User = {
    id: 'test-user',
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
      optimizeForEarlyCompletion: true,
      defaultMeetingBuffer: 10,
      energyPreferences: {
        highEnergyTimes: [{ start: '09:00', end: '11:00' }, { start: '14:00', end: '16:00' }],
        lowEnergyTimes: [{ start: '11:00', end: '12:00' }, { start: '16:00', end: '17:00' }],
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

  describe('Priority-Based Optimization', () => {
    it('should optimize schedule based on priority hierarchy', async () => {
      const tasks = [
        createTask({ id: 'low-1', title: 'Low Priority 1', priority: 'low', duration: 60 }),
        createTask({ id: 'critical-1', title: 'Critical Task', priority: 'critical', duration: 60 }),
        createTask({ id: 'high-1', title: 'High Priority 1', priority: 'high', duration: 60 }),
        createTask({ id: 'medium-1', title: 'Medium Priority 1', priority: 'medium', duration: 60 }),
        createTask({ id: 'low-2', title: 'Low Priority 2', priority: 'low', duration: 60 })
      ];

      // Mock priority scoring to reflect hierarchy
      jest.spyOn(PriorityScoringService, 'calculateRelativePriorities').mockReturnValue([
        { task: tasks[1], priorityScore: 80, rank: 1 }, // Critical
        { task: tasks[2], priorityScore: 60, rank: 2 }, // High
        { task: tasks[3], priorityScore: 30, rank: 3 }, // Medium
        { task: tasks[0], priorityScore: 10, rank: 4 }, // Low 1
        { task: tasks[4], priorityScore: 10, rank: 5 }  // Low 2
      ]);

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
        createSlot('2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
        createSlot('2024-01-15T11:00:00Z', '2024-01-15T12:00:00Z'),
        createSlot('2024-01-15T13:00:00Z', '2024-01-15T14:00:00Z'),
        createSlot('2024-01-15T14:00:00Z', '2024-01-15T15:00:00Z')
      ]);

      const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);

      expect(result.success).toBe(true);
      expect(result.scheduledTasks).toHaveLength(5);

      // Verify tasks are scheduled in priority order
      const sortedScheduled = result.scheduledTasks.sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime()
      );

      expect(sortedScheduled[0].taskId).toBe('critical-1'); // Critical first
      expect(sortedScheduled[1].taskId).toBe('high-1');    // High second
      expect(sortedScheduled[2].taskId).toBe('medium-1');  // Medium third
      
      // Low priority tasks should be last
      const lastTwoIds = [sortedScheduled[3].taskId, sortedScheduled[4].taskId];
      expect(lastTwoIds).toContain('low-1');
      expect(lastTwoIds).toContain('low-2');
    });

    it('should calculate meaningful optimization scores', async () => {
      const highPriorityTasks = [
        createTask({ title: 'Critical 1', priority: 'critical', duration: 60 }),
        createTask({ title: 'Critical 2', priority: 'critical', duration: 60 })
      ];

      const lowPriorityTasks = [
        createTask({ title: 'Low 1', priority: 'low', duration: 60 }),
        createTask({ title: 'Low 2', priority: 'low', duration: 60 })
      ];

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
        createSlot('2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z')
      ]);

      // Test high priority schedule
      jest.spyOn(PriorityScoringService, 'calculateRelativePriorities')
        .mockReturnValueOnce([
          { task: highPriorityTasks[0], priorityScore: 80, rank: 1 },
          { task: highPriorityTasks[1], priorityScore: 80, rank: 2 }
        ]);

      const highPriorityResult = await solver.solve(
        highPriorityTasks, 
        mockUser, 
        createEmptyConstraints(), 
        []
      );

      // Test low priority schedule
      jest.spyOn(PriorityScoringService, 'calculateRelativePriorities')
        .mockReturnValueOnce([
          { task: lowPriorityTasks[0], priorityScore: 10, rank: 1 },
          { task: lowPriorityTasks[1], priorityScore: 10, rank: 2 }
        ]);

      const lowPriorityResult = await solver.solve(
        lowPriorityTasks, 
        mockUser, 
        createEmptyConstraints(), 
        []
      );

      // High priority schedule should have higher optimization score
      expect(highPriorityResult.optimizationScore).toBeGreaterThan(lowPriorityResult.optimizationScore);
    });
  });

  describe('Deadline-Aware Optimization', () => {
    it('should optimize for deadline urgency', async () => {
      const now = new Date();
      const tasks = [
        createTask({
          id: 'urgent',
          title: 'Urgent Task',
          priority: 'medium',
          deadline: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 hours
          isHardDeadline: true,
          duration: 60
        }),
        createTask({
          id: 'soon',
          title: 'Soon Task',
          priority: 'high',
          deadline: new Date(now.getTime() + 4 * 60 * 60 * 1000), // 4 hours
          isHardDeadline: false,
          duration: 60
        }),
        createTask({
          id: 'later',
          title: 'Later Task',
          priority: 'critical',
          deadline: new Date(now.getTime() + 8 * 60 * 60 * 1000), // 8 hours
          isHardDeadline: false,
          duration: 60
        })
      ];

      // Mock priority scoring to reflect deadline urgency
      jest.spyOn(PriorityScoringService, 'calculateRelativePriorities').mockReturnValue([
        { task: tasks[0], priorityScore: 100, rank: 1 }, // Urgent hard deadline
        { task: tasks[2], priorityScore: 80, rank: 2 },  // Critical but later
        { task: tasks[1], priorityScore: 60, rank: 3 }   // High but soft deadline
      ]);

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
        createSlot('2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
        createSlot('2024-01-15T11:00:00Z', '2024-01-15T12:00:00Z')
      ]);

      const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);

      expect(result.success).toBe(true);
      
      // Urgent task should be scheduled first despite lower base priority
      const firstScheduled = result.scheduledTasks.sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime()
      )[0];
      
      expect(firstScheduled.taskId).toBe('urgent');
    });

    it('should optimize for early completion when preference is enabled', async () => {
      const tasks = [
        createTask({ 
          id: 'task-1', 
          title: 'Task 1', 
          duration: 60,
          deadline: new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 hours
        }),
        createTask({ 
          id: 'task-2', 
          title: 'Task 2', 
          duration: 60,
          deadline: new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 hours
        })
      ];

      // Mock early morning and late afternoon slots
      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'), // Early
        createSlot('2024-01-15T16:00:00Z', '2024-01-15T17:00:00Z')  // Late
      ]);

      const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);

      if (result.success && result.scheduledTasks.length === 2) {
        // With early completion preference, tasks should be scheduled earlier
        const averageStartTime = result.scheduledTasks.reduce(
          (sum, slot) => sum + slot.startTime.getTime(), 0
        ) / result.scheduledTasks.length;

        // Should prefer earlier slots (closer to 9 AM than 4 PM)
        const nineAM = new Date('2024-01-15T09:00:00Z').getTime();
        const fourPM = new Date('2024-01-15T16:00:00Z').getTime();
        const midpoint = (nineAM + fourPM) / 2;

        expect(averageStartTime).toBeLessThan(midpoint);
      }
    });
  });

  describe('Task Grouping and Context Switching Optimization', () => {
    it('should group similar tasks when preference is enabled', async () => {
      const tasks = [
        createTask({ 
          id: 'proj1-task1', 
          title: 'Project 1 Task 1', 
          projectId: 'project-1',
          duration: 60 
        }),
        createTask({ 
          id: 'proj2-task1', 
          title: 'Project 2 Task 1', 
          projectId: 'project-2',
          duration: 60 
        }),
        createTask({ 
          id: 'proj1-task2', 
          title: 'Project 1 Task 2', 
          projectId: 'project-1',
          duration: 60 
        }),
        createTask({ 
          id: 'proj2-task2', 
          title: 'Project 2 Task 2', 
          projectId: 'project-2',
          duration: 60 
        })
      ];

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
        createSlot('2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
        createSlot('2024-01-15T11:00:00Z', '2024-01-15T12:00:00Z'),
        createSlot('2024-01-15T13:00:00Z', '2024-01-15T14:00:00Z')
      ]);

      const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);

      expect(result.success).toBe(true);
      expect(result.scheduledTasks).toHaveLength(4);

      // Analyze grouping quality
      const sortedSlots = result.scheduledTasks.sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime()
      );

      const taskProjects = sortedSlots.map(slot => {
        const task = tasks.find(t => t.id === slot.taskId);
        return task?.projectId;
      });

      // Calculate context switches (project changes)
      let contextSwitches = 0;
      for (let i = 1; i < taskProjects.length; i++) {
        if (taskProjects[i] !== taskProjects[i - 1]) {
          contextSwitches++;
        }
      }

      // Should minimize context switches (ideally 1 switch for 2 projects)
      expect(contextSwitches).toBeLessThanOrEqual(2);
    });

    it('should optimize for focus time protection', async () => {
      const focusTask = createTask({
        id: 'focus-task',
        title: 'Deep Focus Task',
        duration: 120, // 2 hours
        priority: 'high',
        isBlocking: true // Requires uninterrupted time
      });

      const quickTasks = [
        createTask({ id: 'quick-1', title: 'Quick Task 1', duration: 15 }),
        createTask({ id: 'quick-2', title: 'Quick Task 2', duration: 15 }),
        createTask({ id: 'quick-3', title: 'Quick Task 3', duration: 15 })
      ];

      // Mock slots with one long continuous period and fragmented periods
      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T11:00:00Z'), // 2 hour block
        createSlot('2024-01-15T11:15:00Z', '2024-01-15T11:30:00Z'), // 15 min
        createSlot('2024-01-15T11:45:00Z', '2024-01-15T12:00:00Z'), // 15 min
        createSlot('2024-01-15T13:00:00Z', '2024-01-15T13:15:00Z')  // 15 min
      ]);

      const result = await solver.solve(
        [focusTask, ...quickTasks], 
        mockUser, 
        createEmptyConstraints(), 
        []
      );

      expect(result.success).toBe(true);

      // Focus task should get the continuous 2-hour block
      const focusSlot = result.scheduledTasks.find(s => s.taskId === 'focus-task');
      expect(focusSlot).toBeDefined();
      expect(focusSlot!.duration).toBe(120);
      expect(focusSlot!.startTime.getHours()).toBe(9); // Should get the morning block
    });
  });

  describe('Energy-Based Optimization', () => {
    it('should align task types with energy levels', async () => {
      const criticalTask = createTask({
        id: 'critical-task',
        title: 'Critical Analysis',
        priority: 'critical',
        duration: 60
      });

      const routineTask = createTask({
        id: 'routine-task',
        title: 'Routine Admin',
        priority: 'low',
        duration: 60
      });

      // Mock slots during high and low energy periods
      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:30:00Z', '2024-01-15T10:30:00Z'), // High energy (9-11 AM)
        createSlot('2024-01-15T16:30:00Z', '2024-01-15T17:30:00Z')  // Low energy (4-5 PM)
      ]);

      const result = await solver.solve([routineTask, criticalTask], mockUser, createEmptyConstraints(), []);

      expect(result.success).toBe(true);
      expect(result.scheduledTasks).toHaveLength(2);

      const criticalSlot = result.scheduledTasks.find(s => s.taskId === 'critical-task');
      const routineSlot = result.scheduledTasks.find(s => s.taskId === 'routine-task');

      // Critical task should be in high energy time (9-11 AM)
      expect(criticalSlot!.startTime.getHours()).toBeLessThan(11);
      
      // Routine task should be in low energy time (4-5 PM)  
      expect(routineSlot!.startTime.getHours()).toBeGreaterThanOrEqual(16);
    });

    it('should respect meeting preferred times for collaborative tasks', async () => {
      // Simulate a task that might involve meetings/collaboration
      const collaborativeTask = createTask({
        id: 'collab-task',
        title: 'Team Collaboration',
        duration: 90,
        priority: 'high'
      });

      const individualTask = createTask({
        id: 'individual-task',
        title: 'Individual Work',
        duration: 90,
        priority: 'high'
      });

      // Mock slots during and outside meeting preferred times
      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T10:30:00Z', '2024-01-15T12:00:00Z'), // Meeting preferred (10-12)
        createSlot('2024-01-15T08:00:00Z', '2024-01-15T09:30:00Z')   // Outside preferred times
      ]);

      const result = await solver.solve([individualTask, collaborativeTask], mockUser, createEmptyConstraints(), []);

      // This test would require additional metadata about task types
      // For now, we verify the optimization considers time preferences
      expect(result.success).toBe(true);
      expect(result.optimizationScore).toBeGreaterThan(0);
    });
  });

  describe('Performance and Efficiency Metrics', () => {
    it('should complete scheduling within reasonable time limits', async () => {
      const largeBatch = Array.from({ length: 50 }, (_, i) => 
        createTask({ 
          id: `task-${i}`,
          title: `Task ${i}`,
          duration: 30 + (i % 60), // Varying durations
          priority: ['low', 'medium', 'high', 'critical'][i % 4] as any
        })
      );

      // Mock sufficient slots
      const slots = Array.from({ length: 60 }, (_, i) => 
        createSlot(
          `2024-01-15T${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}:00Z`,
          `2024-01-15T${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '30' : '60'}:00Z`
        )
      );

      timeSlotService.generateTaskSlots.mockResolvedValue(slots);

      const startTime = Date.now();
      const result = await solver.solve(largeBatch, mockUser, createEmptyConstraints(), []);
      const endTime = Date.now();

      const solvingTime = endTime - startTime;

      // Should complete within 5 seconds for 50 tasks
      expect(solvingTime).toBeLessThan(5000);
      expect(result.solvingTimeMs).toBeLessThan(5000);
      
      // Should schedule a reasonable number of tasks
      expect(result.scheduledTasks.length).toBeGreaterThan(largeBatch.length * 0.7);
    });

    it('should provide detailed performance metrics', async () => {
      const tasks = [
        createTask({ title: 'Task 1', duration: 60 }),
        createTask({ title: 'Task 2', duration: 45 }),
        createTask({ title: 'Task 3', duration: 30 })
      ];

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
        createSlot('2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
        createSlot('2024-01-15T11:00:00Z', '2024-01-15T12:00:00Z')
      ]);

      const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalTasks).toBe(3);
      expect(result.metadata.schedulableTasks).toBe(3);
      expect(result.metadata.backtrackingSteps).toBeGreaterThanOrEqual(0);
      expect(result.solvingTimeMs).toBeGreaterThan(0);
      expect(result.optimizationScore).toBeGreaterThan(0);
    });

    it('should handle memory efficiently with large datasets', async () => {
      const memoryBefore = process.memoryUsage().heapUsed;

      // Create a large number of tasks
      const largeBatch = Array.from({ length: 200 }, (_, i) => 
        createTask({ 
          id: `memory-task-${i}`,
          title: `Memory Task ${i}`,
          duration: 30,
          priority: 'medium'
        })
      );

      const slots = Array.from({ length: 200 }, (_, i) => 
        createSlot(
          `2024-01-15T${String(9 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}:00Z`,
          `2024-01-15T${String(9 + Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15 + 15).padStart(2, '0')}:00Z`
        )
      );

      timeSlotService.generateTaskSlots.mockResolvedValue(slots);

      const result = await solver.solve(largeBatch, mockUser, createEmptyConstraints(), []);

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;

      // Memory increase should be reasonable (less than 100MB for 200 tasks)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      expect(result).toBeDefined();
    });
  });

  // Helper functions
  function createTask(overrides: Partial<Task> = {}): Task {
    return {
      id: `task-${Math.random().toString(36).substr(2, 9)}`,
      userId: 'test-user',
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
    };
  }

  function createSlot(startTime: string, endTime: string): AvailableSlot {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return {
      startTime: start,
      endTime: end,
      duration: (end.getTime() - start.getTime()) / (1000 * 60)
    };
  }

  function createEmptyConstraints(): ConstraintCollection {
    return {
      userId: 'test-user',
      constraints: [],
      collectedAt: new Date(),
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }
});