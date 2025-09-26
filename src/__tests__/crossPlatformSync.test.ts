import { CrossPlatformSyncService, SyncData, SyncConflict } from '@/services/CrossPlatformSyncService';
import { SyncMiddleware } from '@/services/SyncMiddleware';
import { RedisClient } from '@/config/redis';

// Mock dependencies
jest.mock('@/config/redis', () => ({
  RedisClient: {
    getInstance: jest.fn(() => ({
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    }))
  },
  CacheKeys: {
    userSchedule: jest.fn((userId: string, type: string) => `schedule:${userId}:${type}`)
  }
}));

jest.mock('@/config/database', () => ({
  Database: {
    getInstance: jest.fn(() => ({
      query: jest.fn()
    }))
  }
}));

jest.mock('@/services/WebSocketManager', () => ({
  getWebSocketManager: jest.fn(() => ({
    broadcastScheduleUpdate: jest.fn(),
    isUserConnected: jest.fn(() => true)
  }))
}));

describe('CrossPlatformSyncService', () => {
  let syncService: CrossPlatformSyncService;
  let mockRedis: jest.Mocked<any>;
  let testUserId: string;

  beforeEach(() => {
    syncService = new CrossPlatformSyncService();
    mockRedis = RedisClient.getInstance() as jest.Mocked<any>;
    testUserId = 'test-user-123';
    
    jest.clearAllMocks();
  });

  describe('syncDataChange', () => {
    it('should sync data change successfully', async () => {
      const syncData: SyncData = {
        id: 'sync-123',
        userId: testUserId,
        entityType: 'task',
        entityId: 'task-456',
        action: 'CREATE',
        data: { title: 'Test Task', duration: 60 },
        timestamp: new Date(),
        clientId: 'web-client',
        version: 1
      };

      await syncService.syncDataChange(syncData);

      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockRedis.get).toHaveBeenCalled(); // For offline cache update
    });

    it('should handle sync errors gracefully', async () => {
      const syncData: SyncData = {
        id: 'sync-123',
        userId: testUserId,
        entityType: 'task',
        entityId: 'task-456',
        action: 'CREATE',
        data: { title: 'Test Task' },
        timestamp: new Date(),
        clientId: 'web-client',
        version: 1
      };

      mockRedis.set.mockRejectedValue(new Error('Redis error'));

      await expect(syncService.syncDataChange(syncData)).rejects.toThrow('Redis error');
    });
  });

  describe('syncOfflineChanges', () => {
    it('should sync offline changes without conflicts', async () => {
      const offlineChanges: SyncData[] = [
        {
          id: 'offline-1',
          userId: testUserId,
          entityType: 'task',
          entityId: 'task-1',
          action: 'UPDATE',
          data: { title: 'Updated Task' },
          timestamp: new Date(),
          clientId: 'mobile-client',
          version: 2
        }
      ];

      mockRedis.get.mockResolvedValue(null); // No last sync time
      
      const result = await syncService.syncOfflineChanges(testUserId, 'mobile-client', offlineChanges);

      expect(result.success).toBe(true);
      expect(result.syncedItems).toBe(1);
      expect(result.conflicts).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect and report conflicts', async () => {
      const offlineChanges: SyncData[] = [
        {
          id: 'offline-1',
          userId: testUserId,
          entityType: 'task',
          entityId: 'task-1',
          action: 'UPDATE',
          data: { title: 'Offline Update' },
          timestamp: new Date('2023-01-01'),
          clientId: 'mobile-client',
          version: 1
        }
      ];

      // Mock server changes that conflict
      const getServerChangesSince = jest.spyOn(syncService as any, 'getServerChangesSince');
      getServerChangesSince.mockResolvedValue([
        {
          id: 'server-1',
          userId: testUserId,
          entityType: 'task',
          entityId: 'task-1',
          action: 'UPDATE',
          data: { title: 'Server Update' },
          timestamp: new Date('2023-01-02'),
          clientId: 'web-client',
          version: 2
        }
      ]);

      const result = await syncService.syncOfflineChanges(testUserId, 'mobile-client', offlineChanges);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].conflictType).toBe('CONCURRENT_EDIT');
    });
  });

  describe('getOfflineCache', () => {
    it('should return cached data for user', async () => {
      const cachedData = [
        {
          id: 'task_task-1',
          userId: testUserId,
          entityType: 'task',
          entityId: 'task-1',
          data: { title: 'Cached Task' },
          lastModified: new Date(),
          version: 1,
          isDeleted: false
        }
      ];

      mockRedis.get.mockResolvedValue(cachedData);

      const result = await syncService.getOfflineCache(testUserId);

      expect(result).toEqual(cachedData);
      expect(mockRedis.get).toHaveBeenCalledWith('schedule:test-user-123:offline');
    });

    it('should filter by entity types', async () => {
      const cachedData = [
        {
          id: 'task_task-1',
          userId: testUserId,
          entityType: 'task',
          entityId: 'task-1',
          data: { title: 'Task' },
          lastModified: new Date(),
          version: 1,
          isDeleted: false
        },
        {
          id: 'project_project-1',
          userId: testUserId,
          entityType: 'project',
          entityId: 'project-1',
          data: { name: 'Project' },
          lastModified: new Date(),
          version: 1,
          isDeleted: false
        }
      ];

      mockRedis.get.mockResolvedValue(cachedData);

      const result = await syncService.getOfflineCache(testUserId, ['task']);

      expect(result).toHaveLength(1);
      expect(result[0].entityType).toBe('task');
    });

    it('should return empty array when no cache exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await syncService.getOfflineCache(testUserId);

      expect(result).toEqual([]);
    });
  });

  describe('resolveConflict', () => {
    const mockConflict: SyncConflict = {
      id: 'conflict-1',
      entityType: 'task',
      entityId: 'task-1',
      localVersion: 1,
      remoteVersion: 2,
      localData: { title: 'Local Title', priority: 'high' },
      remoteData: { title: 'Remote Title', description: 'Remote Description' },
      conflictType: 'CONCURRENT_EDIT',
      timestamp: new Date()
    };

    it('should resolve conflict using local data', async () => {
      const result = await syncService.resolveConflict(mockConflict, 'USE_LOCAL');

      expect(result).toBeDefined();
      expect(result?.data).toEqual(mockConflict.localData);
      expect(result?.version).toBe(3); // Max version + 1
    });

    it('should resolve conflict using remote data', async () => {
      const result = await syncService.resolveConflict(mockConflict, 'USE_REMOTE');

      expect(result).toBeDefined();
      expect(result?.data).toEqual(mockConflict.remoteData);
    });

    it('should merge conflict data', async () => {
      const result = await syncService.resolveConflict(mockConflict, 'MERGE');

      expect(result).toBeDefined();
      expect(result?.data).toEqual({
        title: 'Remote Title', // From remote
        priority: 'high', // From local
        description: 'Remote Description' // From remote
      });
    });

    it('should return null for manual resolution', async () => {
      const result = await syncService.resolveConflict(mockConflict, 'MANUAL');

      expect(result).toBeNull();
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync status for user', async () => {
      mockRedis.get.mockResolvedValueOnce('2023-01-01T00:00:00.000Z'); // Last sync time
      
      const status = await syncService.getSyncStatus(testUserId);

      expect(status.lastSyncTimestamp).toEqual(new Date('2023-01-01T00:00:00.000Z'));
      expect(status.isOnline).toBe(true);
      expect(typeof status.pendingChanges).toBe('number');
      expect(typeof status.conflicts).toBe('number');
    });
  });

  describe('forceFullSync', () => {
    it('should perform full sync successfully', async () => {
      const result = await syncService.forceFullSync(testUserId);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });
});

