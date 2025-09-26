import { GoogleCalendarService } from '@/services/GoogleCalendarService';
import { CalendarConnectionRepository } from '@/repositories/CalendarConnectionRepository';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import { encrypt, decrypt } from '@/utils/encryption';
import { config } from '@/config/environment';

// Mock the googleapis module
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/oauth/authorize?mock=true'),
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'mock_access_token',
            refresh_token: 'mock_refresh_token',
            expiry_date: Date.now() + 3600000
          }
        }),
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new_mock_access_token',
            expiry_date: Date.now() + 3600000
          }
        })
      }))
    },
    calendar: jest.fn().mockImplementation(() => ({
      calendarList: {
        list: jest.fn().mockResolvedValue({
          data: {
            items: [
              {
                id: 'primary',
                summary: 'Test Calendar',
                primary: true
              }
            ]
          }
        })
      },
      events: {
        list: jest.fn().mockResolvedValue({
          data: {
            items: [
              {
                id: 'event1',
                summary: 'Test Event',
                description: 'Test Description',
                start: { dateTime: '2024-01-01T10:00:00Z' },
                end: { dateTime: '2024-01-01T11:00:00Z' },
                created: '2024-01-01T09:00:00Z',
                updated: '2024-01-01T09:00:00Z'
              }
            ],
            nextSyncToken: 'mock_sync_token'
          }
        }),
        insert: jest.fn().mockResolvedValue({
          data: { id: 'new_event_id' }
        }),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        watch: jest.fn().mockResolvedValue({
          data: {
            resourceId: 'mock_resource_id',
            resourceUri: 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
          }
        })
      },
      channels: {
        stop: jest.fn().mockResolvedValue({})
      }
    })),
    oauth2: jest.fn().mockImplementation(() => ({
      userinfo: {
        get: jest.fn().mockResolvedValue({
          data: {
            email: 'test@example.com',
            name: 'Test User'
          }
        })
      }
    }))
  }
}));

// Mock encryption utilities
jest.mock('@/utils/encryption', () => ({
  encrypt: jest.fn().mockImplementation((text: string) => `encrypted_${text}`),
  decrypt: jest.fn().mockImplementation((text: string) => text.replace('encrypted_', ''))
}));

// Mock config
jest.mock('@/config/environment', () => ({
  config: {
    google: {
      clientId: 'mock_client_id',
      clientSecret: 'mock_client_secret',
      redirectUri: 'http://localhost:3000/auth/google/callback'
    }
  }
}));

