import { RedisClient, CacheKeys } from '@/config/redis';
import { getWebSocketManager } from './WebSocketManager';
import { Database } from '@/config/database';

export interface SyncData {
  id: string;
  userId: string;
  entityType: 'task' | 'project' | 'calendar_event' | 'user_preferences';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: Date;
  clientId: string;
  version: number;
}

export interface SyncConflict {
  id: string;
  entityType: string;
  entityId: string;
  localVersion: number;
  remoteVersion: number;
  localData: any;
  remoteData: any;
  conflictType: 'VERSION_MISMATCH' | 'CONCURRENT_EDIT' | 'DELETE_CONFLICT';
  timestamp: Date;
}

export interface OfflineCacheEntry {
  id: string;
  userId: string;
  entityType: string;
  entityId: string;
  data: any;
  lastModified: Date;
  version: number;
  isDeleted: boolean;
}

export interface SyncResult {
  success: boolean;
  syncedItems: number;
  conflicts: SyncConflict[];
  errors: string[];
  lastSyncTimestamp: Date;
}

export class CrossPlatformSyncService {
  private redis: RedisClient;
  private db: Database;
  private webSocketManager = getWebSocketManager();

  constructor() {
    this.redis = RedisClient.getInstance();
    this.db = Database.getInstance();
  }

  /**
   * Synchronize data changes across all connected clients
   */
  public async syncDataChange(syncData: SyncData): Promise<void> {
    try {
      // Store sync data in Redis for real-time distribution
      await this.storeSyncData(syncData);

      // Broadcast to all connected clients for this user
      this.webSocketManager.broadcastScheduleUpdate(
        syncData.userId,
        {
          syncData,
          action: syncData.action,
          entityType: syncData.entityType
        },
        'RESCHEDULED'
      );

      // Update offline cache for mobile clients
      await this.updateOfflineCache(syncData);

      console.log(`📡 Synced ${syncData.action} for ${syncData.entityType}:${syncData.entityId}`);
    } catch (error) {
      console.error('Error syncing data change:', error);
      throw error;
    }
  }

