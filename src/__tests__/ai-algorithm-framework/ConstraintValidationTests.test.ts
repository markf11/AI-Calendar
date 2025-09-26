import { ConstraintSatisfactionSolver } from '@/services/ConstraintSatisfactionSolver';
import { PriorityScoringService } from '@/services/PriorityScoringService';
import { TimeSlotGenerationService } from '@/services/TimeSlotGenerationService';
import { ConstraintCollectionService } from '@/services/ConstraintCollectionService';
import { Task } from '@/models/Task';
import { User } from '@/models/User';
import { ConstraintCollection, Constraint } from '@/models/Constraint';
import { AvailableSlot } from '@/models/types';

/**
 * Comprehensive constraint validation test suite for AI scheduling algorithms
 * Tests various constraint scenarios to ensure the AI respects all scheduling rules
 */
describe('AI Algorithm - Constraint Validation Framework', () => {
  let solver: ConstraintSatisfactionSolver;
  let constraintService: ConstraintCollectionService;
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
      friday: { start: '09:00', end: '17:00' },
      lunchBreak: { start: '12:00', end: '13:00' }
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

    constraintService = new ConstraintCollectionService({} as any, {} as any);
    solver = new ConstraintSatisfactionSolver(PriorityScoringService, timeSlotService);
  });

  describe('Working Hours Constraint Validation', () => {
    it('should reject tasks scheduled outside working hours', async () => {
      const task = createTask({ title: 'After Hours Task', duration: 60 });
      
      const constraints = createConstraintCollection([
        createWorkingHoursConstraint(1, '09:00', '17:00') // Monday 9-5
      ]);

      // Mock slots outside working hours
      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T18:00:00Z', '2024-01-15T19:00:00Z') // 6-7 PM
      ]);

      const result = await solver.solve([task], mockUser, constraints, []);

      expect(result.violations).toContainEqual(
        expect.objectContaining({
          constraintType: 'working_hours',
          severity: 'error'
        })
      );
    });

    it('should respect lunch break constraints', async () => {
      const task = createTask({ title: 'Lunch Time Task', duration: 120 });
      
      const constraints = createConstraintCollection([
        createWorkingHoursConstraint(1, '09:00', '17:00'),
        createLunchBreakConstraint('12:00', '13:00')
      ]);

      // Mock slot that would overlap with lunch
      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T11:30:00Z', '2024-01-15T13:30:00Z') // 11:30 AM - 1:30 PM
      ]);

      const result = await solver.solve([task], mockUser, constraints, []);

      if (result.success) {
        // If scheduled, should not overlap with lunch break
        const scheduledSlot = result.scheduledTasks[0];
        const lunchStart = new Date('2024-01-15T12:00:00Z');
        const lunchEnd = new Date('2024-01-15T13:00:00Z');
        
        const noOverlap = scheduledSlot.endTime <= lunchStart || scheduledSlot.startTime >= lunchEnd;
        expect(noOverlap).toBe(true);
      } else {
        expect(result.violations).toContainEqual(
          expect.objectContaining({
            constraintType: 'lunch_break'
          })
        );
      }
    });

    it('should handle multiple working hour constraints across days', async () => {
      const tasks = [
        createTask({ title: 'Monday Task', duration: 60 }),
        createTask({ title: 'Tuesday Task', duration: 60 }),
        createTask({ title: 'Weekend Task', duration: 60 })
      ];

      const constraints = createConstraintCollection([
        createWorkingHoursConstraint(1, '09:00', '17:00'), // Monday
        createWorkingHoursConstraint(2, '10:00', '16:00'), // Tuesday - different hours
        // No weekend constraints (Saturday/Sunday)
      ]);

      timeSlotService.generateTaskSlots
        .mockResolvedValueOnce([createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z')]) // Monday
        .mockResolvedValueOnce([createSlot('2024-01-16T10:00:00Z', '2024-01-16T11:00:00Z')]) // Tuesday
        .mockResolvedValueOnce([createSlot('2024-01-20T10:00:00Z', '2024-01-20T11:00:00Z')]); // Saturday

      const result = await solver.solve(tasks, mockUser, constraints, []);

      // Should schedule Monday and Tuesday tasks, reject weekend task
      expect(result.scheduledTasks).toHaveLength(2);
      expect(result.violations.some(v => v.taskId === tasks[2].id)).toBe(true);
    });
  });

  describe('Deadline Constraint Validation', () => {
    it('should prioritize hard deadlines over soft deadlines', async () => {
      const hardDeadlineTask = createTask({
        title: 'Hard Deadline Task',
        duration: 60,
        deadline: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        isHardDeadline: true,
        priority: 'medium'
      });

      const softDeadlineTask = createTask({
        title: 'Soft Deadline Task',
        duration: 60,
        deadline: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour from now (sooner!)
        isHardDeadline: false,
        priority: 'high'
      });

      jest.spyOn(PriorityScoringService, 'calculateRelativePriorities').mockReturnValue([
        { task: hardDeadlineTask, priorityScore: 100, rank: 1 }, // Hard deadline wins
        { task: softDeadlineTask, priorityScore: 60, rank: 2 }
      ]);

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
        createSlot('2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z')
      ]);

      const result = await solver.solve(
        [softDeadlineTask, hardDeadlineTask], 
        mockUser, 
        createConstraintCollection([]), 
        []
      );

      expect(result.success).toBe(true);
      
      // Hard deadline task should be scheduled first
      const sortedTasks = result.scheduledTasks.sort((a, b) => 
        a.startTime.getTime() - b.startTime.getTime()
      );
      expect(sortedTasks[0].taskId).toBe(hardDeadlineTask.id);
    });

    it('should detect impossible deadline scenarios', async () => {
      const impossibleTask = createTask({
        title: 'Impossible Task',
        duration: 240, // 4 hours
        deadline: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        isHardDeadline: true
      });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z') // Only 1 hour available
      ]);

      const result = await solver.solve([impossibleTask], mockUser, createConstraintCollection([]), []);

      expect(result.success).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          constraintType: 'deadline',
          severity: 'error',
          taskId: impossibleTask.id
        })
      );
    });

    it('should handle multiple overlapping deadlines', async () => {
      const task1 = createTask({
        title: 'Task 1',
        duration: 120,
        deadline: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours
        isHardDeadline: true
      });

      const task2 = createTask({
        title: 'Task 2', 
        duration: 120,
        deadline: new Date(Date.now() + 3 * 60 * 60 * 1000), // Same deadline
        isHardDeadline: true
      });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T11:00:00Z'), // 2 hours
        createSlot('2024-01-15T11:00:00Z', '2024-01-15T13:00:00Z')  // 2 hours
      ]);

      const result = await solver.solve([task1, task2], mockUser, createConstraintCollection([]), []);

      // Should schedule both tasks before their shared deadline
      if (result.success) {
        result.scheduledTasks.forEach(slot => {
          expect(slot.endTime.getTime()).toBeLessThanOrEqual(task1.deadline!.getTime());
        });
      } else {
        // If can't fit both, should report deadline violations
        expect(result.violations.some(v => v.constraintType === 'deadline')).toBe(true);
      }
    });
  });

  describe('Dependency Constraint Validation', () => {
    it('should enforce strict dependency ordering', async () => {
      const taskA = createTask({ id: 'task-a', title: 'Task A', duration: 60 });
      const taskB = createTask({ 
        id: 'task-b', 
        title: 'Task B', 
        duration: 60, 
        dependencies: ['task-a'] 
      });
      const taskC = createTask({ 
        id: 'task-c', 
        title: 'Task C', 
        duration: 60, 
        dependencies: ['task-b'] 
      });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'),
        createSlot('2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z'),
        createSlot('2024-01-15T11:00:00Z', '2024-01-15T12:00:00Z')
      ]);

      const result = await solver.solve([taskC, taskB, taskA], mockUser, createConstraintCollection([]), []);

      expect(result.success).toBe(true);
      expect(result.scheduledTasks).toHaveLength(3);

      // Verify dependency order: A -> B -> C
      const sortedTasks = result.scheduledTasks.sort((a, b) => 
        a.startTime.getTime() - b.startTime.getTime()
      );

      expect(sortedTasks[0].taskId).toBe('task-a');
      expect(sortedTasks[1].taskId).toBe('task-b');
      expect(sortedTasks[2].taskId).toBe('task-c');

      // Verify no time overlap between dependent tasks
      expect(sortedTasks[0].endTime.getTime()).toBeLessThanOrEqual(sortedTasks[1].startTime.getTime());
      expect(sortedTasks[1].endTime.getTime()).toBeLessThanOrEqual(sortedTasks[2].startTime.getTime());
    });

    it('should detect and handle circular dependencies', async () => {
      const taskA = createTask({ 
        id: 'task-a', 
        title: 'Task A', 
        dependencies: ['task-b'] 
      });
      const taskB = createTask({ 
        id: 'task-b', 
        title: 'Task B', 
        dependencies: ['task-a'] 
      });

      const result = await solver.solve([taskA, taskB], mockUser, createConstraintCollection([]), []);

      expect(result.violations).toContainEqual(
        expect.objectContaining({
          constraintType: 'circular_dependency',
          severity: 'error'
        })
      );
    });

    it('should handle complex dependency graphs', async () => {
      // Create a diamond dependency pattern: A -> B,C -> D
      const taskA = createTask({ id: 'task-a', title: 'Task A', duration: 30 });
      const taskB = createTask({ 
        id: 'task-b', 
        title: 'Task B', 
        duration: 30, 
        dependencies: ['task-a'] 
      });
      const taskC = createTask({ 
        id: 'task-c', 
        title: 'Task C', 
        duration: 30, 
        dependencies: ['task-a'] 
      });
      const taskD = createTask({ 
        id: 'task-d', 
        title: 'Task D', 
        duration: 30, 
        dependencies: ['task-b', 'task-c'] 
      });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T09:30:00Z'),
        createSlot('2024-01-15T09:30:00Z', '2024-01-15T10:00:00Z'),
        createSlot('2024-01-15T10:00:00Z', '2024-01-15T10:30:00Z'),
        createSlot('2024-01-15T10:30:00Z', '2024-01-15T11:00:00Z')
      ]);

      const result = await solver.solve([taskD, taskC, taskB, taskA], mockUser, createConstraintCollection([]), []);

      expect(result.success).toBe(true);
      expect(result.scheduledTasks).toHaveLength(4);

      const taskSlots = new Map(result.scheduledTasks.map(slot => [slot.taskId, slot]));
      
      // A must complete before B and C
      expect(taskSlots.get('task-a')!.endTime.getTime())
        .toBeLessThanOrEqual(taskSlots.get('task-b')!.startTime.getTime());
      expect(taskSlots.get('task-a')!.endTime.getTime())
        .toBeLessThanOrEqual(taskSlots.get('task-c')!.startTime.getTime());
      
      // Both B and C must complete before D
      expect(taskSlots.get('task-b')!.endTime.getTime())
        .toBeLessThanOrEqual(taskSlots.get('task-d')!.startTime.getTime());
      expect(taskSlots.get('task-c')!.endTime.getTime())
        .toBeLessThanOrEqual(taskSlots.get('task-d')!.startTime.getTime());
    });
  });

  describe('Blocking Task Constraint Validation', () => {
    it('should not split blocking tasks across multiple slots', async () => {
      const blockingTask = createTask({
        title: 'Blocking Task',
        duration: 180, // 3 hours
        isBlocking: true
      });

      // Mock fragmented available time
      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'), // 1 hour
        createSlot('2024-01-15T11:00:00Z', '2024-01-15T12:00:00Z'), // 1 hour  
        createSlot('2024-01-15T13:00:00Z', '2024-01-15T14:00:00Z')  // 1 hour
      ]);

      const result = await solver.solve([blockingTask], mockUser, createConstraintCollection([]), []);

      // Should either find a 3-hour continuous slot or fail to schedule
      if (result.success) {
        expect(result.scheduledTasks).toHaveLength(1);
        expect(result.scheduledTasks[0].duration).toBe(180);
      } else {
        expect(result.unscheduledTasks).toContain(blockingTask);
      }
    });

    it('should allow splitting non-blocking tasks', async () => {
      const nonBlockingTask = createTask({
        title: 'Non-Blocking Task',
        duration: 180, // 3 hours
        isBlocking: false
      });

      // Mock fragmented available time
      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T10:00:00Z'), // 1 hour
        createSlot('2024-01-15T11:00:00Z', '2024-01-15T12:00:00Z'), // 1 hour
        createSlot('2024-01-15T13:00:00Z', '2024-01-15T14:00:00Z')  // 1 hour
      ]);

      const result = await solver.solve([nonBlockingTask], mockUser, createConstraintCollection([]), []);

      expect(result.success).toBe(true);
      
      // Task should be split across multiple slots
      const taskSlots = result.scheduledTasks.filter(slot => slot.taskId === nonBlockingTask.id);
      expect(taskSlots.length).toBeGreaterThan(1);
      
      // Total duration should match original task
      const totalDuration = taskSlots.reduce((sum, slot) => sum + slot.duration, 0);
      expect(totalDuration).toBe(180);
    });
  });

  describe('Energy and Preference Constraint Validation', () => {
    it('should respect high energy time preferences for critical tasks', async () => {
      const criticalTask = createTask({
        title: 'Critical Task',
        priority: 'critical',
        duration: 60
      });

      const lowTask = createTask({
        title: 'Low Priority Task',
        priority: 'low',
        duration: 60
      });

      // Mock slots during high and low energy times
      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:30:00Z', '2024-01-15T10:30:00Z'), // High energy time
        createSlot('2024-01-15T14:30:00Z', '2024-01-15T15:30:00Z')  // Low energy time
      ]);

      const result = await solver.solve([lowTask, criticalTask], mockUser, createConstraintCollection([]), []);

      if (result.success && result.scheduledTasks.length === 2) {
        const criticalSlot = result.scheduledTasks.find(s => s.taskId === criticalTask.id);
        
        // Critical task should be scheduled during high energy time (9-11 AM)
        expect(criticalSlot!.startTime.getHours()).toBeLessThan(11);
      }
    });

    it('should respect maximum continuous work time limits', async () => {
      const longTask = createTask({
        title: 'Long Task',
        duration: 180, // 3 hours (exceeds 2-hour limit)
        isBlocking: false
      });

      timeSlotService.generateTaskSlots.mockResolvedValue([
        createSlot('2024-01-15T09:00:00Z', '2024-01-15T12:00:00Z') // 3 hour continuous slot
      ]);

      const result = await solver.solve([longTask], mockUser, createConstraintCollection([]), []);

      if (result.success) {
        const taskSlots = result.scheduledTasks.filter(s => s.taskId === longTask.id);
        
        // Should be split to respect max continuous work time (120 minutes)
        taskSlots.forEach(slot => {
          expect(slot.duration).toBeLessThanOrEqual(120);
        });
      }
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

  function createConstraintCollection(constraints: Constraint[]): ConstraintCollection {
    return {
      userId: 'test-user',
      constraints,
      collectedAt: new Date(),
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }

  function createWorkingHoursConstraint(dayOfWeek: number, start: string, end: string): Constraint {
    return {
      id: `wh-${dayOfWeek}`,
      type: 'working_hours',
      priority: 100,
      description: `Working hours for day ${dayOfWeek}`,
      dayOfWeek,
      timeRange: { start, end },
      timezone: 'America/New_York'
    } as any;
  }

  function createLunchBreakConstraint(start: string, end: string): Constraint {
    return {
      id: 'lunch-break',
      type: 'lunch_break',
      priority: 90,
      description: 'Lunch break',
      timeRange: { start, end },
      timezone: 'America/New_York'
    } as any;
  }
});