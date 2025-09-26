import { ConstraintSatisfactionSolver } from '@/services/ConstraintSatisfactionSolver';
import { PriorityScoringService } from '@/services/PriorityScoringService';
import { TimeSlotGenerationService } from '@/services/TimeSlotGenerationService';
import { Task } from '@/models/Task';
import { User } from '@/models/User';
import { ConstraintCollection } from '@/models/Constraint';
import { AvailableSlot } from '@/models/types';

/**
 * Load testing suite for AI scheduling algorithms
 * Tests system behavior under high concurrent load and stress conditions
 */
describe('AI Algorithm - Load Testing Framework', () => {
  let solver: ConstraintSatisfactionSolver;
  let timeSlotService: jest.Mocked<TimeSlotGenerationService>;

  const mockUser: User = {
    id: 'load-test-user',
    email: 'load@example.com',
    name: 'Load Test User',
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

  describe('Concurrent User Load Tests', () => {
    it('should handle multiple users scheduling simultaneously', async () => {
      const userCount = 10;
      const tasksPerUser = 15;
      
      const users = Array.from({ length: userCount }, (_, i) => ({
        ...mockUser,
        id: `load-user-${i}`,
        email: `load-user-${i}@example.com`
      }));

      const schedulingPromises = users.map(async (user, userIndex) => {
        const tasks = generateTasksForUser(user.id, tasksPerUser);
        const slots = generateTimeSlots(25);
        
        timeSlotService.generateTaskSlots.mockResolvedValue(slots);
        
        const startTime = performance.now();
        const result = await solver.solve(tasks, user, createEmptyConstraints(), []);
        const endTime = performance.now();
        
        return {
          userId: user.id,
          result,
          executionTime: endTime - startTime,
          tasksScheduled: result.scheduledTasks.length,
          success: result.success
        };
      });

      const results = await Promise.all(schedulingPromises);
      
      // Verify all users got results
      expect(results).toHaveLength(userCount);
      
      // Check success rate
      const successfulSchedules = results.filter(r => r.success).length;
      expect(successfulSchedules).toBeGreaterThanOrEqual(userCount * 0.8); // 80% success rate
      
      // Check performance under load
      const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
      expect(avgExecutionTime).toBeLessThan(2000); // < 2s average under concurrent load
      
      console.log(`Concurrent users test: ${userCount} users, avg time: ${avgExecutionTime.toFixed(2)}ms`);
    });

    it('should maintain performance with high concurrent request volume', async () => {
      const concurrentRequests = 25;
      const tasksPerRequest = 10;
      
      const requestPromises = Array.from({ length: concurrentRequests }, async (_, i) => {
        const tasks = generateTasks(tasksPerRequest, `concurrent-${i}`);
        const slots = generateTimeSlots(15);
        
        timeSlotService.generateTaskSlots.mockResolvedValue(slots);
        
        const startTime = performance.now();
        const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);
        const endTime = performance.now();
        
        return {
          requestId: i,
          executionTime: endTime - startTime,
          success: result.success,
          tasksScheduled: result.scheduledTasks.length
        };
      });

      const startTime = performance.now();
      const results = await Promise.all(requestPromises);
      const totalTime = performance.now() - startTime;
      
      // Verify all requests completed
      expect(results).toHaveLength(concurrentRequests);
      
      // Check throughput
      const requestsPerSecond = (concurrentRequests / totalTime) * 1000;
      expect(requestsPerSecond).toBeGreaterThan(5); // At least 5 requests/second
      
      // Check individual request performance
      const maxExecutionTime = Math.max(...results.map(r => r.executionTime));
      expect(maxExecutionTime).toBeLessThan(5000); // No request should take > 5s
      
      console.log(`High volume test: ${concurrentRequests} requests, ${requestsPerSecond.toFixed(2)} req/s`);
    });
  });

  describe('Memory Pressure Load Tests', () => {
    it('should handle memory pressure with large datasets', async () => {
      const iterations = 20;
      const tasksPerIteration = 50;
      
      const memoryUsages: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const tasks = generateTasks(tasksPerIteration, `memory-pressure-${i}`);
        const slots = generateTimeSlots(75);
        
        timeSlotService.generateTaskSlots.mockResolvedValue(slots);
        
        const memoryBefore = process.memoryUsage().heapUsed;
        
        const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);
        
        const memoryAfter = process.memoryUsage().heapUsed;
        const memoryIncrease = memoryAfter - memoryBefore;
        memoryUsages.push(memoryIncrease);
        
        expect(result).toBeDefined();
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      // Check memory usage patterns
      const avgMemoryIncrease = memoryUsages.reduce((sum, usage) => sum + usage, 0) / memoryUsages.length;
      const maxMemoryIncrease = Math.max(...memoryUsages);
      
      expect(avgMemoryIncrease).toBeLessThan(10 * 1024 * 1024); // < 10MB average increase
      expect(maxMemoryIncrease).toBeLessThan(50 * 1024 * 1024); // < 50MB max increase
      
      console.log(`Memory pressure test: avg ${(avgMemoryIncrease / 1024 / 1024).toFixed(2)}MB, max ${(maxMemoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should handle memory leaks in long-running scenarios', async () => {
      const longRunIterations = 100;
      const tasksPerIteration = 10;
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      for (let i = 0; i < longRunIterations; i++) {
        const tasks = generateTasks(tasksPerIteration, `long-run-${i}`);
        const slots = generateTimeSlots(15);
        
        timeSlotService.generateTaskSlots.mockResolvedValue(slots);
        
        const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);
        expect(result).toBeDefined();
        
        // Periodic garbage collection
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }
      
      // Final garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth should be reasonable for long-running scenarios
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // < 100MB growth after 100 iterations
      
      console.log(`Long-run test: ${longRunIterations} iterations, ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB growth`);
    });
  });

  describe('Stress Testing with Complex Scenarios', () => {
    it('should handle stress test with maximum complexity', async () => {
      const taskCount = 100;
      const dependencyDensity = 0.3; // 30% of tasks have dependencies
      const deadlineRatio = 0.4; // 40% of tasks have deadlines
      
      const tasks = generateComplexStressTestTasks(taskCount, dependencyDensity, deadlineRatio);
      const slots = generateTimeSlots(150);
      
      timeSlotService.generateTaskSlots.mockResolvedValue(slots);
      
      const startTime = performance.now();
      const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), [], {
        maxDepth: 200,
        timeLimitMs: 30000, // 30 second limit
        allowSoftViolations: true
      });
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(result).toBeDefined();
      expect(executionTime).toBeLessThan(35000); // Should complete within time limit + buffer
      
      // Should schedule a reasonable percentage even under stress
      expect(result.scheduledTasks.length).toBeGreaterThanOrEqual(taskCount * 0.4);
      
      console.log(`Stress test: ${taskCount} tasks, ${executionTime.toFixed(2)}ms, ${result.scheduledTasks.length} scheduled`);
    });

    it('should handle burst load scenarios', async () => {
      const burstSize = 50;
      const burstCount = 5;
      const burstInterval = 100; // ms between bursts
      
      const burstResults: any[] = [];
      
      for (let burst = 0; burst < burstCount; burst++) {
        const burstPromises = Array.from({ length: burstSize }, async (_, i) => {
          const tasks = generateTasks(5, `burst-${burst}-${i}`);
          const slots = generateTimeSlots(8);
          
          timeSlotService.generateTaskSlots.mockResolvedValue(slots);
          
          const startTime = performance.now();
          const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);
          const endTime = performance.now();
          
          return {
            burstId: burst,
            requestId: i,
            executionTime: endTime - startTime,
            success: result.success
          };
        });
        
        const burstStartTime = performance.now();
        const results = await Promise.all(burstPromises);
        const burstEndTime = performance.now();
        
        burstResults.push({
          burstId: burst,
          burstTime: burstEndTime - burstStartTime,
          results
        });
        
        // Wait between bursts
        if (burst < burstCount - 1) {
          await new Promise(resolve => setTimeout(resolve, burstInterval));
        }
      }
      
      // Analyze burst performance
      const totalRequests = burstSize * burstCount;
      const successfulRequests = burstResults.flatMap(b => b.results).filter(r => r.success).length;
      const successRate = successfulRequests / totalRequests;
      
      expect(successRate).toBeGreaterThan(0.8); // 80% success rate under burst load
      
      console.log(`Burst load test: ${burstCount} bursts of ${burstSize}, ${(successRate * 100).toFixed(1)}% success rate`);
    });
  });

  describe('Resource Exhaustion Tests', () => {
    it('should gracefully handle CPU-intensive scenarios', async () => {
      const cpuIntensiveTasks = generateCPUIntensiveTasks(30);
      const slots = generateTimeSlots(50);
      
      timeSlotService.generateTaskSlots.mockResolvedValue(slots);
      
      const startTime = performance.now();
      const result = await solver.solve(cpuIntensiveTasks, mockUser, createEmptyConstraints(), [], {
        maxDepth: 500, // High depth to increase CPU usage
        timeLimitMs: 10000
      });
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(result).toBeDefined();
      expect(executionTime).toBeLessThan(15000); // Should respect time limits
      
      console.log(`CPU intensive test: ${executionTime.toFixed(2)}ms for ${cpuIntensiveTasks.length} complex tasks`);
    });

    it('should handle timeout scenarios gracefully', async () => {
      const timeoutTasks = generateTasks(200, 'timeout-test');
      const slots = generateTimeSlots(300);
      
      timeSlotService.generateTaskSlots.mockResolvedValue(slots);
      
      const result = await solver.solve(timeoutTasks, mockUser, createEmptyConstraints(), [], {
        maxDepth: 1000,
        timeLimitMs: 1000, // Very short timeout
        allowSoftViolations: true
      });
      
      expect(result).toBeDefined();
      expect(result.solvingTimeMs).toBeLessThan(2000); // Should timeout gracefully
      
      // Should return partial results even on timeout
      expect(result.scheduledTasks.length).toBeGreaterThan(0);
      
      console.log(`Timeout test: ${result.scheduledTasks.length} tasks scheduled before timeout`);
    });
  });

  describe('Degraded Performance Tests', () => {
    it('should maintain functionality under simulated network delays', async () => {
      const tasks = generateTasks(20, 'network-delay');
      const slots = generateTimeSlots(30);
      
      // Simulate network delay in time slot generation
      timeSlotService.generateTaskSlots.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        return slots;
      });
      
      const startTime = performance.now();
      const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(executionTime).toBeGreaterThan(100); // Should include the delay
      expect(result.scheduledTasks.length).toBeGreaterThan(0);
      
      console.log(`Network delay test: ${executionTime.toFixed(2)}ms with simulated delays`);
    });

    it('should handle partial service failures gracefully', async () => {
      const tasks = generateTasks(15, 'partial-failure');
      
      // Simulate partial failure in time slot generation
      timeSlotService.generateTaskSlots.mockImplementation(async () => {
        if (Math.random() < 0.3) { // 30% failure rate
          throw new Error('Simulated service failure');
        }
        return generateTimeSlots(20);
      });
      
      let successCount = 0;
      let failureCount = 0;
      
      // Run multiple attempts
      for (let i = 0; i < 10; i++) {
        try {
          const result = await solver.solve(tasks, mockUser, createEmptyConstraints(), []);
          if (result.success) {
            successCount++;
          }
        } catch (error) {
          failureCount++;
        }
      }
      
      // Should handle failures gracefully
      expect(successCount + failureCount).toBe(10);
      expect(successCount).toBeGreaterThan(0); // Some should succeed
      
      console.log(`Partial failure test: ${successCount} successes, ${failureCount} failures`);
    });
  });

  // Helper functions
  function generateTasks(count: number, prefix: string, overrides: Partial<Task> = {}): Task[] {
    return Array.from({ length: count }, (_, i) => 
      createTask({
        id: `${prefix}-task-${i}`,
        title: `${prefix} Task ${i}`,
        duration: 30 + (i % 90),
        priority: ['low', 'medium', 'high', 'critical'][i % 4] as any,
        ...overrides
      })
    );
  }

  function generateTasksForUser(userId: string, count: number): Task[] {
    return Array.from({ length: count }, (_, i) => 
      createTask({
        id: `${userId}-task-${i}`,
        userId,
        title: `User ${userId} Task ${i}`,
        duration: 30 + (i % 60),
        priority: ['low', 'medium', 'high', 'critical'][i % 4] as any
      })
    );
  }

  function generateComplexStressTestTasks(count: number, dependencyDensity: number, deadlineRatio: number): Task[] {
    const tasks = generateTasks(count, 'stress');
    
    // Add dependencies
    const dependencyCount = Math.floor(count * dependencyDensity);
    for (let i = 0; i < dependencyCount; i++) {
      const taskIndex = Math.floor(Math.random() * count);
      const depIndex = Math.floor(Math.random() * taskIndex); // Depend on earlier task
      
      if (depIndex < taskIndex) {
        tasks[taskIndex].dependencies.push(tasks[depIndex].id);
      }
    }
    
    // Add deadlines
    const deadlineCount = Math.floor(count * deadlineRatio);
    for (let i = 0; i < deadlineCount; i++) {
      const taskIndex = Math.floor(Math.random() * count);
      const hoursFromNow = 1 + Math.random() * 48; // 1-48 hours
      
      tasks[taskIndex].deadline = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
      tasks[taskIndex].isHardDeadline = Math.random() < 0.5;
    }
    
    return tasks;
  }

  function generateCPUIntensiveTasks(count: number): Task[] {
    return Array.from({ length: count }, (_, i) => {
      const dependencies = Array.from({ length: Math.floor(Math.random() * 5) }, (_, j) => 
        `cpu-task-${Math.max(0, i - j - 1)}`
      ).filter(dep => dep !== `cpu-task-${i}`);
      
      return createTask({
        id: `cpu-task-${i}`,
        title: `CPU Intensive Task ${i}`,
        duration: 60 + Math.random() * 120,
        priority: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as any,
        dependencies,
        deadline: Math.random() < 0.3 ? new Date(Date.now() + (2 + Math.random() * 10) * 60 * 60 * 1000) : undefined,
        isHardDeadline: Math.random() < 0.5,
        isBlocking: Math.random() < 0.2
      });
    });
  }

  function generateTimeSlots(count: number): AvailableSlot[] {
    const baseDate = new Date('2024-01-15T09:00:00Z');
    
    return Array.from({ length: count }, (_, i) => {
      const startTime = new Date(baseDate.getTime() + i * 30 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
      
      return {
        startTime,
        endTime,
        duration: 30
      };
    });
  }

  function createTask(overrides: Partial<Task> = {}): Task {
    return {
      id: `load-task-${Math.random().toString(36).substr(2, 9)}`,
      userId: 'load-test-user',
      title: 'Load Test Task',
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
      userId: 'load-test-user',
      constraints: [],
      collectedAt: new Date(),
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }
});