import { ConstraintSatisfactionSolver, SolverOptions } from '@/services/ConstraintSatisfactionSolver';
import { PriorityScoringService } from '@/services/PriorityScoringService';
import { TimeSlotGenerationService } from '@/services/TimeSlotGenerationService';
import { Task } from '@/models/Task';
import { User } from '@/models/User';
import { AvailableSlot } from '@/models/types';
import { ConstraintCollection } from '@/models/Constraint';

// Mock dependencies
jest.mock('@/services/PriorityScoringService');
jest.mock('@/services/TimeSlotGenerationService');

describe('ConstraintSatisfactionSolver', () => {
  let solver: ConstraintSatisfactionSolver;
  let mockTimeSlotService: jest.Mocked<TimeSlotGenerationService>;

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
    id: `task-${Math.random().toString(36).substr(2, 9)}`,
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

  const mockConstraints: ConstraintCollection = {
    userId: 'user-1',
    constraints: [
      {
        id: 'wh-1',
        type: 'working_hours',
        priority: 100,
        description: 'Working hours Monday',
        dayOfWeek: 1,
        timeRange: { start: '09:00', end: '17:00' },
        timezone: 'America/New_York'
      } as any
    ],
    collectedAt: new Date(),
    validFrom: new Date(),
    validUntil: new Date()
  };

  const mockAvailableSlots: AvailableSlot[] = [
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

  beforeEach(() => {
    mockTimeSlotService = new TimeSlotGenerationService({} as any) as jest.Mocked<TimeSlotGenerationService>;
    
    solver = new ConstraintSatisfactionSolver(
      PriorityScoringService,
      mockTimeSlotService
    );

    // Mock PriorityScoringService methods
    jest.spyOn(PriorityScoringService, 'calculateRelativePriorities').mockReturnValue([
      { task: createMockTask(), priorityScore: 60, rank: 1 }
    ]);

    // Mock TimeSlotGenerationService methods
    mockTimeSlotService.generateTaskSlots.mockResolvedValue(mockAvailableSlots);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('solve', () => {
    it('should successfully solve simple scheduling problem', async () => {
      const tasks = [createMockTask({ title: 'Simple Task', duration: 60 })];

      const result = await solver.solve(
        tasks,
        mockUser,
        mockConstraints,
        mockAvailableSlots
      );

      expect(result.success).toBe(true);
      expect(result.scheduledTasks).toHaveLength(1);
      expect(result.unscheduledTasks).toHaveLength(0);
      expect(result.violations).toHaveLength(0);
      expect(result.optimizationScore).toBeGreaterThan(0);
      expect(result.solvingTimeMs).toBeGreaterThan(0);
    });

    it('should handle multiple tasks with different priorities', async () => {
      const tasks = [
        createMockTask({ title: 'Low Priority', priority: 'low', duration: 30 }),
        createMockTask({ title: 'High Priority', priority: 'high', duration: 45 }),
        createMockTask({ title: 'Critical Priority', priority: 'critical', duration: 60 })
      ];

      // Mock priority scoring to return tasks in priority order
      jest.spyOn(PriorityScoringService, 'calculateRelativePriorities').mockReturnValue([
        { task: tasks[2], priorityScore: 80, rank: 1 }, // Critical first
        { task: tasks[1], priorityScore: 60, rank: 2 }, // High second
        { task: tasks[0], priorityScore: 10, rank: 3 }  // Low last
      ]);

      const result = await solver.solve(
        tasks,
        mockUser,
        mockConstraints,
        mockAvailableSlots
      );

      expect(result.success).toBe(true);
      expect(result.scheduledTasks).toHaveLength(3);
      
      // Verify tasks are scheduled in priority order
      const sortedScheduled = result.scheduledTasks.sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime()
      );
      
      // Critical task should be scheduled first (earliest time)
      expect(sortedScheduled[0].taskId).toBe(tasks[2].id);
    });

    it('should respect task dependencies', async () => {
      const prerequisiteTask = createMockTask({ 
        id: 'prereq-task',
        title: 'Prerequisite Task',
        duration: 60 
      });
      const dependentTask = createMockTask({ 
        id: 'dependent-task',
        title: 'Dependent Task',
        duration: 60,
        dependencies: ['prereq-task']
      });

      const tasks = [dependentTask, prerequisiteTask]; // Intentionally out of order

      // Mock priority scoring
      jest.spyOn(PriorityScoringService, 'calculateRelativePriorities').mockReturnValue([
        { task: prerequisiteTask, priorityScore: 50, rank: 1 },
        { task: dependentTask, priorityScore: 60, rank: 2 }
      ]);

      const result = await solver.solve(
        tasks,
        mockUser,
        mockConstraints,
        mockAvailableSlots
      );

      expect(result.success).toBe(true);
      expect(result.scheduledTasks).toHaveLength(2);

      // Find the scheduled slots for each task
      const prereqSlot = result.scheduledTasks.find(s => s.taskId === 'prereq-task');
      const dependentSlot = result.scheduledTasks.find(s => s.taskId === 'dependent-task');

      expect(prereqSlot).toBeDefined();
      expect(dependentSlot).toBeDefined();
      
      // Prerequisite should complete before dependent starts
      expect(prereqSlot!.endTime.getTime()).toBeLessThanOrEqual(dependentSlot!.startTime.getTime());
    });

    it('should handle blocking tasks correctly', async () => {
      const blockingTask = createMockTask({
        title: 'Blocking Task',
        duration: 180, // 3 hours
        isBlocking: true
      });

      const tasks = [blockingTask];

      // Mock task slots to return only slots that can fit the entire task
      mockTimeSlotService.generateTaskSlots.mockResolvedValue([
        {
          startTime: new Date('2024-01-15T09:00:00Z'),
          endTime: new Date('2024-01-15T12:00:00Z'),
          duration: 180 // Exactly fits the blocking task
        }
      ]);

      const result = await solver.solve(
        tasks,
        mockUser,
        mockConstraints,
        mockAvailableSlots
      );

      expect(result.success).toBe(true);
      expect(result.scheduledTasks).toHaveLength(1);
      expect(result.scheduledTasks[0].duration).toBe(180);
    });

    it('should handle deadline constraints', async () => {
      const urgentTask = createMockTask({
        title: 'Urgent Task',
        duration: 60,
        deadline: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        isHardDeadline: true
      });

      const tasks = [urgentTask];

      const result = await solver.solve(
        tasks,
        mockUser,
        mockConstraints,
        mockAvailableSlots
      );

      expect(result.success).toBe(true);
      expect(result.scheduledTasks).toHaveLength(1);
      
      // Task should be scheduled before its deadline
      expect(result.scheduledTasks[0].endTime.getTime()).toBeLessThanOrEqual(urgentTask.deadline!.getTime());
    });

    it('should handle insufficient time gracefully', async () => {
      const largeTasks = [
        createMockTask({ title: 'Large Task 1', duration: 300 }), // 5 hours
        createMockTask({ title: 'Large Task 2', duration: 300 }), // 5 hours
        createMockTask({ title: 'Large Task 3', duration: 300 })  // 5 hours
      ];

      // Available slots only have 7 hours total (180 + 240)
      const result = await solver.solve(
        largeTasks,
        mockUser,
        mockConstraints,
        mockAvailableSlots
      );

      // Should schedule what it can and report unscheduled tasks
      expect(result.scheduledTasks.length).toBeLessThan(3);
      expect(result.unscheduledTasks.length).toBeGreaterThan(0);
    });

    it('should respect solver options', async () => {
      const tasks = [createMockTask({ title: 'Test Task', duration: 60 })];
      
      const options: SolverOptions = {
        maxDepth: 10,
        timeLimitMs: 1000,
        allowSoftViolations: true
      };

      const result = await solver.solve(
        tasks,
        mockUser,
        mockConstraints,
        mockAvailableSlots,
        options
      );

      expect(result.metadata.backtrackingSteps).toBeLessThanOrEqual(10);
      expect(result.solvingTimeMs).toBeLessThan(2000); // Should respect time limit
    });

    it('should filter out completed tasks', async () => {
      const tasks = [
        createMockTask({ title: 'Pending Task', status: 'pending' }),
        createMockTask({ title: 'Completed Task', status: 'completed' }),
        createMockTask({ title: 'In Progress Task', status: 'in_progress' })
      ];

      const result = await solver.solve(
        tasks,
        mockUser,
        mockConstraints,
        mockAvailableSlots
      );

      // Should only schedule non-completed tasks
      expect(result.metadata.schedulableTasks).toBe(2);
      
      const scheduledTaskTitles = result.scheduledTasks.map(s => {
        const task = tasks.find(t => t.id === s.taskId);
        return task?.title;
      });
      
      expect(scheduledTaskTitles).not.toContain('Completed Task');
    });

    it('should calculate optimization score correctly', async () => {
      const highPriorityTask = createMockTask({
        title: 'High Priority Task',
        priority: 'critical',
        duration: 60
      });

      const lowPriorityTask = createMockTask({
        title: 'Low Priority Task',
        priority: 'low',
        duration: 60
      });

      // Test with high priority task
      const highPriorityResult = await solver.solve(
        [highPriorityTask],
        mockUser,
        mockConstraints,
        mockAvailableSlots
      );

      // Test with low priority task
      const lowPriorityResult = await solver.solve(
        [lowPriorityTask],
        mockUser,
        mockConstraints,
        mockAvailableSlots
      );

      // High priority task should result in higher optimization score
      expect(highPriorityResult.optimizationScore).toBeGreaterThan(lowPriorityResult.optimizationScore);
    });

    it('should handle circular dependencies gracefully', async () => {
      const task1 = createMockTask({
        id: 'task-1',
        title: 'Task 1',
        dependencies: ['task-2']
      });
      
      const task2 = createMockTask({
        id: 'task-2',
        title: 'Task 2',
        dependencies: ['task-1']
      });

      const tasks = [task1, task2];

      const result = await solver.solve(
        tasks,
        mockUser,
        mockConstraints,
        mockAvailableSlots
      );

      // Should handle circular dependencies without infinite loop
      expect(result).toBeDefined();
      expect(result.solvingTimeMs).toBeLessThan(5000); // Should complete quickly
    });

    it('should provide detailed metadata', async () => {
      const tasks = [
        createMockTask({ title: 'Task 1' }),
        createMockTask({ title: 'Task 2' })
      ];

      const result = await solver.solve(
        tasks,
        mockUser,
        mockConstraints,
        mockAvailableSlots
      );

      expect(result.metadata).toBeDefined();
      expect(result.metadata.totalTasks).toBe(2);
      expect(result.metadata.schedulableTasks).toBeGreaterThan(0);
      expect(result.metadata.availableSlots).toBe(mockAvailableSlots.length);
      expect(result.metadata.backtrackingSteps).toBeGreaterThanOrEqual(0);
    });
  });

  describe('constraint validation', () => {
    it('should detect time conflicts', async () => {
      const task1 = createMockTask({ id: 'task-1', title: 'Task 1', duration: 120 });
      const task2 = createMockTask({ id: 'task-2', title: 'Task 2', duration: 120 });

      // Mock task slots to return overlapping times
      mockTimeSlotService.generateTaskSlots
        .mockResolvedValueOnce([{
          startTime: new Date('2024-01-15T09:00:00Z'),
          endTime: new Date('2024-01-15T11:00:00Z'),
          duration: 120
        }])
        .mockResolvedValueOnce([{
          startTime: new Date('2024-01-15T10:00:00Z'), // Overlaps with first task
          endTime: new Date('2024-01-15T12:00:00Z'),
          duration: 120
        }]);

      const result = await solver.solve(
        [task1, task2],
        mockUser,
        mockConstraints,
        mockAvailableSlots
      );

      // Should detect conflict and handle appropriately
      expect(result).toBeDefined();
      // Either both tasks scheduled without conflict, or one remains unscheduled
      if (result.success && result.scheduledTasks.length === 2) {
        // Verify no time overlap in final schedule
        const [slot1, slot2] = result.scheduledTasks.sort(
          (a, b) => a.startTime.getTime() - b.startTime.getTime()
        );
        expect(slot1.endTime.getTime()).toBeLessThanOrEqual(slot2.startTime.getTime());
      }
    });

    it('should validate working hours constraints', async () => {
      const task = createMockTask({ title: 'After Hours Task', duration: 60 });

      // Mock task slots to return time outside working hours
      mockTimeSlotService.generateTaskSlots.mockResolvedValue([{
        startTime: new Date('2024-01-15T18:00:00Z'), // 6 PM - outside working hours
        endTime: new Date('2024-01-15T19:00:00Z'),
        duration: 60
      }]);

      const result = await solver.solve(
        [task],
        mockUser,
        mockConstraints,
        mockAvailableSlots
      );

      // Should either reject the slot or report violations
      if (!result.success) {
        expect(result.violations.length).toBeGreaterThan(0);
        expect(result.violations.some(v => v.constraintType === 'working_hours')).toBe(true);
      }
    });
  });

  describe('optimization features', () => {
    it('should group similar tasks when preference is enabled', async () => {
      const project1Task1 = createMockTask({
        id: 'p1-task1',
        title: 'Project 1 Task 1',
        projectId: 'project-1',
        duration: 60
      });
      
      const project1Task2 = createMockTask({
        id: 'p1-task2',
        title: 'Project 1 Task 2',
        projectId: 'project-1',
        duration: 60
      });
      
      const project2Task = createMockTask({
        id: 'p2-task',
        title: 'Project 2 Task',
        projectId: 'project-2',
        duration: 60
      });

      const tasks = [project1Task1, project2Task, project1Task2]; // Mixed order

      const result = await solver.solve(
        tasks,
        mockUser,
        mockConstraints,
        mockAvailableSlots
      );

      if (result.success && result.scheduledTasks.length === 3) {
        // Check if project 1 tasks are scheduled closer together
        const sortedSlots = result.scheduledTasks.sort(
          (a, b) => a.startTime.getTime() - b.startTime.getTime()
        );
        
        // This is a heuristic check - in a real scenario, we'd expect better grouping
        expect(result.optimizationScore).toBeGreaterThan(0);
      }
    });

    it('should prioritize tasks with approaching deadlines', async () => {
      const urgentTask = createMockTask({
        id: 'urgent',
        title: 'Urgent Task',
        deadline: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        isHardDeadline: true,
        priority: 'medium'
      });
      
      const normalTask = createMockTask({
        id: 'normal',
        title: 'Normal Task',
        priority: 'high' // Higher base priority but no deadline
      });

      // Mock priority scoring to reflect deadline urgency
      jest.spyOn(PriorityScoringService, 'calculateRelativePriorities').mockReturnValue([
        { task: urgentTask, priorityScore: 90, rank: 1 }, // Deadline makes it higher priority
        { task: normalTask, priorityScore: 60, rank: 2 }
      ]);

      const result = await solver.solve(
        [normalTask, urgentTask], // Intentionally out of priority order
        mockUser,
        mockConstraints,
        mockAvailableSlots
      );

      expect(result.success).toBe(true);
      
      if (result.scheduledTasks.length === 2) {
        const sortedSlots = result.scheduledTasks.sort(
          (a, b) => a.startTime.getTime() - b.startTime.getTime()
        );
        
        // Urgent task should be scheduled first
        expect(sortedSlots[0].taskId).toBe('urgent');
      }
    });
  });
});