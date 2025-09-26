import { getCrossPlatformSyncService, SyncData } from './CrossPlatformSyncService';

/**
 * Sync Middleware - Automatically handles synchronization for data changes
 * This middleware can be used by other services to ensure data changes are synced
 */
export class SyncMiddleware {
  private syncService = getCrossPlatformSyncService();

  /**
   * Wrap a service method to automatically sync changes
   */
  public withSync<T extends any[], R>(
    userId: string,
    entityType: 'task' | 'project' | 'calendar_event' | 'user_preferences',
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    clientId: string = 'server'
  ) {
    return (originalMethod: (...args: T) => Promise<R>) => {
      return async (...args: T): Promise<R> => {
        // Execute the original method
        const result = await originalMethod(...args);

        // Extract entity ID and data from result
        const entityId = this.extractEntityId(result);
        const data = this.extractEntityData(result);

        if (entityId) {
          // Create sync data
          const syncData: SyncData = {
            id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId,
            entityType,
            entityId,
            action,
            data,
            timestamp: new Date(),
            clientId,
            version: this.generateVersion()
          };

          // Sync the change (fire and forget to not block the original operation)
          this.syncService.syncDataChange(syncData).catch(error => {
            console.error('Error syncing data change:', error);
          });
        }

        return result;
      };
    };
  }

  /**
   * Manually trigger sync for a data change
   */
  public async triggerSync(
    userId: string,
    entityType: 'task' | 'project' | 'calendar_event' | 'user_preferences',
    entityId: string,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    data: any,
    clientId: string = 'server'
  ): Promise<void> {
    const syncData: SyncData = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      entityType,
      entityId,
      action,
      data,
      timestamp: new Date(),
      clientId,
      version: this.generateVersion()
    };

    await this.syncService.syncDataChange(syncData);
  }

  /**
   * Batch sync multiple changes
   */
  public async batchSync(changes: Array<{
    userId: string;
    entityType: 'task' | 'project' | 'calendar_event' | 'user_preferences';
    entityId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    data: any;
    clientId?: string;
  }>): Promise<void> {
    const syncPromises = changes.map(change => {
      const syncData: SyncData = {
        id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: change.userId,
        entityType: change.entityType,
        entityId: change.entityId,
        action: change.action,
        data: change.data,
        timestamp: new Date(),
        clientId: change.clientId || 'server',
        version: this.generateVersion()
      };

      return this.syncService.syncDataChange(syncData);
    });

    await Promise.all(syncPromises);
  }

  // Private helper methods

  private extractEntityId(result: any): string | null {
    if (!result) return null;
    
    // Try common ID field names
    if (result.id) return result.id;
    if (result._id) return result._id;
    if (result.uuid) return result.uuid;
    
    return null;
  }

  private extractEntityData(result: any): any {
    // Return the full result as data
    // In practice, you might want to filter out sensitive fields
    return result;
  }

  private generateVersion(): number {
    // Simple version generation based on timestamp
    // In practice, you might want a more sophisticated versioning system
    return Date.now();
  }
}

// Singleton instance
let syncMiddlewareInstance: SyncMiddleware | null = null;

export function getSyncMiddleware(): SyncMiddleware {
  if (!syncMiddlewareInstance) {
    syncMiddlewareInstance = new SyncMiddleware();
  }
  return syncMiddlewareInstance;
}

// Decorator for automatic sync
export function AutoSync(
  entityType: 'task' | 'project' | 'calendar_event' | 'user_preferences',
  action: 'CREATE' | 'UPDATE' | 'DELETE'
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const syncMiddleware = getSyncMiddleware();

    descriptor.value = function (...args: any[]) {
      // Extract userId from method arguments or context
      const userId = this.extractUserId ? this.extractUserId(args) : args[0];
      const clientId = this.extractClientId ? this.extractClientId(args) : 'server';

      if (userId) {
        const wrappedMethod = syncMiddleware.withSync(userId, entityType, action, clientId)(method.bind(this));
        return wrappedMethod(...args);
      } else {
        // Fallback to original method if userId cannot be extracted
        return method.apply(this, args);
      }
    };

    return descriptor;
  };
}