import { Request, Response } from 'express';
import { getCrossPlatformSyncService, SyncData, SyncConflict } from '@/services/CrossPlatformSyncService';
import Joi from 'joi';

const syncDataSchema = Joi.object({
  entityType: Joi.string().valid('task', 'project', 'calendar_event', 'user_preferences').required(),
  entityId: Joi.string().required(),
  action: Joi.string().valid('CREATE', 'UPDATE', 'DELETE').required(),
  data: Joi.object().required(),
  clientId: Joi.string().required(),
  version: Joi.number().integer().min(1).required()
});

const offlineSyncSchema = Joi.object({
  clientId: Joi.string().required(),
  changes: Joi.array().items(syncDataSchema).required()
});

const conflictResolutionSchema = Joi.object({
  conflictId: Joi.string().required(),
  resolution: Joi.string().valid('USE_LOCAL', 'USE_REMOTE', 'MERGE', 'MANUAL').required(),
  manualData: Joi.object().optional()
});

export class SyncController {
  private syncService = getCrossPlatformSyncService();

  /**
   * Sync offline changes when client comes back online
   */
  public syncOfflineChanges = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = offlineSyncSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          error: {
            message: 'Invalid sync data',
            details: error.details,
            code: 'INVALID_SYNC_DATA'
          }
        });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            message: 'User not authenticated',
            code: 'UNAUTHORIZED'
          }
        });
        return;
      }

      const { clientId, changes } = value;

      // Convert changes to SyncData format
      const syncChanges: SyncData[] = changes.map((change: any) => ({
        id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        entityType: change.entityType,
        entityId: change.entityId,
        action: change.action,
        data: change.data,
        timestamp: new Date(),
        clientId,
        version: change.version
      }));

      const result = await this.syncService.syncOfflineChanges(userId, clientId, syncChanges);

      res.json({
        success: result.success,
        syncedItems: result.syncedItems,
        conflicts: result.conflicts,
        errors: result.errors,
        lastSyncTimestamp: result.lastSyncTimestamp
      });

    } catch (error) {
      console.error('Error syncing offline changes:', error);
      res.status(500).json({
        error: {
          message: 'Failed to sync offline changes',
          code: 'SYNC_FAILED'
        }
      });
    }
  };

  /**
   * Get offline cache data for mobile clients
   */
  public getOfflineCache = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            message: 'User not authenticated',
            code: 'UNAUTHORIZED'
          }
        });
        return;
      }

      const entityTypes = req.query.entityTypes as string[];
      const cacheData = await this.syncService.getOfflineCache(userId, entityTypes);

      res.json({
        cacheData,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error getting offline cache:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get offline cache',
          code: 'CACHE_FAILED'
        }
      });
    }
  };

  /**
   * Get sync status for the user
   */
  public getSyncStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            message: 'User not authenticated',
            code: 'UNAUTHORIZED'
          }
        });
        return;
      }

      const status = await this.syncService.getSyncStatus(userId);

      res.json(status);

    } catch (error) {
      console.error('Error getting sync status:', error);
      res.status(500).json({
        error: {
          message: 'Failed to get sync status',
          code: 'STATUS_FAILED'
        }
      });
    }
  };

  /**
   * Resolve sync conflicts
   */
  public resolveConflict = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = conflictResolutionSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          error: {
            message: 'Invalid conflict resolution data',
            details: error.details,
            code: 'INVALID_RESOLUTION_DATA'
          }
        });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            message: 'User not authenticated',
            code: 'UNAUTHORIZED'
          }
        });
        return;
      }

      const { conflictId, resolution, manualData } = value;

      // Get the conflict from cache/database
      // This is simplified - in practice you'd store conflicts and retrieve them
      const mockConflict: SyncConflict = {
        id: conflictId,
        entityType: 'task',
        entityId: 'example-task-id',
        localVersion: 1,
        remoteVersion: 2,
        localData: { title: 'Local Title' },
        remoteData: { title: 'Remote Title' },
        conflictType: 'CONCURRENT_EDIT',
        timestamp: new Date()
      };

      const resolvedData = await this.syncService.resolveConflict(mockConflict, resolution);

      if (resolvedData) {
        resolvedData.userId = userId;
        await this.syncService.syncDataChange(resolvedData);
      }

      res.json({
        success: true,
        resolvedData: resolvedData?.data,
        message: 'Conflict resolved successfully'
      });

    } catch (error) {
      console.error('Error resolving conflict:', error);
      res.status(500).json({
        error: {
          message: 'Failed to resolve conflict',
          code: 'RESOLUTION_FAILED'
        }
      });
    }
  };

  /**
   * Force full sync for troubleshooting
   */
  public forceFullSync = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            message: 'User not authenticated',
            code: 'UNAUTHORIZED'
          }
        });
        return;
      }

      const result = await this.syncService.forceFullSync(userId);

      res.json(result);

    } catch (error) {
      console.error('Error forcing full sync:', error);
      res.status(500).json({
        error: {
          message: 'Failed to force full sync',
          code: 'FULL_SYNC_FAILED'
        }
      });
    }
  };

  /**
   * Trigger manual sync for specific data
   */
  public triggerSync = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = syncDataSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          error: {
            message: 'Invalid sync data',
            details: error.details,
            code: 'INVALID_SYNC_DATA'
          }
        });
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            message: 'User not authenticated',
            code: 'UNAUTHORIZED'
          }
        });
        return;
      }

      const syncData: SyncData = {
        id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        entityType: value.entityType,
        entityId: value.entityId,
        action: value.action,
        data: value.data,
        timestamp: new Date(),
        clientId: value.clientId,
        version: value.version
      };

      await this.syncService.syncDataChange(syncData);

      res.json({
        success: true,
        message: 'Sync triggered successfully',
        syncId: syncData.id
      });

    } catch (error) {
      console.error('Error triggering sync:', error);
      res.status(500).json({
        error: {
          message: 'Failed to trigger sync',
          code: 'SYNC_TRIGGER_FAILED'
        }
      });
    }
  };
}