  /**
   * Handle offline sync when client comes back online
   */
  public async syncOfflineChanges(userId: string, clientId: string, offlineChanges: SyncData[]): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      syncedItems: 0,
      conflicts: [],
      errors: [],
      lastSyncTimestamp: new Date()
    };

    try {
      // Get the last sync timestamp for this client
      const lastSyncTime = await this.getLastSyncTimestamp(userId, clientId);

      // Get server changes since last sync
      const serverChanges = await this.getServerChangesSince(userId, lastSyncTime);

      // Process each offline change
      for (const change of offlineChanges) {
        try {
          const conflict = await this.detectConflict(change, serverChanges);
          
          if (conflict) {
            result.conflicts.push(conflict);
            continue;
          }

          // Apply the change
          await this.applyDataChange(change);
          await this.syncDataChange(change);
          result.syncedItems++;

        } catch (error) {
          result.errors.push(`Failed to sync ${change.entityType}:${change.entityId} - ${error}`);
          result.success = false;
        }
      }

      // Update last sync timestamp
      await this.updateLastSyncTimestamp(userId, clientId, result.lastSyncTimestamp);

      console.log(`🔄 Offline sync completed for user ${userId}: ${result.syncedItems} items synced, ${result.conflicts.length} conflicts`);

    } catch (error) {
      console.error('Error during offline sync:', error);
      result.success = false;
      result.errors.push(`Sync failed: ${error}`);
    }

    return result;
  }

  /**
   * Get cached data for offline use
   */
  public async getOfflineCache(userId: string, entityTypes?: string[]): Promise<OfflineCacheEntry[]> {
    try {
      const cacheKey = CacheKeys.userSchedule(userId, 'offline');
      const cachedData = await this.redis.get<OfflineCacheEntry[]>(cacheKey);

      if (!cachedData) {
        return [];
      }

      // Filter by entity types if specified
      if (entityTypes && entityTypes.length > 0) {
        return cachedData.filter(entry => entityTypes.includes(entry.entityType));
      }

      return cachedData;
    } catch (error) {
      console.error('Error getting offline cache:', error);
      return [];
    }
  }

  /**
   * Update offline cache with new data
   */
  public async updateOfflineCache(syncData: SyncData): Promise<void> {
    try {
      const cacheKey = CacheKeys.userSchedule(syncData.userId, 'offline');
      const existingCache = await this.redis.get<OfflineCacheEntry[]>(cacheKey) || [];

      const cacheEntry: OfflineCacheEntry = {
        id: `${syncData.entityType}_${syncData.entityId}`,
        userId: syncData.userId,
        entityType: syncData.entityType,
        entityId: syncData.entityId,
        data: syncData.data,
        lastModified: syncData.timestamp,
        version: syncData.version,
        isDeleted: syncData.action === 'DELETE'
      };

      // Update or add the cache entry
      const existingIndex = existingCache.findIndex(
        entry => entry.entityType === syncData.entityType && entry.entityId === syncData.entityId
      );

      if (existingIndex >= 0) {
        existingCache[existingIndex] = cacheEntry;
      } else {
        existingCache.push(cacheEntry);
      }

      // Keep cache size manageable (last 1000 entries per user)
      const maxCacheSize = 1000;
      if (existingCache.length > maxCacheSize) {
        existingCache.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
        existingCache.splice(maxCacheSize);
      }

      // Store updated cache with 7-day TTL
      await this.redis.set(cacheKey, existingCache, 7 * 24 * 60 * 60);

    } catch (error) {
      console.error('Error updating offline cache:', error);
    }
  }

  /**
   * Resolve sync conflicts using conflict resolution strategies
   */
  public async resolveConflict(
    conflict: SyncConflict, 
    resolution: 'USE_LOCAL' | 'USE_REMOTE' | 'MERGE' | 'MANUAL'
  ): Promise<SyncData | null> {
    try {
      let resolvedData: any;

      switch (resolution) {
        case 'USE_LOCAL':
          resolvedData = conflict.localData;
          break;

        case 'USE_REMOTE':
          resolvedData = conflict.remoteData;
          break;

        case 'MERGE':
          resolvedData = await this.mergeConflictData(conflict);
          break;

        case 'MANUAL':
          // Manual resolution requires external input
          return null;

        default:
          throw new Error(`Unknown conflict resolution strategy: ${resolution}`);
      }

      // Create resolved sync data
      const resolvedSyncData: SyncData = {
        id: `resolved_${Date.now()}`,
        userId: '', // Will be set by caller
        entityType: conflict.entityType as any,
        entityId: conflict.entityId,
        action: 'UPDATE',
        data: resolvedData,
        timestamp: new Date(),
        clientId: 'conflict_resolver',
        version: Math.max(conflict.localVersion, conflict.remoteVersion) + 1
      };

      return resolvedSyncData;

    } catch (error) {
      console.error('Error resolving conflict:', error);
      throw error;
    }
  }

  /**
   * Get sync status for a user
   */
  public async getSyncStatus(userId: string): Promise<{
    lastSyncTimestamp: Date | null;
    pendingChanges: number;
    conflicts: number;
    isOnline: boolean;
  }> {
    try {
      const lastSyncTime = await this.getLastSyncTimestamp(userId, 'web');
      const pendingChanges = await this.getPendingChangesCount(userId);
      const conflicts = await this.getConflictsCount(userId);
      const isOnline = this.webSocketManager.isUserConnected(userId);

      return {
        lastSyncTimestamp: lastSyncTime,
        pendingChanges,
        conflicts,
        isOnline
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return {
        lastSyncTimestamp: null,
        pendingChanges: 0,
        conflicts: 0,
        isOnline: false
      };
    }
  }

  /**
   * Force full sync for a user (useful for troubleshooting)
   */
  public async forceFullSync(userId: string): Promise<SyncResult> {
    try {
      console.log(`🔄 Starting full sync for user ${userId}`);

      // Clear existing cache
      const cacheKey = CacheKeys.userSchedule(userId, 'offline');
      await this.redis.del(cacheKey);

      // Rebuild cache from database
      await this.rebuildOfflineCache(userId);

      // Broadcast full sync to all connected clients
      this.webSocketManager.broadcastScheduleUpdate(
        userId,
        { fullSync: true },
        'RESCHEDULED'
      );

      return {
        success: true,
        syncedItems: 0,
        conflicts: [],
        errors: [],
        lastSyncTimestamp: new Date()
      };

    } catch (error) {
      console.error('Error during full sync:', error);
      return {
        success: false,
        syncedItems: 0,
        conflicts: [],
        errors: [`Full sync failed: ${error}`],
        lastSyncTimestamp: new Date()
      };
    }
  }

  // Private helper methods

  private async storeSyncData(syncData: SyncData): Promise<void> {
    const key = `sync:${syncData.userId}:${syncData.timestamp.getTime()}`;
    await this.redis.set(key, syncData, 24 * 60 * 60); // 24 hour TTL
  }

  private async getLastSyncTimestamp(userId: string, clientId: string): Promise<Date | null> {
    const key = `sync:last:${userId}:${clientId}`;
    const timestamp = await this.redis.get<string>(key);
    return timestamp ? new Date(timestamp) : null;
  }

  private async updateLastSyncTimestamp(userId: string, clientId: string, timestamp: Date): Promise<void> {
    const key = `sync:last:${userId}:${clientId}`;
    await this.redis.set(key, timestamp.toISOString(), 7 * 24 * 60 * 60); // 7 day TTL
  }

  private async getServerChangesSince(userId: string, since: Date | null): Promise<SyncData[]> {
    // This would query the database for changes since the given timestamp
    // For now, return empty array as this would require database schema changes
    return [];
  }

  private async detectConflict(change: SyncData, serverChanges: SyncData[]): Promise<SyncConflict | null> {
    const conflictingChange = serverChanges.find(
      sc => sc.entityType === change.entityType && 
            sc.entityId === change.entityId &&
            sc.timestamp > change.timestamp
    );

    if (conflictingChange) {
      return {
        id: `conflict_${Date.now()}`,
        entityType: change.entityType,
        entityId: change.entityId,
        localVersion: change.version,
        remoteVersion: conflictingChange.version,
        localData: change.data,
        remoteData: conflictingChange.data,
        conflictType: 'CONCURRENT_EDIT',
        timestamp: new Date()
      };
    }

    return null;
  }

  private async applyDataChange(syncData: SyncData): Promise<void> {
    // This would apply the change to the database
    // Implementation depends on the specific entity type
    console.log(`Applying ${syncData.action} for ${syncData.entityType}:${syncData.entityId}`);
  }

  private async mergeConflictData(conflict: SyncConflict): Promise<any> {
    // Simple merge strategy - prefer newer timestamps for individual fields
    const merged = { ...conflict.remoteData };
    
    // This is a simplified merge - in practice, you'd have more sophisticated
    // merge strategies based on the entity type and field types
    Object.keys(conflict.localData).forEach(key => {
      if (conflict.localData[key] && 
          (!conflict.remoteData[key] || 
           new Date(conflict.localData[key].lastModified || 0) > 
           new Date(conflict.remoteData[key].lastModified || 0))) {
        merged[key] = conflict.localData[key];
      }
    });

    return merged;
  }

  private async getPendingChangesCount(userId: string): Promise<number> {
    // Count pending sync operations for the user
    const pattern = `sync:${userId}:*`;
    // This would use Redis SCAN to count keys matching the pattern
    return 0; // Simplified for now
  }

  private async getConflictsCount(userId: string): Promise<number> {
    // Count unresolved conflicts for the user
    const key = `conflicts:${userId}`;
    const conflicts = await this.redis.get<SyncConflict[]>(key);
    return conflicts ? conflicts.length : 0;
  }

  private async rebuildOfflineCache(userId: string): Promise<void> {
    // Rebuild the offline cache from the database
    // This would query all relevant entities for the user and cache them
    console.log(`Rebuilding offline cache for user ${userId}`);
  }
}

// Singleton instance
let crossPlatformSyncServiceInstance: CrossPlatformSyncService | null = null;

export function getCrossPlatformSyncService(): CrossPlatformSyncService {
  if (!crossPlatformSyncServiceInstance) {
    crossPlatformSyncServiceInstance = new CrossPlatformSyncService();
  }
  return crossPlatformSyncServiceInstance;
}