describe('SyncMiddleware', () => {
  let syncMiddleware: SyncMiddleware;
  let mockSyncService: jest.Mocked<any>;

  beforeEach(() => {
    syncMiddleware = new SyncMiddleware();
    mockSyncService = {
      syncDataChange: jest.fn()
    };
    (syncMiddleware as any).syncService = mockSyncService;
  });

  describe('withSync', () => {
    it('should wrap method and trigger sync', async () => {
      const originalMethod = jest.fn().mockResolvedValue({ id: 'task-123', title: 'Test Task' });
      const wrappedMethod = syncMiddleware.withSync('user-123', 'task', 'CREATE')(originalMethod);

      const result = await wrappedMethod('arg1', 'arg2');

      expect(originalMethod).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result).toEqual({ id: 'task-123', title: 'Test Task' });
      expect(mockSyncService.syncDataChange).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          entityType: 'task',
          entityId: 'task-123',
          action: 'CREATE'
        })
      );
    });

    it('should handle sync errors without affecting original method', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const originalMethod = jest.fn().mockResolvedValue({ id: 'task-123' });
      mockSyncService.syncDataChange.mockRejectedValue(new Error('Sync failed'));

      const wrappedMethod = syncMiddleware.withSync('user-123', 'task', 'CREATE')(originalMethod);

      const result = await wrappedMethod();

      expect(result).toEqual({ id: 'task-123' });
      // Give sync a moment to fail
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(consoleSpy).toHaveBeenCalledWith('Error syncing data change:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('triggerSync', () => {
    it('should trigger manual sync', async () => {
      await syncMiddleware.triggerSync(
        'user-123',
        'task',
        'task-456',
        'UPDATE',
        { title: 'Updated Task' },
        'web-client'
      );

      expect(mockSyncService.syncDataChange).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          entityType: 'task',
          entityId: 'task-456',
          action: 'UPDATE',
          data: { title: 'Updated Task' },
          clientId: 'web-client'
        })
      );
    });
  });

  describe('batchSync', () => {
    it('should sync multiple changes in batch', async () => {
      const changes = [
        {
          userId: 'user-123',
          entityType: 'task' as const,
          entityId: 'task-1',
          action: 'CREATE' as const,
          data: { title: 'Task 1' }
        },
        {
          userId: 'user-123',
          entityType: 'task' as const,
          entityId: 'task-2',
          action: 'UPDATE' as const,
          data: { title: 'Task 2 Updated' }
        }
      ];

      await syncMiddleware.batchSync(changes);

      expect(mockSyncService.syncDataChange).toHaveBeenCalledTimes(2);
    });
  });
});