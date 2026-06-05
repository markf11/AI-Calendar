// @ts-nocheck
import { WebSocketService, AuthenticatedWebSocket } from '@/services/WebSocketService';
import { WebSocketManager } from '@/services/WebSocketManager';
import { Server } from 'http';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { config } from '@/config/environment';

// Mock dependencies
jest.mock('@/config/redis', () => ({
  RedisClient: {
    getInstance: jest.fn(() => ({
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      publish: jest.fn()
    }))
  }
}));

jest.mock('@/config/environment', () => ({
  config: {
    jwt: {
      secret: 'test-secret'
    }
  }
}));

describe('WebSocketService', () => {
  let webSocketService: WebSocketService;
  let mockServer: Server;
  let testUserId: string;
  let validToken: string;

  beforeEach(() => {
    webSocketService = new WebSocketService();
    mockServer = new Server();
    testUserId = 'test-user-123';
    validToken = jwt.sign({ userId: testUserId }, config.jwt.secret);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize WebSocket server with HTTP server', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      webSocketService.initialize(mockServer);
      
      expect(consoleSpy).toHaveBeenCalledWith('🔌 WebSocket server initialized');
      consoleSpy.mockRestore();
    });
  });

  describe('verifyClient', () => {
    it('should accept connection with valid token', () => {
      const mockInfo = {
        req: {
          url: `/ws?token=${validToken}`,
          headers: { host: 'localhost:3000' }
        }
      };

      // Access private method for testing
      const verifyClient = (webSocketService as any).verifyClient.bind(webSocketService);
      const result = verifyClient(mockInfo);

      expect(result).toBe(true);
      expect(mockInfo.req.userId).toBe(testUserId);
    });

    it('should reject connection without token', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockInfo = {
        req: {
          url: '/ws',
          headers: { host: 'localhost:3000' }
        }
      };

      const verifyClient = (webSocketService as any).verifyClient.bind(webSocketService);
      const result = verifyClient(mockInfo);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('WebSocket connection rejected: No token provided');
      consoleSpy.mockRestore();
    });

    it('should reject connection with invalid token', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockInfo = {
        req: {
          url: '/ws?token=invalid-token',
          headers: { host: 'localhost:3000' }
        }
      };

      const verifyClient = (webSocketService as any).verifyClient.bind(webSocketService);
      const result = verifyClient(mockInfo);

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'WebSocket connection rejected: Invalid token',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('connection management', () => {
    let mockWebSocket: jest.Mocked<AuthenticatedWebSocket>;

    beforeEach(() => {
      mockWebSocket = {
        userId: testUserId,
        isAuthenticated: true,
        readyState: WebSocket.OPEN,
        on: jest.fn(),
        close: jest.fn(),
        send: jest.fn()
      } as any;
    });

    it('should handle new connection correctly', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockRequest = { userId: testUserId };

      const handleConnection = (webSocketService as any).handleConnection.bind(webSocketService);
      handleConnection(mockWebSocket, mockRequest);

      expect(mockWebSocket.userId).toBe(testUserId);
      expect(mockWebSocket.isAuthenticated).toBe(true);
      expect(mockWebSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(consoleSpy).toHaveBeenCalledWith(`✅ WebSocket client connected: ${testUserId}`);
      
      consoleSpy.mockRestore();
    });

    it('should close connection without user ID', () => {
      const mockRequest = {};

      const handleConnection = (webSocketService as any).handleConnection.bind(webSocketService);
      handleConnection(mockWebSocket, mockRequest);

      expect(mockWebSocket.close).toHaveBeenCalledWith(1008, 'Authentication required');
    });

    it('should handle disconnection correctly', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // First connect the client
      const mockRequest = { userId: testUserId };
      const handleConnection = (webSocketService as any).handleConnection.bind(webSocketService);
      handleConnection(mockWebSocket, mockRequest);

      // Then disconnect
      const handleDisconnection = (webSocketService as any).handleDisconnection.bind(webSocketService);
      handleDisconnection(mockWebSocket);

      expect(consoleSpy).toHaveBeenCalledWith(`❌ WebSocket client disconnected: ${testUserId}`);
      consoleSpy.mockRestore();
    });
  });

  describe('message handling', () => {
    let mockWebSocket: jest.Mocked<AuthenticatedWebSocket>;

    beforeEach(() => {
      mockWebSocket = {
        userId: testUserId,
        isAuthenticated: true,
        readyState: WebSocket.OPEN,
        send: jest.fn()
      } as any;
    });

    it('should handle PING message', () => {
      const handleMessage = (webSocketService as any).handleMessage.bind(webSocketService);
      const pingMessage = JSON.stringify({ type: 'PING' });

      handleMessage(mockWebSocket, Buffer.from(pingMessage));

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'PONG',
          payload: { timestamp: expect.any(Date) },
          timestamp: expect.any(Date)
        })
      );
    });

    it('should handle SUBSCRIBE_SCHEDULE message', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const handleMessage = (webSocketService as any).handleMessage.bind(webSocketService);
      const subscribeMessage = JSON.stringify({ type: 'SUBSCRIBE_SCHEDULE' });

      handleMessage(mockWebSocket, Buffer.from(subscribeMessage));

      expect(consoleSpy).toHaveBeenCalledWith(`📡 Client ${testUserId} subscribed to schedule updates`);
      consoleSpy.mockRestore();
    });

    it('should handle unknown message type', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const handleMessage = (webSocketService as any).handleMessage.bind(webSocketService);
      const unknownMessage = JSON.stringify({ type: 'UNKNOWN_TYPE' });

      handleMessage(mockWebSocket, Buffer.from(unknownMessage));

      expect(consoleSpy).toHaveBeenCalledWith('❓ Unknown message type: UNKNOWN_TYPE');
      consoleSpy.mockRestore();
    });

    it('should handle invalid JSON message', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const handleMessage = (webSocketService as any).handleMessage.bind(webSocketService);
      const invalidMessage = 'invalid-json';

      handleMessage(mockWebSocket, Buffer.from(invalidMessage));

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error handling WebSocket message:', expect.any(Error));
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'ERROR',
          payload: { message: 'Invalid message format' },
          timestamp: expect.any(Date)
        })
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('broadcasting', () => {
    it('should broadcast message to user', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockWebSocket = {
        userId: testUserId,
        readyState: WebSocket.OPEN,
        send: jest.fn()
      } as any;

      // Simulate connected user
      const clients = (webSocketService as any).clients;
      clients.set(testUserId, new Set([mockWebSocket]));

      const message = {
        type: 'SCHEDULE_UPDATE' as const,
        payload: {
          userId: testUserId,
          scheduleData: { tasks: [] },
          changeType: 'TASK_ADDED' as const
        },
        timestamp: new Date()
      };

      webSocketService.broadcastToUser(testUserId, message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(consoleSpy).toHaveBeenCalledWith(
        `📤 Broadcasted SCHEDULE_UPDATE to 1 connections for user ${testUserId}`
      );
      consoleSpy.mockRestore();
    });

    it('should not broadcast to disconnected user', () => {
      const message = {
        type: 'SCHEDULE_UPDATE' as const,
        payload: {
          userId: testUserId,
          scheduleData: { tasks: [] },
          changeType: 'TASK_ADDED' as const
        },
        timestamp: new Date()
      };

      // Should not throw error when user is not connected
      expect(() => {
        webSocketService.broadcastToUser(testUserId, message);
      }).not.toThrow();
    });
  });

  describe('utility methods', () => {
    it('should return correct connected user count', () => {
      const clients = (webSocketService as any).clients;
      clients.set('user1', new Set([{}, {}]));
      clients.set('user2', new Set([{}]));

      expect(webSocketService.getConnectedUserCount()).toBe(2);
    });

    it('should return correct user connection count', () => {
      const clients = (webSocketService as any).clients;
      clients.set(testUserId, new Set([{}, {}]));

      expect(webSocketService.getUserConnectionCount(testUserId)).toBe(2);
      expect(webSocketService.getUserConnectionCount('non-existent')).toBe(0);
    });

    it('should check if user is connected', () => {
      const clients = (webSocketService as any).clients;
      clients.set(testUserId, new Set([{}]));

      expect(webSocketService.isUserConnected(testUserId)).toBe(true);
      expect(webSocketService.isUserConnected('non-existent')).toBe(false);
    });
  });
});

