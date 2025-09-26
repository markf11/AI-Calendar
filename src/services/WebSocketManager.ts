import { getWebSocketService, BroadcastMessage } from './WebSocketService';

/**
 * WebSocket Manager - High-level interface for broadcasting messages
 * This service provides convenient methods for other services to send real-time updates
 */
export class WebSocketManager {
  private webSocketService = getWebSocketService();

  /**
   * Broadcast schedule update to user
   */
  public broadcastScheduleUpdate(
    userId: string, 
    scheduleData: any, 
    changeType: 'TASK_ADDED' | 'TASK_UPDATED' | 'TASK_DELETED' | 'CALENDAR_SYNC' | 'RESCHEDULED'
  ): void {
    const message: BroadcastMessage = {
      type: 'SCHEDULE_UPDATE',
      payload: {
        userId,
        scheduleData,
        changeType
      },
      timestamp: new Date()
    };

    this.webSocketService.broadcastToUser(userId, message);
  }

  /**
   * Broadcast task completion to user
   */
  public broadcastTaskCompletion(userId: string, taskId: string): void {
    const message: BroadcastMessage = {
      type: 'TASK_COMPLETION',
      payload: {
        userId,
        taskId,
        completedAt: new Date()
      },
      timestamp: new Date()
    };

    this.webSocketService.broadcastToUser(userId, message);
  }

  /**
   * Broadcast calendar sync status to user
   */
  public broadcastCalendarSync(
    userId: string, 
    syncStatus: 'STARTED' | 'COMPLETED' | 'FAILED',
    provider: 'google' | 'microsoft',
    error?: string
  ): void {
    const message: BroadcastMessage = {
      type: 'CALENDAR_SYNC',
      payload: {
        userId,
        syncStatus,
        provider,
        error
      },
      timestamp: new Date()
    };

    this.webSocketService.broadcastToUser(userId, message);
  }

  /**
   * Broadcast message to multiple users (for team features)
   */
  public broadcastToUsers(userIds: string[], message: BroadcastMessage): void {
    this.webSocketService.broadcastToUsers(userIds, message);
  }

  /**
   * Check if user is connected
   */
  public isUserConnected(userId: string): boolean {
    return this.webSocketService.isUserConnected(userId);
  }

  /**
   * Get connection count for user
   */
  public getUserConnectionCount(userId: string): number {
    return this.webSocketService.getUserConnectionCount(userId);
  }

  /**
   * Get total connected users
   */
  public getConnectedUserCount(): number {
    return this.webSocketService.getConnectedUserCount();
  }
}

// Singleton instance
let webSocketManagerInstance: WebSocketManager | null = null;

export function getWebSocketManager(): WebSocketManager {
  if (!webSocketManagerInstance) {
    webSocketManagerInstance = new WebSocketManager();
  }
  return webSocketManagerInstance;
}