describe('GoogleCalendarService', () => {
  let googleCalendarService: GoogleCalendarService;
  let mockConnection: any;

  beforeEach(() => {
    googleCalendarService = new GoogleCalendarService();
    mockConnection = {
      id: 'conn1',
      userId: 'user1',
      provider: 'google',
      accountEmail: 'test@example.com',
      accessToken: 'encrypted_mock_access_token',
      refreshToken: 'encrypted_mock_refresh_token',
      expiresAt: new Date(Date.now() + 3600000),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthUrl', () => {
    it('should generate OAuth authorization URL', () => {
      const authUrl = googleCalendarService.getAuthUrl();
      expect(authUrl).toBe('https://accounts.google.com/oauth/authorize?mock=true');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange authorization code for tokens', async () => {
      const credentials = await googleCalendarService.exchangeCodeForTokens('mock_code');
      
      expect(credentials).toEqual({
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
        expiryDate: expect.any(Number)
      });
    });

    it('should throw error if tokens are missing', async () => {
      const { google } = require('googleapis');
      const mockOAuth2 = google.auth.OAuth2.mock.results[0].value;
      mockOAuth2.getToken.mockResolvedValueOnce({
        tokens: { access_token: 'token' } // Missing refresh_token
      });

      await expect(googleCalendarService.exchangeCodeForTokens('mock_code'))
        .rejects.toThrow('Failed to obtain required tokens from Google');
    });
  });

  describe('syncEvents', () => {
    it('should sync events from Google Calendar', async () => {
      const result = await googleCalendarService.syncEvents(mockConnection);
      
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        id: 'google-event1',
        userId: 'user1',
        externalId: 'event1',
        title: 'Test Event',
        description: 'Test Description',
        isFlexible: false,
        source: 'google'
      });
      expect(result.nextSyncToken).toBe('mock_sync_token');
    });

    it('should handle expired tokens by refreshing', async () => {
      const expiredConnection = {
        ...mockConnection,
        expiresAt: new Date(Date.now() - 1000) // Expired
      };

      const result = await googleCalendarService.syncEvents(expiredConnection);
      
      expect(result.events).toHaveLength(1);
      // Verify refresh was called
      const { google } = require('googleapis');
      const mockOAuth2 = google.auth.OAuth2.mock.results[0].value;
      expect(mockOAuth2.refreshAccessToken).toHaveBeenCalled();
    });
  });

  describe('createEvent', () => {
    it('should create event in Google Calendar', async () => {
      const eventData = {
        title: 'New Event',
        description: 'New Description',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T11:00:00Z')
      };

      const eventId = await googleCalendarService.createEvent(mockConnection, eventData);
      
      expect(eventId).toBe('new_event_id');
      
      const { google } = require('googleapis');
      const mockCalendar = google.calendar.mock.results[0].value;
      expect(mockCalendar.events.insert).toHaveBeenCalledWith({
        calendarId: 'primary',
        requestBody: {
          summary: 'New Event',
          description: 'New Description',
          start: {
            dateTime: '2024-01-01T10:00:00.000Z',
            timeZone: 'UTC'
          },
          end: {
            dateTime: '2024-01-01T11:00:00.000Z',
            timeZone: 'UTC'
          }
        }
      });
    });
  });

  describe('updateEvent', () => {
    it('should update event in Google Calendar', async () => {
      const updates = {
        title: 'Updated Event',
        startTime: new Date('2024-01-01T11:00:00Z')
      };

      await googleCalendarService.updateEvent(mockConnection, 'event1', updates);
      
      const { google } = require('googleapis');
      const mockCalendar = google.calendar.mock.results[0].value;
      expect(mockCalendar.events.update).toHaveBeenCalledWith({
        calendarId: 'primary',
        eventId: 'event1',
        requestBody: {
          summary: 'Updated Event',
          start: {
            dateTime: '2024-01-01T11:00:00.000Z',
            timeZone: 'UTC'
          }
        }
      });
    });
  });

  describe('deleteEvent', () => {
    it('should delete event from Google Calendar', async () => {
      await googleCalendarService.deleteEvent(mockConnection, 'event1');
      
      const { google } = require('googleapis');
      const mockCalendar = google.calendar.mock.results[0].value;
      expect(mockCalendar.events.delete).toHaveBeenCalledWith({
        calendarId: 'primary',
        eventId: 'event1'
      });
    });
  });

  describe('subscribeToChanges', () => {
    it('should subscribe to calendar changes via webhook', async () => {
      const webhookUrl = 'https://example.com/webhook';
      
      const webhook = await googleCalendarService.subscribeToChanges(
        mockConnection, 
        webhookUrl
      );
      
      expect(webhook).toMatchObject({
        id: expect.stringContaining('momentum-user1-'),
        resourceId: 'mock_resource_id',
        resourceUri: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        token: 'user1'
      });
      
      const { google } = require('googleapis');
      const mockCalendar = google.calendar.mock.results[0].value;
      expect(mockCalendar.events.watch).toHaveBeenCalledWith({
        calendarId: 'primary',
        requestBody: {
          id: expect.stringContaining('momentum-user1-'),
          type: 'web_hook',
          address: webhookUrl,
          token: 'user1',
          expiration: expect.any(String)
        }
      });
    });
  });

  describe('getUserProfile', () => {
    it('should get user profile information', async () => {
      const profile = await googleCalendarService.getUserProfile(mockConnection);
      
      expect(profile).toEqual({
        email: 'test@example.com',
        name: 'Test User'
      });
    });
  });
});

