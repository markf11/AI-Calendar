// @ts-nocheck
import request from 'supertest';
import { Express } from 'express';
import WebSocket from 'ws';
import { createApp } from '@/api';
import { WebSocketService } from '@/services/WebSocketService';
import { CrossPlatformSyncService } from '@/services/CrossPlatformSyncService';

/**
 * End-to-End Cross-Platform Synchronization Tests
 * Tests real-time synchronization across web, desktop, and mobile platforms
 */
describe('E2E - Cross-Platform Synchronization', () => {
  let app: Express;
  let authToken: string;
  let userId: string;
  let wsServer: any;
  let webClient: WebSocket;
  let desktopClient: WebSocket;
  let mobileClient: WebSocket;

  beforeAll(async () => {
    app = createApp();
    
    // Setup WebSocket server for testing
    wsServer = new WebSocket.Server({ port: 8081 });
    
    // Create test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'sync-test@example.com',
        password: 'SecurePassword123!',
        name: 'Sync Test User',
        timezone: 'America/New_York'
      })
      .expect(201);

    authToken = userResponse.body.token;
    userId = userResponse.body.user.id;

    // Setup user preferences for testing
    await request(app)
      .put(`/api/users/${userId}/preferences`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        maxContinuousWorkTime: 120,
        groupSimilarTasks: true,
        autoRescheduleEnabled: true
      })
      .expect(200);
  });

  afterAll(async () => {
    // Close WebSocket connections
    if (webClient) webClient.close();
    if (desktopClient) desktopClient.close();
    if (mobileClient) mobileClient.close();
    if (wsServer) wsServer.close();
    
    await cleanupTestData();
  });

  describe('Multi-Platform Connection Management', () => {
    it('should establish WebSocket connections for multiple platforms', async () => {
      // Simulate web client connection
      webClient = new WebSocket(`ws://localhost:8081?token=${authToken}&platform=web`);
      await waitForConnection(webClient);

      // Simulate desktop client connection
      desktopClient = new WebSocket(`ws://localhost:8081?token=${authToken}&platform=desktop`);
      await waitForConnection(desktopClient);

      // Simulate mobile client connection
      mobileClient = new WebSocket(`ws://localhost:8081?token=${authToken}&platform=mobile`);
      await waitForConnection(mobileClient);

      // Verify all connections are established
      expect(webClient.readyState).toBe(WebSocket.OPEN);
      expect(desktopClient.readyState).toBe(WebSocket.OPEN);
      expect(mobileClient.readyState).toBe(WebSocket.OPEN);

      // Test connection info endpoint
      const connectionsResponse = await request(app)
        .get('/api/sync/connections')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(connectionsResponse.body.activeConnections).toBe(3);
      expect(connectionsResponse.body.platforms).toContain('web');
      expect(connectionsResponse.body.platforms).toContain('desktop');
      expect(connectionsResponse.body.platforms).toContain('mobile');
    });
  });

  describe('Real-Time Task Synchronization', () => {
    it('should sync task creation across all platforms', async () => {
      const taskCreatedMessages: any[] = [];
      
      // Setup message listeners
      webClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'task_created') {
          taskCreatedMessages.push({ platform: 'web', message });
        }
      });

      desktopClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'task_created') {
          taskCreatedMessages.push({ platform: 'desktop', message });
        }
      });

      mobileClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'task_created') {
          taskCreatedMessages.push({ platform: 'mobile', message });
        }
      });

      // Create task via REST API (simulating web client action)
      const taskResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Cross-Platform Sync Test Task',
          description: 'Testing real-time synchronization',
          duration: 60,
          priority: 'medium'
        })
        .expect(201);

      const taskId = taskResponse.body.id;

      // Wait for WebSocket messages to be received
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify all platforms received the task creation notification
      expect(taskCreatedMessages).toHaveLength(3);
      expect(taskCreatedMessages.some(m => m.platform === 'web')).toBe(true);
      expect(taskCreatedMessages.some(m => m.platform === 'desktop')).toBe(true);
      expect(taskCreatedMessages.some(m => m.platform === 'mobile')).toBe(true);

      // Verify task data in messages
      taskCreatedMessages.forEach(({ message }) => {
        expect(message.data.task.id).toBe(taskId);
        expect(message.data.task.title).toBe('Cross-Platform Sync Test Task');
      });
    });

    it('should sync task updates across platforms', async () => {
      // Create initial task
      const taskResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Update Sync Test',
          duration: 90,
          priority: 'low'
        })
        .expect(201);

      const taskId = taskResponse.body.id;

      const taskUpdatedMessages: any[] = [];

      // Setup update listeners
      [webClient, desktopClient, mobileClient].forEach((client, index) => {
        const platforms = ['web', 'desktop', 'mobile'];
        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'task_updated' && message.data.task.id === taskId) {
            taskUpdatedMessages.push({ platform: platforms[index], message });
          }
        });
      });

      // Update task priority
      await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          priority: 'critical',
          deadline: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
        })
        .expect(200);

      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify all platforms received update
      expect(taskUpdatedMessages).toHaveLength(3);
      taskUpdatedMessages.forEach(({ message }) => {
        expect(message.data.task.priority).toBe('critical');
        expect(message.data.task.deadline).toBeDefined();
      });
    });

    it('should sync task completion across platforms', async () => {
      // Create task
      const taskResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Completion Sync Test',
          duration: 45,
          priority: 'medium'
        })
        .expect(201);

      const taskId = taskResponse.body.id;

      const completionMessages: any[] = [];

      // Setup completion listeners
      [webClient, desktopClient, mobileClient].forEach((client, index) => {
        const platforms = ['web', 'desktop', 'mobile'];
        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'task_completed' && message.data.task.id === taskId) {
            completionMessages.push({ platform: platforms[index], message });
          }
        });
      });

      // Complete task
      await request(app)
        .post(`/api/tasks/${taskId}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          completionNotes: 'Task completed via API'
        })
        .expect(200);

      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify completion sync
      expect(completionMessages).toHaveLength(3);
      completionMessages.forEach(({ message }) => {
        expect(message.data.task.status).toBe('completed');
        expect(message.data.task.completedAt).toBeDefined();
      });
    });
  });

  describe('Schedule Synchronization', () => {
    it('should sync schedule changes across platforms', async () => {
      // Create multiple tasks for scheduling
      const task1Response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Schedule Sync Task 1',
          duration: 60,
          priority: 'high'
        })
        .expect(201);

      const task2Response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Schedule Sync Task 2',
          duration: 90,
          priority: 'medium'
        })
        .expect(201);

      const scheduleUpdatedMessages: any[] = [];

      // Setup schedule update listeners
      [webClient, desktopClient, mobileClient].forEach((client, index) => {
        const platforms = ['web', 'desktop', 'mobile'];
        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'schedule_updated') {
            scheduleUpdatedMessages.push({ platform: platforms[index], message });
          }
        });
      });

      // Trigger schedule optimization
      await request(app)
        .post('/api/schedule/optimize')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify schedule updates were broadcast
      expect(scheduleUpdatedMessages.length).toBeGreaterThanOrEqual(3);
      
      // Check that each platform received schedule data
      const platformsReceived = new Set(scheduleUpdatedMessages.map(m => m.platform));
      expect(platformsReceived.has('web')).toBe(true);
      expect(platformsReceived.has('desktop')).toBe(true);
      expect(platformsReceived.has('mobile')).toBe(true);
    });

    it('should handle schedule conflicts and sync resolution', async () => {
      // Create conflicting calendar event
      await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Urgent Meeting',
          startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          isFlexible: false
        })
        .expect(201);

      const conflictMessages: any[] = [];

      // Setup conflict listeners
      [webClient, desktopClient, mobileClient].forEach((client, index) => {
        const platforms = ['web', 'desktop', 'mobile'];
        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'schedule_conflict' || message.type === 'schedule_updated') {
            conflictMessages.push({ platform: platforms[index], message });
          }
        });
      });

      // This should trigger automatic rescheduling
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify conflict resolution was communicated
      expect(conflictMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Offline Synchronization', () => {
    it('should handle offline/online transitions', async () => {
      // Simulate mobile client going offline
      mobileClient.close();

      // Make changes while mobile is offline
      const offlineTaskResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Offline Sync Test Task',
          duration: 75,
          priority: 'high'
        })
        .expect(201);

      const offlineTaskId = offlineTaskResponse.body.id;

      // Update the task
      await request(app)
        .put(`/api/tasks/${offlineTaskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          priority: 'critical',
          description: 'Updated while mobile offline'
        })
        .expect(200);

      // Simulate mobile client coming back online
      mobileClient = new WebSocket(`ws://localhost:8081?token=${authToken}&platform=mobile`);
      await waitForConnection(mobileClient);

      const syncMessages: any[] = [];

      mobileClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'sync_update') {
          syncMessages.push(message);
        }
      });

      // Request sync for mobile client
      await request(app)
        .post('/api/sync/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'mobile',
          lastSyncTimestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago
        })
        .expect(200);

      // Wait for sync completion
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify mobile client received updates
      expect(syncMessages.length).toBeGreaterThan(0);
    });

    it('should handle sync conflicts from offline changes', async () => {
      // Create a task
      const taskResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Conflict Test Task',
          duration: 60,
          priority: 'medium'
        })
        .expect(201);

      const taskId = taskResponse.body.id;

      // Simulate conflicting changes from different platforms
      // (In a real scenario, this would involve offline storage and conflict resolution)
      
      // Update from web platform
      await request(app)
        .put(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated from Web',
          priority: 'high'
        })
        .expect(200);

      // Simulate conflicting update from mobile (would normally be queued offline)
      const conflictResponse = await request(app)
        .post('/api/sync/resolve-conflict')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          taskId,
          conflictingChanges: {
            title: 'Updated from Mobile',
            priority: 'critical'
          },
          resolution: 'merge' // or 'server_wins', 'client_wins'
        })
        .expect(200);

      expect(conflictResponse.body.success).toBe(true);
      expect(conflictResponse.body.resolvedTask).toBeDefined();
    });
  });

  describe('Performance Under Load', () => {
    it('should handle multiple simultaneous connections efficiently', async () => {
      const additionalClients: WebSocket[] = [];
      const connectionPromises: Promise<void>[] = [];

      // Create 10 additional WebSocket connections
      for (let i = 0; i < 10; i++) {
        const client = new WebSocket(`ws://localhost:8081?token=${authToken}&platform=test-${i}`);
        additionalClients.push(client);
        connectionPromises.push(waitForConnection(client));
      }

      // Wait for all connections to establish
      await Promise.all(connectionPromises);

      // Verify all connections are open
      additionalClients.forEach(client => {
        expect(client.readyState).toBe(WebSocket.OPEN);
      });

      // Create a task and verify it's broadcast to all clients
      const broadcastTaskResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Broadcast Test Task',
          duration: 30,
          priority: 'low'
        })
        .expect(201);

      // Wait for broadcast
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Clean up additional connections
      additionalClients.forEach(client => client.close());

      // Verify performance metrics
      const metricsResponse = await request(app)
        .get('/api/sync/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(metricsResponse.body.activeConnections).toBeDefined();
      expect(metricsResponse.body.messagesSent).toBeGreaterThan(0);
    });

    it('should handle high-frequency updates efficiently', async () => {
      const updateMessages: any[] = [];

      webClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'task_updated') {
          updateMessages.push(message);
        }
      });

      // Create a task for rapid updates
      const rapidTaskResponse = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Rapid Update Test',
          duration: 60,
          priority: 'low'
        })
        .expect(201);

      const rapidTaskId = rapidTaskResponse.body.id;

      // Perform rapid updates
      const updatePromises = [];
      for (let i = 0; i < 5; i++) {
        updatePromises.push(
          request(app)
            .put(`/api/tasks/${rapidTaskId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              description: `Rapid update ${i}`,
              priority: i % 2 === 0 ? 'medium' : 'high'
            })
            .expect(200)
        );
      }

      await Promise.all(updatePromises);

      // Wait for all updates to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify updates were handled efficiently
      expect(updateMessages.length).toBeGreaterThan(0);
      expect(updateMessages.length).toBeLessThanOrEqual(5); // Should not exceed actual updates
    });
  });

  // Helper functions
  function waitForConnection(ws: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async function cleanupTestData(): Promise<void> {
    try {
      if (userId && authToken) {
        await request(app)
          .delete(`/api/users/${userId}/test-cleanup`)
          .set('Authorization', `Bearer ${authToken}`)
          .catch(() => {}); // Ignore cleanup errors
      }
    } catch (error) {
      console.warn('Cross-platform sync test cleanup error:', error);
    }
  }
});