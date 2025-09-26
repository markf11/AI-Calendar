import WebSocket, { WebSocketServer } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '@/config/environment';
import { RedisClient } from '@/config/redis';

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAuthenticated?: boolean;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: Date;
}

export interface ScheduleUpdateMessage extends WebSocketMessage {
  type: 'SCHEDULE_UPDATE';
  payload: {
    userId: string;
    scheduleData: any;
    changeType: 'TASK_ADDED' | 'TASK_UPDATED' | 'TASK_DELETED' | 'CALENDAR_SYNC' | 'RESCHEDULED';
  };
}

export interface TaskCompletionMessage extends WebSocketMessage {
  type: 'TASK_COMPLETION';
  payload: {
    userId: string;
    taskId: string;
    completedAt: Date;
  };
}

export interface CalendarSyncMessage extends WebSocketMessage {
  type: 'CALENDAR_SYNC';
  payload: {
    userId: string;
    syncStatus: 'STARTED' | 'COMPLETED' | 'FAILED';
    provider: 'google' | 'microsoft';
    error?: string;
  };
}

export type BroadcastMessage = ScheduleUpdateMessage | TaskCompletionMessage | CalendarSyncMessage;

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private redis: RedisClient;

  constructor() {
    this.redis = RedisClient.getInstance();
  }

  /**
   * Initialize WebSocket server with HTTP server
   */
  public initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this)
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleServerError.bind(this));

    console.log('🔌 WebSocket server initialized');
  }

  /**
   * Verify client connection with authentication
   */
  private verifyClient(info: any): boolean {
    try {
      const url = new URL(info.req.url, `http://${info.req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        console.log('WebSocket connection rejected: No token provided');
        return false;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      
      // Store user ID for later use
      info.req.userId = decoded.userId;
      
      return true;
    } catch (error) {
      console.log('WebSocket connection rejected: Invalid token', error);
      return false;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: AuthenticatedWebSocket, request: any): void {
    const userId = request.userId;
    
    if (!userId) {
      ws.close(1008, 'Authentication required');
      return;
    }

    // Mark as authenticated and store user ID
    ws.userId = userId;
    ws.isAuthenticated = true;

    // Add to user's connection set
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(ws);

    console.log(`✅ WebSocket client connected: ${userId}`);

    // Set up message handlers
    ws.on('message', (data) => this.handleMessage(ws, data));
    ws.on('close', () => this.handleDisconnection(ws));
    ws.on('error', (error) => this.handleClientError(ws, error));

    // Send connection confirmation
    this.sendToClient(ws, {
      type: 'CONNECTION_ESTABLISHED',
      payload: { userId, timestamp: new Date() },
      timestamp: new Date()
    });

    // Subscribe to Redis channels for this user
    this.subscribeToUserUpdates(userId);
  }

  /**
   * Handle incoming messages from clients
   */
  private handleMessage(ws: AuthenticatedWebSocket, data: any): void {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'PING':
          this.sendToClient(ws, {
            type: 'PONG',
            payload: { timestamp: new Date() },
            timestamp: new Date()
          });
          break;
          
        case 'SUBSCRIBE_SCHEDULE':
          // Client requesting schedule updates
          console.log(`📡 Client ${ws.userId} subscribed to schedule updates`);
          break;
          
        default:
          console.log(`❓ Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.sendToClient(ws, {
        type: 'ERROR',
        payload: { message: 'Invalid message format' },
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(ws: AuthenticatedWebSocket): void {
    if (ws.userId) {
      const userConnections = this.clients.get(ws.userId);
      if (userConnections) {
        userConnections.delete(ws);
        
        // Remove user entry if no more connections
        if (userConnections.size === 0) {
          this.clients.delete(ws.userId);
          this.unsubscribeFromUserUpdates(ws.userId);
        }
      }
      
      console.log(`❌ WebSocket client disconnected: ${ws.userId}`);
    }
  }

  /**
   * Handle client errors
   */
  private handleClientError(ws: AuthenticatedWebSocket, error: Error): void {
    console.error(`WebSocket client error (${ws.userId}):`, error);
  }

  /**
   * Handle server errors
   */
  private handleServerError(error: Error): void {
    console.error('WebSocket server error:', error);
  }

  /**
   * Send message to specific client
   */
  private sendToClient(ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending message to client:', error);
      }
    }
  }

  /**
   * Broadcast message to all connections of a specific user
   */
  public broadcastToUser(userId: string, message: BroadcastMessage): void {
    const userConnections = this.clients.get(userId);
    
    if (userConnections && userConnections.size > 0) {
      userConnections.forEach(ws => {
        this.sendToClient(ws, message);
      });
      
      console.log(`📤 Broadcasted ${message.type} to ${userConnections.size} connections for user ${userId}`);
    }

    // Also publish to Redis for cross-instance communication
    this.publishToRedis(userId, message);
  }

  /**
   * Broadcast message to multiple users
   */
  public broadcastToUsers(userIds: string[], message: BroadcastMessage): void {
    userIds.forEach(userId => {
      this.broadcastToUser(userId, message);
    });
  }

  /**
   * Get connected user count
   */
  public getConnectedUserCount(): number {
    return this.clients.size;
  }

  /**
   * Get connection count for specific user
   */
  public getUserConnectionCount(userId: string): number {
    const userConnections = this.clients.get(userId);
    return userConnections ? userConnections.size : 0;
  }

  /**
   * Check if user is connected
   */
  public isUserConnected(userId: string): boolean {
    return this.clients.has(userId) && this.clients.get(userId)!.size > 0;
  }

  /**
   * Subscribe to Redis channels for user updates
   */
  private async subscribeToUserUpdates(userId: string): Promise<void> {
    try {
      await this.redis.subscribe(`user:${userId}:updates`, (message) => {
        try {
          this.broadcastToUser(userId, message);
        } catch (error) {
          console.error('Error processing Redis message:', error);
        }
      });
    } catch (error) {
      console.error('Error subscribing to Redis updates:', error);
    }
  }

  /**
   * Unsubscribe from Redis channels for user
   */
  private async unsubscribeFromUserUpdates(userId: string): Promise<void> {
    try {
      await this.redis.unsubscribe(`user:${userId}:updates`);
      console.log(`🔕 Unsubscribed from updates for user ${userId}`);
    } catch (error) {
      console.error('Error unsubscribing from Redis updates:', error);
    }
  }

  /**
   * Publish message to Redis for cross-instance communication
   */
  private async publishToRedis(userId: string, message: BroadcastMessage): Promise<void> {
    try {
      await this.redis.publish(`user:${userId}:updates`, JSON.stringify(message));
    } catch (error) {
      console.error('Error publishing to Redis:', error);
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    if (this.wss) {
      console.log('🔌 Shutting down WebSocket server...');
      
      // Close all client connections
      this.clients.forEach((connections, userId) => {
        connections.forEach(ws => {
          ws.close(1001, 'Server shutting down');
        });
      });
      
      // Close server
      this.wss.close();
      this.clients.clear();
      
      console.log('✅ WebSocket server shutdown complete');
    }
  }
}

// Singleton instance
let webSocketServiceInstance: WebSocketService | null = null;

export function getWebSocketService(): WebSocketService {
  if (!webSocketServiceInstance) {
    webSocketServiceInstance = new WebSocketService();
  }
  return webSocketServiceInstance;
}