describe('CalendarConnectionRepository', () => {
  let repository: CalendarConnectionRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn()
    };
    repository = new CalendarConnectionRepository(mockDb);
  });

  describe('create', () => {
    it('should create a new calendar connection', async () => {
      const connectionData = {
        userId: 'user1',
        provider: 'google' as const,
        accountEmail: 'test@example.com',
        accessToken: 'encrypted_token',
        refreshToken: 'encrypted_refresh',
        expiresAt: new Date(),
        isActive: true
      };

      const mockResult = {
        rows: [{
          id: 'conn1',
          user_id: 'user1',
          provider: 'google',
          account_email: 'test@example.com',
          access_token: 'encrypted_token',
          refresh_token: 'encrypted_refresh',
          expires_at: new Date(),
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      mockDb.query.mockResolvedValue(mockResult);

      const result = await repository.create(connectionData);

      expect(result.id).toBe('conn1');
      expect(result.userId).toBe('user1');
      expect(result.provider).toBe('google');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO calendar_connections'),
        expect.arrayContaining([
          'user1',
          'google',
          'test@example.com',
          'encrypted_token',
          'encrypted_refresh',
          connectionData.expiresAt,
          true
        ])
      );
    });
  });

  describe('findByUserAndProvider', () => {
    it('should find connection by user ID and provider', async () => {
      const mockResult = {
        rows: [{
          id: 'conn1',
          user_id: 'user1',
          provider: 'google',
          account_email: 'test@example.com',
          access_token: 'encrypted_token',
          refresh_token: 'encrypted_refresh',
          expires_at: new Date(),
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      mockDb.query.mockResolvedValue(mockResult);

      const result = await repository.findByUserAndProvider('user1', 'google');

      expect(result).not.toBeNull();
      expect(result!.userId).toBe('user1');
      expect(result!.provider).toBe('google');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1 AND provider = $2'),
        ['user1', 'google']
      );
    });

    it('should return null if connection not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findByUserAndProvider('user1', 'google');

      expect(result).toBeNull();
    });
  });
});

describe('CalendarEventRepository', () => {
  let repository: CalendarEventRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn()
    };
    repository = new CalendarEventRepository(mockDb);
  });

  describe('create', () => {
    it('should create a new calendar event', async () => {
      const eventData = {
        title: 'Test Event',
        description: 'Test Description',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T11:00:00Z'),
        isFlexible: false,
        externalId: 'google_event_1',
        source: 'google' as const
      };

      const mockResult = {
        rows: [{
          id: 'event1',
          user_id: 'user1',
          external_id: 'google_event_1',
          title: 'Test Event',
          description: 'Test Description',
          start_time: new Date('2024-01-01T10:00:00Z'),
          end_time: new Date('2024-01-01T11:00:00Z'),
          is_flexible: false,
          travel_time_before: null,
          travel_time_after: null,
          source: 'google',
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      mockDb.query.mockResolvedValue(mockResult);

      const result = await repository.create('user1', eventData);

      expect(result.id).toBe('event1');
      expect(result.title).toBe('Test Event');
      expect(result.source).toBe('google');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO calendar_events'),
        expect.arrayContaining([
          'user1',
          'google_event_1',
          'Test Event',
          'Test Description',
          eventData.startTime,
          eventData.endTime,
          false,
          null,
          null,
          'google'
        ])
      );
    });
  });

  describe('findByExternalId', () => {
    it('should find event by external ID and source', async () => {
      const mockResult = {
        rows: [{
          id: 'event1',
          user_id: 'user1',
          external_id: 'google_event_1',
          title: 'Test Event',
          description: 'Test Description',
          start_time: new Date('2024-01-01T10:00:00Z'),
          end_time: new Date('2024-01-01T11:00:00Z'),
          is_flexible: false,
          travel_time_before: null,
          travel_time_after: null,
          source: 'google',
          created_at: new Date(),
          updated_at: new Date()
        }]
      };

      mockDb.query.mockResolvedValue(mockResult);

      const result = await repository.findByExternalId('google_event_1', 'google', 'user1');

      expect(result).not.toBeNull();
      expect(result!.externalId).toBe('google_event_1');
      expect(result!.source).toBe('google');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE external_id = $1 AND source = $2 AND user_id = $3'),
        ['google_event_1', 'google', 'user1']
      );
    });
  });
});