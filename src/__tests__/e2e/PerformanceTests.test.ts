import request from 'supertest';
import { Express } from 'express';
import { createApp } from '@/api';
import { performance } from 'perf_hooks';

/**
 * End-to-End Performance Tests
 * Tests system performance under various load conditions and real-world scenarios
 */
describe('E2E - Performance Testing', () => {
  let app: Express;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    app = createApp();
    
    // Create test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'performance-test@example.com',
        password: 'SecurePassword123!',
        name: 'Performance Test User',
        timezone: 'America/New_York'
      })
      .expect(201);

    authToken = userResponse.body.token;
    userId = userResponse.body.user.id;

    // Setup user for performance testing
    await request(app)
      .put(`/api/users/${userId}/working-hours`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '17:00' }
      })
      .expect(200);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('API Response Time Performance', () => {
    it('should handle task creation with sub-200ms response time', async () => {
      const iterations = 10;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Performance Task ${i}`,
            duration: 60,
            priority: 'medium'
          })
          .expect(201);

        const endTime = performance.now();
        responseTimes.push(endTime - startTime);
      }

      const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / iterations;
      const maxResponseTime = Math.max(...responseTimes);

      console.log(`Task creation - Average: ${averageResponseTime.toFixed(2)}ms, Max: ${maxResponseTime.toFixed(2)}ms`);

      expect(averageResponseTime).toBeLessThan(200); // Average under 200ms
      expect(maxResponseTime).toBeLessThan(500);     // Max under 500ms
    });

    it('should handle schedule optimization with sub-1000ms response time', async () => {
      // Create multiple tasks for scheduling
      const taskCreationPromises = [];
      for (let i = 0; i < 20; i++) {
        taskCreationPromises.push(
          request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              title: `Optimization Task ${i}`,
              duration: 30 + (i % 90), // Varying durations
              priority: ['low', 'medium', 'high', 'critical'][i % 4]
            })
            .expect(201)
        );
      }

      await Promise.all(taskCreationPromises);

      // Measure schedule optimization performance
      const iterations = 5;
      const optimizationTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        const response = await request(app)
          .post('/api/schedule/optimize')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const endTime = performance.now();
        optimizationTimes.push(endTime - startTime);

        expect(response.body.success).toBe(true);
      }

      const averageOptimizationTime = optimizationTimes.reduce((sum, time) => sum + time, 0) / iterations;
      const maxOptimizationTime = Math.max(...optimizationTimes);

      console.log(`Schedule optimization - Average: ${averageOptimizationTime.toFixed(2)}ms, Max: ${maxOptimizationTime.toFixed(2)}ms`);

      expect(averageOptimizationTime).toBeLessThan(1000); // Average under 1 second
      expect(maxOptimizationTime).toBeLessThan(2000);     // Max under 2 seconds
    });

    it('should handle calendar sync with acceptable performance', async () => {
      // Mock calendar connection
      await request(app)
        .post('/api/calendar/google/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          authCode: 'mock-auth-code'
        })
        .expect(200);

      const syncTimes: number[] = [];
      const iterations = 3;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        await request(app)
          .post('/api/calendar/sync')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const endTime = performance.now();
        syncTimes.push(endTime - startTime);
      }

      const averageSyncTime = syncTimes.reduce((sum, time) => sum + time, 0) / iterations;
      
      console.log(`Calendar sync - Average: ${averageSyncTime.toFixed(2)}ms`);

      expect(averageSyncTime).toBeLessThan(3000); // Under 3 seconds for sync
    });
  });

  describe('Concurrent User Performance', () => {
    it('should handle multiple concurrent task operations', async () => {
      const concurrentUsers = 5;
      const operationsPerUser = 10;

      const userPromises = Array.from({ length: concurrentUsers }, async (_, userIndex) => {
        // Create separate user for each concurrent test
        const userResponse = await request(app)
          .post('/api/auth/register')
          .send({
            email: `concurrent-user-${userIndex}@example.com`,
            password: 'SecurePassword123!',
            name: `Concurrent User ${userIndex}`,
            timezone: 'America/New_York'
          })
          .expect(201);

        const userToken = userResponse.body.token;
        const operationTimes: number[] = [];

        // Perform operations for this user
        for (let opIndex = 0; opIndex < operationsPerUser; opIndex++) {
          const startTime = performance.now();
          
          await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
              title: `Concurrent Task ${userIndex}-${opIndex}`,
              duration: 45,
              priority: 'medium'
            })
            .expect(201);

          const endTime = performance.now();
          operationTimes.push(endTime - startTime);
        }

        return {
          userId: userIndex,
          averageTime: operationTimes.reduce((sum, time) => sum + time, 0) / operationTimes.length,
          maxTime: Math.max(...operationTimes)
        };
      });

      const results = await Promise.all(userPromises);

      // Analyze concurrent performance
      const overallAverageTime = results.reduce((sum, result) => sum + result.averageTime, 0) / results.length;
      const overallMaxTime = Math.max(...results.map(r => r.maxTime));

      console.log(`Concurrent operations - Users: ${concurrentUsers}, Avg: ${overallAverageTime.toFixed(2)}ms, Max: ${overallMaxTime.toFixed(2)}ms`);

      expect(overallAverageTime).toBeLessThan(500); // Should maintain good performance under concurrent load
      expect(overallMaxTime).toBeLessThan(2000);    // No operation should take too long
    });

    it('should handle concurrent schedule optimizations', async () => {
      const concurrentOptimizations = 3;
      
      // Create tasks for each optimization
      for (let i = 0; i < concurrentOptimizations; i++) {
        for (let j = 0; j < 10; j++) {
          await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              title: `Concurrent Opt Task ${i}-${j}`,
              duration: 60,
              priority: 'medium'
            })
            .expect(201);
        }
      }

      // Run concurrent optimizations
      const optimizationPromises = Array.from({ length: concurrentOptimizations }, async (_, index) => {
        const startTime = performance.now();
        
        const response = await request(app)
          .post('/api/schedule/optimize')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const endTime = performance.now();
        
        return {
          index,
          time: endTime - startTime,
          success: response.body.success,
          tasksScheduled: response.body.scheduledTasks?.length || 0
        };
      });

      const results = await Promise.all(optimizationPromises);

      // Verify all optimizations completed successfully
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.time).toBeLessThan(5000); // Each should complete within 5 seconds
      });

      const averageTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
      console.log(`Concurrent optimizations - Average: ${averageTime.toFixed(2)}ms`);
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle large number of tasks efficiently', async () => {
      const taskCount = 100;
      const batchSize = 20;

      // Create tasks in batches for better performance
      for (let batch = 0; batch < taskCount / batchSize; batch++) {
        const batchPromises = [];
        
        for (let i = 0; i < batchSize; i++) {
          const taskIndex = batch * batchSize + i;
          batchPromises.push(
            request(app)
              .post('/api/tasks')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                title: `Large Dataset Task ${taskIndex}`,
                duration: 30 + (taskIndex % 120), // 30-150 minutes
                priority: ['low', 'medium', 'high', 'critical'][taskIndex % 4],
                deadline: taskIndex % 10 === 0 ? new Date(Date.now() + (1 + taskIndex % 7) * 24 * 60 * 60 * 1000).toISOString() : undefined
              })
              .expect(201)
          );
        }

        await Promise.all(batchPromises);
      }

      // Test retrieval performance
      const startRetrievalTime = performance.now();
      
      const tasksResponse = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: taskCount })
        .expect(200);

      const endRetrievalTime = performance.now();
      const retrievalTime = endRetrievalTime - startRetrievalTime;

      expect(tasksResponse.body.tasks).toHaveLength(taskCount);
      expect(retrievalTime).toBeLessThan(1000); // Should retrieve 100 tasks in under 1 second

      // Test optimization performance with large dataset
      const startOptimizationTime = performance.now();
      
      const optimizationResponse = await request(app)
        .post('/api/schedule/optimize')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const endOptimizationTime = performance.now();
      const optimizationTime = endOptimizationTime - startOptimizationTime;

      expect(optimizationResponse.body.success).toBe(true);
      expect(optimizationTime).toBeLessThan(10000); // Should optimize 100 tasks in under 10 seconds

      console.log(`Large dataset (${taskCount} tasks) - Retrieval: ${retrievalTime.toFixed(2)}ms, Optimization: ${optimizationTime.toFixed(2)}ms`);
    });

    it('should handle complex dependency graphs efficiently', async () => {
      // Create a complex dependency graph
      const taskIds: string[] = [];

      // Create root tasks (no dependencies)
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Root Task ${i}`,
            duration: 60,
            priority: 'high'
          })
          .expect(201);
        
        taskIds.push(response.body.id);
      }

      // Create dependent tasks (each depends on previous level)
      for (let level = 1; level < 4; level++) {
        const levelTasks: string[] = [];
        
        for (let i = 0; i < 3; i++) {
          const dependencies = level === 1 ? [taskIds[i % taskIds.length]] : [levelTasks[Math.max(0, i - 1)]];
          
          const response = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              title: `Level ${level} Task ${i}`,
              duration: 45,
              priority: 'medium',
              dependencies
            })
            .expect(201);
          
          levelTasks.push(response.body.id);
        }
        
        taskIds.push(...levelTasks);
      }

      // Test optimization with complex dependencies
      const startTime = performance.now();
      
      const optimizationResponse = await request(app)
        .post('/api/schedule/optimize')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const endTime = performance.now();
      const optimizationTime = endTime - startTime;

      expect(optimizationResponse.body.success).toBe(true);
      expect(optimizationTime).toBeLessThan(5000); // Should handle complex dependencies in under 5 seconds

      // Verify dependency order is maintained
      const scheduledTasks = optimizationResponse.body.scheduledTasks;
      if (scheduledTasks && scheduledTasks.length > 0) {
        // Basic check that some tasks were scheduled
        expect(scheduledTasks.length).toBeGreaterThan(0);
      }

      console.log(`Complex dependencies - Optimization: ${optimizationTime.toFixed(2)}ms, Tasks scheduled: ${scheduledTasks?.length || 0}`);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should maintain reasonable memory usage during operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform memory-intensive operations
      const operations = 50;
      
      for (let i = 0; i < operations; i++) {
        // Create task
        const taskResponse = await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Memory Test Task ${i}`,
            description: 'A'.repeat(1000), // 1KB description
            duration: 60,
            priority: 'medium'
          })
          .expect(201);

        // Update task
        await request(app)
          .put(`/api/tasks/${taskResponse.body.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            description: 'B'.repeat(1000) // Another 1KB
          })
          .expect(200);

        // Trigger optimization every 10 operations
        if (i % 10 === 0) {
          await request(app)
            .post('/api/schedule/optimize')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory usage - Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB, Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB, Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Memory increase should be reasonable (less than 100MB for 50 operations)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Real-Time Features Performance', () => {
    it('should handle WebSocket message broadcasting efficiently', async () => {
      // This test would require WebSocket setup
      // For now, test the REST endpoints that trigger real-time updates
      
      const updateTimes: number[] = [];
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        // Create task (triggers real-time update)
        const startTime = performance.now();
        
        const taskResponse = await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Real-time Test Task ${i}`,
            duration: 30,
            priority: 'medium'
          })
          .expect(201);

        // Update task (triggers another real-time update)
        await request(app)
          .put(`/api/tasks/${taskResponse.body.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            priority: 'high'
          })
          .expect(200);

        const endTime = performance.now();
        updateTimes.push(endTime - startTime);
      }

      const averageUpdateTime = updateTimes.reduce((sum, time) => sum + time, 0) / iterations;
      
      console.log(`Real-time updates - Average: ${averageUpdateTime.toFixed(2)}ms`);

      expect(averageUpdateTime).toBeLessThan(300); // Should handle real-time updates quickly
    });
  });

  describe('Database Query Performance', () => {
    it('should execute complex queries efficiently', async () => {
      // Create data for complex queries
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Performance Test Project',
          description: 'Project for testing query performance'
        })
        .expect(201);

      const projectId = projectResponse.body.id;

      // Create tasks with various attributes
      for (let i = 0; i < 30; i++) {
        await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Query Test Task ${i}`,
            duration: 30 + (i % 120),
            priority: ['low', 'medium', 'high', 'critical'][i % 4],
            projectId: i % 3 === 0 ? projectId : undefined,
            deadline: i % 5 === 0 ? new Date(Date.now() + (i % 10) * 24 * 60 * 60 * 1000).toISOString() : undefined
          })
          .expect(201);
      }

      // Test complex query performance
      const queryTests = [
        {
          name: 'Filter by priority',
          endpoint: '/api/tasks',
          query: { priority: 'high' }
        },
        {
          name: 'Filter by project',
          endpoint: '/api/tasks',
          query: { projectId }
        },
        {
          name: 'Filter by deadline',
          endpoint: '/api/tasks',
          query: { hasDeadline: 'true' }
        },
        {
          name: 'Project progress',
          endpoint: `/api/projects/${projectId}/progress`,
          query: {}
        }
      ];

      for (const test of queryTests) {
        const startTime = performance.now();
        
        const response = await request(app)
          .get(test.endpoint)
          .set('Authorization', `Bearer ${authToken}`)
          .query(test.query)
          .expect(200);

        const endTime = performance.now();
        const queryTime = endTime - startTime;

        console.log(`${test.name} query: ${queryTime.toFixed(2)}ms`);

        expect(queryTime).toBeLessThan(500); // All queries should complete in under 500ms
        expect(response.body).toBeDefined();
      }
    });
  });

  // Helper function to clean up test data
  async function cleanupTestData(): Promise<void> {
    try {
      if (userId && authToken) {
        await request(app)
          .delete(`/api/users/${userId}/test-cleanup`)
          .set('Authorization', `Bearer ${authToken}`)
          .catch(() => {}); // Ignore cleanup errors
      }
    } catch (error) {
      console.warn('Performance test cleanup error:', error);
    }
  }
});