describe('WebSocketManager', () => {
  let webSocketManager: WebSocketManager;
  let mockWebSocketService: jest.Mocked<any>;

  beforeEach(() => {
    mockWebSocketService = {
      broadcastToUser: jest.fn(),
      broadcastToUsers: jest.fn(),
      isUserConnected: jest.fn(),
      getUserConnectionCount: jest.fn(),
      getConnectedUserCount: jest.fn()
    };

    webSocketManager = new WebSocketManager();
    (webSocketManager as any).webSocketService = mockWebSocketService;
  });

  describe('broadcastScheduleUpdate', () => {
    it('should broadcast schedule update with correct format', () => {
      const userId = 'test-user';
      const scheduleData = { tasks: [] };
      const changeType = 'TASK_ADDED';

      webSocketManager.broadcastScheduleUpdate(userId, scheduleData, changeType);

      expect(mockWebSocketService.broadcastToUser).toHaveBeenCalledWith(userId, {
        type: 'SCHEDULE_UPDATE',
        payload: {
          userId,
          scheduleData,
          changeType
        },
        timestamp: expect.any(Date)
      });
    });
  });

  describe('broadcastTaskCompletion', () => {
    it('should broadcast task completion with correct format', () => {
      const userId = 'test-user';
      const taskId = 'task-123';

      webSocketManager.broadcastTaskCompletion(userId, taskId);

      expect(mockWebSocketService.broadcastToUser).toHaveBeenCalledWith(userId, {
        type: 'TASK_COMPLETION',
        payload: {
          userId,
          taskId,
          completedAt: expect.any(Date)
        },
        timestamp: expect.any(Date)
      });
    });
  });

  describe('broadcastCalendarSync', () => {
    it('should broadcast calendar sync status with correct format', () => {
      const userId = 'test-user';
      const syncStatus = 'COMPLETED';
      const provider = 'google';

      webSocketManager.broadcastCalendarSync(userId, syncStatus, provider);

      expect(mockWebSocketService.broadcastToUser).toHaveBeenCalledWith(userId, {
        type: 'CALENDAR_SYNC',
        payload: {
          userId,
          syncStatus,
          provider
        },
        timestamp: expect.any(Date)
      });
    });

    it('should broadcast calendar sync with error', () => {
      const userId = 'test-user';
      const syncStatus = 'FAILED';
      const provider = 'microsoft';
      const error = 'Connection timeout';

      webSocketManager.broadcastCalendarSync(userId, syncStatus, provider, error);

      expect(mockWebSocketService.broadcastToUser).toHaveBeenCalledWith(userId, {
        type: 'CALENDAR_SYNC',
        payload: {
          userId,
          syncStatus,
          provider,
          error
        },
        timestamp: expect.any(Date)
      });
    });
  });

  describe('utility methods', () => {
    it('should delegate to WebSocketService methods', () => {
      const userId = 'test-user';
      const userIds = ['user1', 'user2'];
      const message = {
        type: 'SCHEDULE_UPDATE' as const,
        payload: { userId, scheduleData: {}, changeType: 'TASK_ADDED' as const },
        timestamp: new Date()
      };

      mockWebSocketService.isUserConnected.mockReturnValue(true);
      mockWebSocketService.getUserConnectionCount.mockReturnValue(2);
      mockWebSocketService.getConnectedUserCount.mockReturnValue(5);

      webSocketManager.broadcastToUsers(userIds, message);
      const isConnected = webSocketManager.isUserConnected(userId);
      const userConnections = webSocketManager.getUserConnectionCount(userId);
      const totalConnections = webSocketManager.getConnectedUserCount();

      expect(mockWebSocketService.broadcastToUsers).toHaveBeenCalledWith(userIds, message);
      expect(mockWebSocketService.isUserConnected).toHaveBeenCalledWith(userId);
      expect(mockWebSocketService.getUserConnectionCount).toHaveBeenCalledWith(userId);
      expect(mockWebSocketService.getConnectedUserCount).toHaveBeenCalled();

      expect(isConnected).toBe(true);
      expect(userConnections).toBe(2);
      expect(totalConnections).toBe(5);
    });
  });
});