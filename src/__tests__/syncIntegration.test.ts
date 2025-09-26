import request from 'supertest';
import { createApp } from '@/api';
import { Database } from '@/config/database';
import { RedisClient } from '@/config/redis';
import jwt from 'jsonwebtoken';
import { config } from '@/config/environment';

// Mock external dependencies
jest.mock('@/config/database');
jest.mock('@/config/redis');
jest.mock('@/services/WebSocketManager');

describe('Sync Integration Tests', () => {
  let app: any;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    app = createApp();
    testUserId = 'test-user-sync-integration';
    
    // Create a valid JWT token for testing
    authToken = jwt.sign(
      { userId: testUserId, email: 'test@example.com' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/sync/offline', () => {
    it('should sync offline changes successfully', async () => {
      const offlineChanges = {
        clientId: 'mobile-app-123',
        changes: [
          {
            entityType: 'task',
            entityId: 'task-offline-1',
            action: 'CREATE',
            data: {
              title: 'Offline Created Task',
              duration: 60,
              priority: 'high'
            },
            clientId: 'mobile-app-123',
            version: 1
          },
          {
            entityType: 'task',
            entityId: 'task-offline-2',
            action: 'UPDATE',
            data: {
              title: 'Updated Offline Task',
              completed: true
            },
            clientId: 'mobile-app-123',
            version: 2
          }
        ]
      };

      const response = await request(app)
        .post('/api/sync/offline')
        .set('Authorization', `Bearer ${authToken}`)
        .send(offlineChanges)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        syncedItems: expect.any(Number),
        conflicts: expect.any(Array),
        errors: expect.any(Array),
        lastSyncTimestamp: expect.any(String)
      });
    });

    it('should return 400 for invalid sync data', async () => {
      const invalidData = {
        clientId: 'mobile-app-123',
        changes: [
          {
            // Missing required fields
            entityType: 'task',
            action: 'CREATE'
          }
        ]
      };

      const response = await request(app)
        .post('/api/sync/offline')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_SYNC_DATA');
    });

    it('should return 401 without authentication', async () => {
      const offlineChanges = {
        clientId: 'mobile-app-123',
        changes: []
      };

      await request(app)
        .post('/api/sync/offline')
        .send(offlineChanges)
        .expect(401);
    });
  });

  describe('GET /api/sync/cache', () => {
    it('should return offline cache data', async () => {
      const response = await request(app)
        .get('/api/sync/cache')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        cacheData: expect.any(Array),
        timestamp: expect.any(String)
      });
    });

    it('should filter cache by entity types', async () => {
      const response = await request(app)
        .get('/api/sync/cache?entityTypes=task&entityTypes=project')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.cacheData).toEqual(expect.any(Array));
    });
  });

  describe('GET /api/sync/status', () => {
    it('should return sync status', async () => {
      const response = await request(app)
        .get('/api/sync/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        lastSyncTimestamp: expect.any(String),
        pendingChanges: expect.any(Number),
        conflicts: expect.any(Number),
        isOnline: expect.any(Boolean)
      });
    });
  });

  describe('POST /api/sync/resolve-conflict', () => {
    it('should resolve conflict using local data', async () => {
      const conflictResolution = {
        conflictId: 'conflict-123',
        resolution: 'USE_LOCAL'
      };

      const response = await request(app)
        .post('/api/sync/resolve-conflict')
        .set('Authorization', `Bearer ${authToken}`)
        .send(conflictResolution)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Conflict resolved successfully'
      });
    });

    it('should resolve conflict using remote data', async () => {
      const conflictResolution = {
        conflictId: 'conflict-123',
        resolution: 'USE_REMOTE'
      };

      const response = await request(app)
        .post('/api/sync/resolve-conflict')
        .set('Authorization', `Bearer ${authToken}`)
        .send(conflictResolution)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should resolve conflict using merge strategy', async () => {
      const conflictResolution = {
        conflictId: 'conflict-123',
        resolution: 'MERGE'
      };

      const response = await request(app)
        .post('/api/sync/resolve-conflict')
        .set('Authorization', `Bearer ${authToken}`)
        .send(conflictResolution)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 for invalid resolution data', async () => {
      const invalidResolution = {
        conflictId: 'conflict-123',
        resolution: 'INVALID_STRATEGY'
      };

      const response = await request(app)
        .post('/api/sync/resolve-conflict')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidResolution)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_RESOLUTION_DATA');
    });
  });

  describe('POST /api/sync/force-full', () => {
    it('should force full sync successfully', async () => {
      const response = await request(app)
        .post('/api/sync/force-full')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        syncedItems: expect.any(Number),
        conflicts: expect.any(Array),
        errors: expect.any(Array),
        lastSyncTimestamp: expect.any(String)
      });
    });
  });

  describe('POST /api/sync/trigger', () => {
    it('should trigger manual sync successfully', async () => {
      const syncData = {
        entityType: 'task',
        entityId: 'task-manual-sync',
        action: 'UPDATE',
        data: {
          title: 'Manually Synced Task',
          priority: 'medium'
        },
        clientId: 'web-client',
        version: 3
      };

      const response = await request(app)
        .post('/api/sync/trigger')
        .set('Authorization', `Bearer ${authToken}`)
        .send(syncData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Sync triggered successfully',
        syncId: expect.any(String)
      });
    });

    it('should return 400 for invalid sync trigger data', async () => {
      const invalidData = {
        entityType: 'task',
        // Missing required fields
        action: 'UPDATE'
      };

      const response = await request(app)
        .post('/api/sync/trigger')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_SYNC_DATA');
    });
  });

  describe('Cross-platform sync workflow', () => {
    it('should handle complete offline-to-online sync workflow', async () => {
      // Step 1: Get initial sync status
      const initialStatus = await request(app)
        .get('/api/sync/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Step 2: Sync offline changes
      const offlineChanges = {
        clientId: 'mobile-workflow-test',
        changes: [
          {
            entityType: 'task',
            entityId: 'workflow-task-1',
            action: 'CREATE',
            data: { title: 'Workflow Task 1', duration: 30 },
            clientId: 'mobile-workflow-test',
            version: 1
          }
        ]
      };

      const syncResponse = await request(app)
        .post('/api/sync/offline')
        .set('Authorization', `Bearer ${authToken}`)
        .send(offlineChanges)
        .expect(200);

      expect(syncResponse.body.success).toBe(true);

      // Step 3: Get updated cache
      const cacheResponse = await request(app)
        .get('/api/sync/cache')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(cacheResponse.body.cacheData).toEqual(expect.any(Array));

      // Step 4: Check final sync status
      const finalStatus = await request(app)
        .get('/api/sync/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalStatus.body.lastSyncTimestamp).toBeDefined();
    });

    it('should handle conflict resolution workflow', async () => {
      // Step 1: Create conflicting changes
      const conflictingChanges = {
        clientId: 'conflict-test-client',
        changes: [
          {
            entityType: 'task',
            entityId: 'conflict-task-1',
            action: 'UPDATE',
            data: { title: 'Conflicting Update' },
            clientId: 'conflict-test-client',
            version: 1
          }
        ]
      };

      // Step 2: Sync changes (may create conflicts)
      const syncResponse = await request(app)
        .post('/api/sync/offline')
        .set('Authorization', `Bearer ${authToken}`)
        .send(conflictingChanges)
        .expect(200);

      // Step 3: If conflicts exist, resolve them
      if (syncResponse.body.conflicts.length > 0) {
        const conflictResolution = {
          conflictId: syncResponse.body.conflicts[0].id,
          resolution: 'USE_LOCAL'
        };

        const resolutionResponse = await request(app)
          .post('/api/sync/resolve-conflict')
          .set('Authorization', `Bearer ${authToken}`)
          .send(conflictResolution)
          .expect(200);

        expect(resolutionResponse.body.success).toBe(true);
      }

      // Step 4: Verify final state
      const finalStatus = await request(app)
        .get('/api/sync/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalStatus.body).toBeDefined();
    });
  });
});