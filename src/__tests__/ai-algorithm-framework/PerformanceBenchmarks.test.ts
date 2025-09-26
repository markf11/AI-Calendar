import { ConstraintSatisfactionSolver } from '@/services/ConstraintSatisfactionSolver';
import { PriorityScoringService } from '@/services/PriorityScoringService';
import { TimeSlotGenerationService } from '@/services/TimeSlotGenerationService';
import { Task } from '@/models/Task';
import { User } from '@/models/User';
import { ConstraintCollection } from '@/models/Constraint';
import { AvailableSlot } from '@/models/types';

/**
 * Performance benchmark test suite for AI scheduling algorithms
 * Tests performance under various load conditions and complexity scenarios
 */
describe('AI Algorithm - Performance Benchmarks', () => {
  let solver: ConstraintSatisfactionSolver;
  let timeSlotService: jest.Mocked<TimeSlotGenerationService>;

  const mockUser: User = {
    id: 'perf-test-user',
    email: 'perf@example.com',
    name: 'Performance Test User',
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

  describe('Scalability Benchmarks', () => {
    it('should handle small workloads efficiently (< 10 tasks)', async () => {
      const tasks = generateTasks(5, 'small');
      const slots = generateTimeSlots(10);
      
      timeSlotService.generateTaskSlots.mockResolvedValue(slots);

      const startTime = performance.now();
      const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(100); // < 100ms for small workloads
      expect(result.scheduledTasks.length).toBeGreaterThanOrEqual(tasks.length * 0.8);
      
      console.log(`Small workload (${tasks.length} tasks): ${executionTime.toFixed(2)}ms`);
    });

    it('should handle medium workloads efficiently (10-50 tasks)', async () => {
      const tasks = generateTasks(25, 'medium');
      const slots = generateTimeSlots(50);
      
      timeSlotService.generateTaskSlots.mockResolvedValue(slots);

      const startTime = performance.now();
      const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(1000); // < 1s for medium workloads
      expect(result.scheduledTasks.length).toBeGreaterThanOrEqual(tasks.length * 0.7);
      
      console.log(`Medium workload (${tasks.length} tasks): ${executionTime.toFixed(2)}ms`);
    });

    it('should handle large workloads within acceptable limits (50-100 tasks)', async () => {
      const tasks = generateTasks(75, 'large');
      const slots = generateTimeSlots(150);
      
      timeSlotService.generateTaskSlots.mockResolvedValue(slots);

      const startTime = performance.now();
      const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(5000); // < 5s for large workloads
      expect(result.scheduledTasks.length).toBeGreaterThanOrEqual(tasks.length * 0.6);
      
      console.log(`Large workload (${tasks.length} tasks): ${executionTime.toFixed(2)}ms`);
    });

    it('should gracefully handle very large workloads (100+ tasks)', async () => {
      const tasks = generateTasks(150, 'xlarge');
      const slots = generateTimeSlots(300);
      
      timeSlotService.generateTaskSlots.mockResolvedValue(slots);

      const startTime = performance.now();
      const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), [], {
        maxDepth: 100,
        timeLimitMs: 10000,
        allowSoftViolations: true
      });
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(result).toBeDefined();
      expect(executionTime).toBeLessThan(15000); // < 15s for very large workloads
      expect(result.scheduledTasks.length).toBeGreaterThanOrEqual(tasks.length * 0.5);
      
      console.log(`XLarge workload (${tasks.length} tasks): ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Complexity Benchmarks', () => {
    it('should handle complex dependency chains efficiently', async () => {
      const tasks = generateDependencyChain(20); // 20-task linear dependency chain
      const slots = generateTimeSlots(25);
      
      timeSlotService.generateTaskSlots.mockResolvedValue(slots);

      const startTime = performance.now();
      const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(2000); // < 2s for complex dependencies
      expect(result.scheduledTasks).toHaveLength(20);
      
      // Verify dependency order is maintained
      const sortedTasks = result.scheduledTasks.sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime()
      );
      
      for (let i = 0; i < sortedTasks.length; i++) {
        expect(sortedTasks[i].taskId).toBe(`dep-task-${i}`);
      }
      
      console.log(`Complex dependencies (${tasks.length} tasks): ${executionTime.toFixed(2)}ms`);
    });

    it('should handle diamond dependency patterns efficiently', async () => {
      const tasks = generateDiamondDependencies(5); // 5 diamond patterns = 20 tasks
      const slots = generateTimeSlots(25);
      
      timeSlotService.generateTaskSlots.mockResolvedValue(slots);

      const startTime = performance.now();
      const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(3000); // < 3s for diamond patterns
      expect(result.scheduledTasks.length).toBeGreaterThanOrEqual(tasks.length * 0.8);
      
      console.log(`Diamond dependencies (${tasks.length} tasks): ${executionTime.toFixed(2)}ms`);
    });

    it('should handle mixed priority scenarios efficiently', async () => {
      const tasks = generateMixedPriorityTasks(50);
      const slots = generateTimeSlots(60);
      
      // Mock complex priority scoring
      jest.spyOn(PriorityScoringService, 'calculateRelativePriorities').mockImplementation((taskList) => {
        return taskList.map((task, index) => ({
          task,
          priorityScore: Math.random() * 100, // Random scores to simulate complex priority calculation
          rank: index + 1
        }));
      });
      
      timeSlotService.generateTaskSlots.mockResolvedValue(slots);

      const startTime = performance.now();
      const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(2000); // < 2s for mixed priorities
      expect(result.scheduledTasks.length).toBeGreaterThanOrEqual(tasks.length * 0.7);
      
      console.log(`Mixed priorities (${tasks.length} tasks): ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage Benchmarks', () => {
    it('should maintain reasonable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      
      const tasks = generateTasks(100, 'memory-test');
      const slots = generateTimeSlots(200);
      
      timeSlotService.generateTaskSlots.mockResolvedValue(slots);

      const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      expect(result).toBeDefined();
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // < 50MB increase
      
      console.log(`Memory increase for 100 tasks: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should handle memory efficiently with frequent garbage collection', async () => {
      const iterations = 10;
      const tasksPerIteration = 20;
      
      for (let i = 0; i < iterations; i++) {
        const tasks = generateTasks(tasksPerIteration, `gc-test-${i}`);
        const slots = generateTimeSlots(30);
        
        timeSlotService.generateTaskSlots.mockResolvedValue(slots);
        
        const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);
        expect(result).toBeDefined();
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage();
      console.log(`Final memory after ${iterations} iterations: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Concurrent Operations Benchmarks', () => {
    it('should handle multiple concurrent scheduling requests', async () => {
      const concurrentRequests = 5;
      const tasksPerRequest = 20;
      
      const promises = Array.from({ length: concurrentRequests }, (_, i) => {
        const tasks = generateTasks(tasksPerRequest, `concurrent-${i}`);
        const slots = generateTimeSlots(30);
        
        timeSlotService.generateTaskSlots.mockResolvedValue(slots);
        
        return solver.solve(tasks, mockUser, createEmptyConstraints(), []);
      });

      const startTime = performance.now();
      const results = await Promise.all(promises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;

      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.scheduledTasks.length).toBeGreaterThan(0);
      });

      expect(totalTime).toBeLessThan(5000); // < 5s for 5 concurrent requests
      
      console.log(`${concurrentRequests} concurrent requests: ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Real-world Scenario Benchmarks', () => {
    it('should handle typical daily schedule efficiently', async () => {
      // Simulate a typical workday: 8-10 tasks, mixed priorities, some dependencies
      const tasks = [
        ...generateTasks(3, 'morning', { priority: 'high', duration: 60 }),
        ...generateTasks(4, 'midday', { priority: 'medium', duration: 45 }),
        ...generateTasks(3, 'afternoon', { priority: 'low', duration: 30 }),
        createTask({
          id: 'urgent-task',
          title: 'Urgent Task',
          priority: 'critical',
          duration: 90,
          deadline: new Date(Date.now() + 4 * 60 * 60 * 1000),
          isHardDeadline: true
        })
      ];

      // Add some dependencies
      tasks[1].dependencies = [tasks[0].id];
      tasks[5].dependencies = [tasks[4].id];

      const slots = generateWorkdaySlots(); // 8-hour workday with lunch break
      
      timeSlotService.generateTaskSlots.mockResolvedValue(slots);

      const startTime = performance.now();
      const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(500); // < 500ms for typical daily schedule
      expect(result.scheduledTasks.length).toBeGreaterThanOrEqual(tasks.length * 0.8);
      
      console.log(`Typical daily schedule (${tasks.length} tasks): ${executionTime.toFixed(2)}ms`);
    });

    it('should handle weekly planning efficiently', async () => {
      // Simulate weekly planning: 30-40 tasks across multiple projects
      const projects = ['project-a', 'project-b', 'project-c'];
      const tasks = projects.flatMap(projectId => 
        generateTasks(12, projectId, { projectId })
      );

      // Add cross-project dependencies
      tasks[5].dependencies = [tasks[0].id]; // Project B depends on Project A
      tasks[15].dependencies = [tasks[10].id]; // Project C depends on Project B

      const slots = generateWeeklySlots(); // 5-day work week
      
      timeSlotService.generateTaskSlots.mockResolvedValue(slots);

      const startTime = performance.now();
      const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(3000); // < 3s for weekly planning
      expect(result.scheduledTasks.length).toBeGreaterThanOrEqual(tasks.length * 0.7);
      
      console.log(`Weekly planning (${tasks.length} tasks): ${executionTime.toFixed(2)}ms`);
    });
  });

  // Helper functions
  function generateTasks(count: number, prefix: string, overrides: Partial<Task> = {}): Task[] {
    return Array.from({ length: count }, (_, i) => 
      createTask({
        id: `${prefix}-task-${i}`,
        title: `${prefix} Task ${i}`,
        duration: 30 + (i % 90), // 30-120 minutes
        priority: ['low', 'medium', 'high', 'critical'][i % 4] as any,
        ...overrides
      })
    );
  }

  function generateDependencyChain(count: number): Task[] {
    return Array.from({ length: count }, (_, i) => 
      createTask({
        id: `dep-task-${i}`,
        title: `Dependency Task ${i}`,
        duration: 30,
        dependencies: i > 0 ? [`dep-task-${i - 1}`] : []
      })
    );
  }

  function generateDiamondDependencies(diamonds: number): Task[] {
    const tasks: Task[] = [];
    
    for (let d = 0; d < diamonds; d++) {
      const base = d * 4;
      
      // Root task
      tasks.push(createTask({
        id: `diamond-${d}-root`,
        title: `Diamond ${d} Root`,
        duration: 30
      }));
      
      // Two parallel tasks depending on root
      tasks.push(createTask({
        id: `diamond-${d}-left`,
        title: `Diamond ${d} Left`,
        duration: 30,
        dependencies: [`diamond-${d}-root`]
      }));
      
      tasks.push(createTask({
        id: `diamond-${d}-right`,
        title: `Diamond ${d} Right`,
        duration: 30,
        dependencies: [`diamond-${d}-root`]
      }));
      
      // Merge task depending on both parallel tasks
      tasks.push(createTask({
        id: `diamond-${d}-merge`,
        title: `Diamond ${d} Merge`,
        duration: 30,
        dependencies: [`diamond-${d}-left`, `diamond-${d}-right`]
      }));
    }
    
    return tasks;
  }

  function generateMixedPriorityTasks(count: number): Task[] {
    return Array.from({ length: count }, (_, i) => {
      const hasDeadline = i % 3 === 0;
      const isBlocking = i % 7 === 0;
      
      return createTask({
        id: `mixed-task-${i}`,
        title: `Mixed Task ${i}`,
        duration: 15 + (i % 105), // 15-120 minutes
        priority: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as any,
        deadline: hasDeadline ? new Date(Date.now() + (1 + i % 8) * 60 * 60 * 1000) : undefined,
        isHardDeadline: hasDeadline && i % 2 === 0,
        isBlocking
      });
    });
  }

  function generateTimeSlots(count: number): AvailableSlot[] {
    const baseDate = new Date('2024-01-15T09:00:00Z');
    
    return Array.from({ length: count }, (_, i) => {
      const startTime = new Date(baseDate.getTime() + i * 30 * 60 * 1000); // 30-minute slots
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
      
      return {
        startTime,
        endTime,
        duration: 30
      };
    });
  }

  function generateWorkdaySlots(): AvailableSlot[] {
    const slots: AvailableSlot[] = [];
    const baseDate = new Date('2024-01-15T09:00:00Z');
    
    // Morning: 9 AM - 12 PM (3 hours)
    for (let i = 0; i < 6; i++) {
      const startTime = new Date(baseDate.getTime() + i * 30 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
      slots.push({ startTime, endTime, duration: 30 });
    }
    
    // Afternoon: 1 PM - 5 PM (4 hours)
    for (let i = 0; i < 8; i++) {
      const startTime = new Date(baseDate.getTime() + (8 + i) * 30 * 60 * 1000); // Skip lunch hour
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
      slots.push({ startTime, endTime, duration: 30 });
    }
    
    return slots;
  }

  function generateWeeklySlots(): AvailableSlot[] {
    const slots: AvailableSlot[] = [];
    
    // 5 days × 7 hours per day × 2 slots per hour = 70 slots
    for (let day = 0; day < 5; day++) {
      for (let hour = 0; hour < 14; hour++) { // 7 hours × 2 slots
        if (hour >= 6 && hour < 8) continue; // Skip lunch slots
        
        const baseTime = new Date('2024-01-15T09:00:00Z').getTime();
        const dayOffset = day * 24 * 60 * 60 * 1000;
        const hourOffset = hour * 30 * 60 * 1000;
        
        const startTime = new Date(baseTime + dayOffset + hourOffset);
        const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
        
        slots.push({ startTime, endTime, duration: 30 });
      }
    }
    
    return slots;
  }

  function createTask(overrides: Partial<Task> = {}): Task {
    return {
      id: `task-${Math.random().toString(36).substr(2, 9)}`,
      userId: 'perf-test-user',
      title: 'Performance Test Task',
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

  function createEmptyConstraints(): ConstraintCollection {
    return {
      userId: 'perf-test-user',
      constraints: [],
      collectedAt: new Date(),
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }
});