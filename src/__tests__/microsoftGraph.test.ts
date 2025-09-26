import request from 'supertest';
import { createApp } from '@/api';
import { db } from '@/config/database';
import { MicrosoftGraphService } from '@/services/MicrosoftGraphService';
import { CalendarConnectionRepository } from '@/repositories/CalendarConnectionRepository';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { AuthService } from '@/services/AuthService';
import { EncryptionUtils } from '@/utils/encryption';

// Mock the Microsoft Graph Service
jest.mock('@/services/MicrosoftGraphService');
jest.mock('@/utils/encryption');

const MockedMicrosoftGraphService = MicrosoftGraphService as jest.MockedClass<typeof MicrosoftGraphService>;
const mockedEncrypt = jest.spyOn(EncryptionUtils, 'encrypt');

describe('Microsoft Graph Integration', () => {
  let app: any;
  let userRepository: UserRepository;
  let authService: AuthService;
  let connectionRepository: CalendarConnectionRepository;
  let eventRepository: CalendarEventRepository;
  let testUser: any;
  let authToken: string;
  let mockMicrosoftService: jest.Mocked<MicrosoftGraphService>;

  beforeAll(async () => {
    app = createApp();
    userRepository = new UserRepository(db);
    authService = new AuthService();
    connectionRepository = new CalendarConnectionRepository(db);
    eventRepository = new CalendarEventRepository(db);

    // Create test user
    testUser = await userRepository.create({
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: 'hashedpassword',
      timezone: 'UTC',
      workingHours: {
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '17:00' }
      },
      preferences: {
        maxContinuousWorkTime: 120,
        preferredBreakDuration: 15,
        groupSimilarTasks: true,
        protectFocusTime: false,
        optimizeForEarlyCompletion: true,
        defaultMeetingBuffer: 10,
        energyPreferences: {
          highEnergyTimes: [{ start: '09:00', end: '11:00' }],
          lowEnergyTimes: [{ start: '14:00', end: '16:00' }],
          meetingPreferredTimes: [{ start: '10:00', end: '12:00' }]
        },
        autoRescheduleEnabled: true,
        notificationSettings: {
          taskReminders: true,
          scheduleChanges: true,
          deadlineAlerts: true,
          completionCelebrations: true
        }
      }
    });

    // Generate auth token
    authToken = authService.generateAccessToken(testUser.id);

    // Setup mocks
    mockMicrosoftService = new MockedMicrosoftGraphService() as jest.Mocked<MicrosoftGraphService>;
    MockedMicrosoftGraphService.mockImplementation(() => mockMicrosoftService);
    mockedEncrypt.mockImplementation((text: string) => `encrypted_${text}`);
  });

  afterAll(async () => {
    // Clean up test data
    await db.query('DELETE FROM calendar_events WHERE user_id = $1', [testUser.id]);
    await db.query('DELETE FROM calendar_connections WHERE user_id = $1', [testUser.id]);
    await db.query('DELETE FROM users WHERE id = $1', [testUser.id]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/microsoft-graph/auth-url', () => {
    it('should return Microsoft Graph authorization URL', async () => {
      const mockAuthUrl = 'https://login.microsoftonline.com/oauth/authorize?client_id=test';
      mockMicrosoftService.getAuthUrl.mockResolvedValue(mockAuthUrl);

      const response = await request(app)
        .get('/api/microsoft-graph/auth-url')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          authUrl: mockAuthUrl,
          provider: 'microsoft'
        }
      });

      expect(mockMicrosoftService.getAuthUrl).toHaveBeenCalled();
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/microsoft-graph/auth-url')
        .expect(401);
    });
  });

  describe('POST /api/microsoft-graph/callback', () => {
    it('should handle OAuth callback successfully', async () => {
      const mockCredentials = {
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123',
        expiryDate: Date.now() + 3600000
      };

      const mockProfile = {
        email: 'test@outlook.com',
        name: 'Test User'
      };

      mockMicrosoftService.exchangeCodeForTokens.mockResolvedValue(mockCredentials);
      mockMicrosoftService.getUserProfile.mockResolvedValue(mockProfile);
      mockMicrosoftService.syncEvents.mockResolvedValue({
        events: [],
        nextDeltaToken: 'delta_token_123'
      });
      mockMicrosoftService.subscribeToChanges.mockResolvedValue({
        id: 'subscription_123',
        resource: '/me/calendar/events',
        changeType: 'created,updated,deleted',
        clientState: testUser.id,
        notificationUrl: 'http://localhost:3000/api/microsoft-graph/webhook',
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      });

      const response = await request(app)
        .post('/api/microsoft-graph/callback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: 'auth_code_123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.provider).toBe('microsoft');
      expect(response.body.data.accountEmail).toBe(mockProfile.email);

      expect(mockMicrosoftService.exchangeCodeForTokens).toHaveBeenCalledWith('auth_code_123');
      expect(mockMicrosoftService.getUserProfile).toHaveBeenCalled();
      expect(mockMicrosoftService.syncEvents).toHaveBeenCalled();
      expect(mockMicrosoftService.subscribeToChanges).toHaveBeenCalled();
    });

    it('should require authorization code', async () => {
      const response = await request(app)
        .post('/api/microsoft-graph/callback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authorization code is required');
    });

    it('should handle token exchange failure', async () => {
      mockMicrosoftService.exchangeCodeForTokens.mockRejectedValue(new Error('Invalid code'));

      const response = await request(app)
        .post('/api/microsoft-graph/callback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: 'invalid_code' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to connect Microsoft Calendar');
    });
  });

  describe('GET /api/microsoft-graph/connections', () => {
    it('should return user Microsoft Graph connections', async () => {
      // Create a test connection
      const connection = await connectionRepository.create({
        userId: testUser.id,
        provider: 'microsoft',
        accountEmail: 'test@outlook.com',
        accessToken: 'encrypted_access_token',
        refreshToken: 'encrypted_refresh_token',
        expiresAt: new Date(Date.now() + 3600000),
        isActive: true
      });

      const response = await request(app)
        .get('/api/microsoft-graph/connections')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        id: connection.id,
        accountEmail: 'test@outlook.com',
        provider: 'microsoft',
        isActive: true
      });

      // Clean up
      await connectionRepository.delete(connection.id);
    });

    it('should return empty array when no connections exist', async () => {
      const response = await request(app)
        .get('/api/microsoft-graph/connections')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('POST /api/microsoft-graph/connections/:connectionId/sync', () => {
    it('should sync Microsoft Calendar events', async () => {
      // Create a test connection
      const connection = await connectionRepository.create({
        userId: testUser.id,
        provider: 'microsoft',
        accountEmail: 'test@outlook.com',
        accessToken: 'encrypted_access_token',
        refreshToken: 'encrypted_refresh_token',
        expiresAt: new Date(Date.now() + 3600000),
        isActive: true
      });

      const mockEvents = [
        {
          id: 'microsoft-event_123',
          userId: testUser.id,
          externalId: 'event_123',
          title: 'Test Meeting',
          description: 'Test meeting description',
          startTime: new Date('2024-01-15T10:00:00Z'),
          endTime: new Date('2024-01-15T11:00:00Z'),
          isFlexible: false,
          source: 'microsoft' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockMicrosoftService.syncEvents.mockResolvedValue({
        events: mockEvents,
        nextDeltaToken: 'delta_token_123'
      });

      const response = await request(app)
        .post(`/api/microsoft-graph/connections/${connection.id}/sync`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.eventsAdded).toBe(1);
      expect(response.body.data.eventsUpdated).toBe(0);

      expect(mockMicrosoftService.syncEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUser.id,
          provider: 'microsoft'
        })
      );

      // Clean up
      await db.query('DELETE FROM calendar_events WHERE user_id = $1', [testUser.id]);
      await connectionRepository.delete(connection.id);
    });

    it('should require valid connection ID', async () => {
      const response = await request(app)
        .post('/api/microsoft-graph/connections/invalid-id/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/microsoft-graph/connections/:connectionId/events', () => {
    it('should create event in Microsoft Calendar', async () => {
      // Create a test connection
      const connection = await connectionRepository.create({
        userId: testUser.id,
        provider: 'microsoft',
        accountEmail: 'test@outlook.com',
        accessToken: 'encrypted_access_token',
        refreshToken: 'encrypted_refresh_token',
        expiresAt: new Date(Date.now() + 3600000),
        isActive: true
      });

      const eventData = {
        title: 'New Meeting',
        description: 'Meeting description',
        startTime: '2024-01-15T10:00:00Z',
        endTime: '2024-01-15T11:00:00Z',
        isFlexible: false
      };

      mockMicrosoftService.createEvent.mockResolvedValue('external_event_123');

      const response = await request(app)
        .post(`/api/microsoft-graph/connections/${connection.id}/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(eventData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(eventData.title);
      expect(response.body.data.externalId).toBe('external_event_123');
      expect(response.body.data.source).toBe('microsoft');

      expect(mockMicrosoftService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUser.id,
          provider: 'microsoft'
        }),
        expect.objectContaining({
          title: eventData.title,
          description: eventData.description,
          startTime: new Date(eventData.startTime),
          endTime: new Date(eventData.endTime)
        })
      );

      // Clean up
      await db.query('DELETE FROM calendar_events WHERE user_id = $1', [testUser.id]);
      await connectionRepository.delete(connection.id);
    });

    it('should validate required fields', async () => {
      const connection = await connectionRepository.create({
        userId: testUser.id,
        provider: 'microsoft',
        accountEmail: 'test@outlook.com',
        accessToken: 'encrypted_access_token',
        refreshToken: 'encrypted_refresh_token',
        expiresAt: new Date(Date.now() + 3600000),
        isActive: true
      });

      const response = await request(app)
        .post(`/api/microsoft-graph/connections/${connection.id}/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Meeting without times'
          // Missing startTime and endTime
        })
        .expect(400);

      expect(response.body.success).toBe(false);

      // Clean up
      await connectionRepository.delete(connection.id);
    });
  });

  describe('POST /api/microsoft-graph/webhook', () => {
    it('should handle subscription validation', async () => {
      const validationToken = 'validation_token_123';

      const response = await request(app)
        .post('/api/microsoft-graph/webhook')
        .query({ validationToken })
        .expect(200);

      expect(response.text).toBe(validationToken);
    });

    it('should process webhook notifications', async () => {
      // Create a test connection
      const connection = await connectionRepository.create({
        userId: testUser.id,
        provider: 'microsoft',
        accountEmail: 'test@outlook.com',
        accessToken: 'encrypted_access_token',
        refreshToken: 'encrypted_refresh_token',
        expiresAt: new Date(Date.now() + 3600000),
        isActive: true
      });

      const webhookPayload = {
        value: [
          {
            subscriptionId: 'subscription_123',
            changeType: 'created',
            clientState: testUser.id,
            resource: '/me/calendar/events/event_123',
            resourceData: {
              id: 'event_123'
            }
          }
        ]
      };

      mockMicrosoftService.syncEvents.mockResolvedValue({
        events: [],
        nextDeltaToken: 'delta_token_123'
      });

      const response = await request(app)
        .post('/api/microsoft-graph/webhook')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Clean up
      await connectionRepository.delete(connection.id);
    });

    it('should handle webhook notifications without client state', async () => {
      const webhookPayload = {
        value: [
          {
            subscriptionId: 'subscription_123',
            changeType: 'created',
            // Missing clientState
            resource: '/me/calendar/events/event_123'
          }
        ]
      };

      const response = await request(app)
        .post('/api/microsoft-graph/webhook')
        .send(webhookPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/microsoft-graph/connections/:connectionId', () => {
    it('should disconnect Microsoft Calendar', async () => {
      // Create a test connection
      const connection = await connectionRepository.create({
        userId: testUser.id,
        provider: 'microsoft',
        accountEmail: 'test@outlook.com',
        accessToken: 'encrypted_access_token',
        refreshToken: 'encrypted_refresh_token',
        expiresAt: new Date(Date.now() + 3600000),
        isActive: true
      });

      const response = await request(app)
        .delete(`/api/microsoft-graph/connections/${connection.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Microsoft Calendar disconnected successfully');

      // Verify connection is deactivated
      const updatedConnection = await connectionRepository.findById(connection.id);
      expect(updatedConnection?.isActive).toBe(false);

      // Clean up
      await connectionRepository.delete(connection.id);
    });

    it('should handle non-existent connection', async () => {
      const response = await request(app)
        .delete('/api/microsoft-graph/connections/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Microsoft Calendar connection not found');
    });
  });

  describe('Microsoft Graph Service Unit Tests', () => {
    let microsoftGraphService: MicrosoftGraphService;

    beforeEach(() => {
      // Use the real service for unit tests
      jest.clearAllMocks();
      microsoftGraphService = new (jest.requireActual('@/services/MicrosoftGraphService').MicrosoftGraphService)();
    });

    it('should generate correct authorization URL', () => {
      const authUrl = microsoftGraphService.getAuthUrl();
      
      expect(authUrl).toContain('https://login.microsoftonline.com');
      expect(authUrl).toContain('client_id=');
      expect(authUrl).toContain('scope=');
      expect(authUrl).toContain('Calendars.ReadWrite');
      expect(authUrl).toContain('offline_access');
    });

    it('should convert Microsoft event to CalendarEvent format', () => {
      const microsoftEvent = {
        id: 'event_123',
        subject: 'Test Meeting',
        body: { content: 'Meeting description' },
        start: { dateTime: '2024-01-15T10:00:00Z' },
        end: { dateTime: '2024-01-15T11:00:00Z' },
        createdDateTime: '2024-01-15T09:00:00Z',
        lastModifiedDateTime: '2024-01-15T09:30:00Z'
      };

      // Access the private method through reflection for testing
      const convertMethod = (microsoftGraphService as any).convertMicrosoftEventToCalendarEvent;
      const calendarEvent = convertMethod.call(microsoftGraphService, microsoftEvent, testUser.id);

      expect(calendarEvent).toMatchObject({
        id: 'microsoft-event_123',
        userId: testUser.id,
        externalId: 'event_123',
        title: 'Test Meeting',
        description: 'Meeting description',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        isFlexible: false,
        source: 'microsoft'
      });
    });

    it('should extract delta token from OData link', () => {
      const deltaLink = 'https://graph.microsoft.com/v1.0/me/calendar/events/delta?$deltatoken=abc123';
      
      // Access the private method through reflection for testing
      const extractMethod = (microsoftGraphService as any).extractDeltaToken;
      const deltaToken = extractMethod.call(microsoftGraphService, deltaLink);

      expect(deltaToken).toBe('abc123');
    });

    it('should handle missing delta token in OData link', () => {
      const deltaLink = 'https://graph.microsoft.com/v1.0/me/calendar/events/delta';
      
      // Access the private method through reflection for testing
      const extractMethod = (microsoftGraphService as any).extractDeltaToken;
      const deltaToken = extractMethod.call(microsoftGraphService, deltaLink);

      expect(deltaToken).toBeUndefined();
    });
  });
});