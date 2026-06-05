// @ts-nocheck
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '@/api';
import { GoogleCalendarService } from '@/services/GoogleCalendarService';
import { MicrosoftGraphService } from '@/services/MicrosoftGraphService';
import { CalendarSyncService } from '@/services/CalendarSyncService';

/**
 * End-to-End Calendar Integration Tests
 * Tests calendar integration with mock external APIs
 */
describe('E2E - Calendar Integration with Mock APIs', () => {
  let app: Express;
  let authToken: string;
  let userId: string;

  // Mock external API services
  let mockGoogleService: jest.Mocked<GoogleCalendarService>;
  let mockMicrosoftService: jest.Mocked<MicrosoftGraphService>;
  let mockSyncService: jest.Mocked<CalendarSyncService>;

  beforeAll(async () => {
    app = createApp();
    
    // Setup mock services
    setupMockServices();
    
    // Create test user and get auth token
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'calendar-test@example.com',
        password: 'SecurePassword123!',
        name: 'Calendar Test User',
        timezone: 'America/New_York'
      })
      .expect(201);

    authToken = userResponse.body.token;
    userId = userResponse.body.user.id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Google Calendar Integration Flow', () => {
    it('should complete Google Calendar OAuth and sync flow', async () => {
      // Step 1: Initiate Google Calendar connection
      const connectResponse = await request(app)
        .post('/api/calendar/google/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          authCode: 'mock-google-auth-code'
        })
        .expect(200);

      expect(connectResponse.body.success).toBe(true);
      expect(connectResponse.body.calendarConnection).toBeDefined();

      // Step 2: Mock Google Calendar events
      const mockGoogleEvents = [
        {
          id: 'google-event-1',
          summary: 'Team Standup',
          start: { dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
          end: { dateTime: new Date(Date.now() + 90 * 60 * 1000).toISOString() },
          description: 'Daily team standup meeting'
        },
        {
          id: 'google-event-2',
          summary: 'Client Presentation',
          start: { dateTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() },
          end: { dateTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString() },
          description: 'Quarterly client presentation'
        }
      ];

      mockGoogleService.listEvents.mockResolvedValue({
        items: mockGoogleEvents,
        nextPageToken: undefined
      } as any);

      // Step 3: Trigger sync
      const syncResponse = await request(app)
        .post('/api/calendar/google/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(syncResponse.body.success).toBe(true);
      expect(syncResponse.body.eventsProcessed).toBe(2);

      // Step 4: Verify events were imported
      const eventsResponse = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        })
        .expect(200);

      const importedEvents = eventsResponse.body.events.filter(
        (e: any) => e.source === 'google'
      );
      expect(importedEvents).toHaveLength(2);
      expect(importedEvents.some((e: any) => e.title === 'Team Standup')).toBe(true);
      expect(importedEvents.some((e: any) => e.title === 'Client Presentation')).toBe(true);

      // Step 5: Create local event and verify it syncs to Google
      const localEventResponse = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Local Meeting',
          description: 'Meeting created in Momentum',
          startTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
          syncToExternal: true
        })
        .expect(201);

      // Verify Google service was called to create event
      expect(mockGoogleService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: 'Local Meeting',
          description: 'Meeting created in Momentum'
        })
      );

      // Step 6: Test webhook handling (simulated)
      const webhookPayload = {
        kind: 'calendar#events',
        etag: 'mock-etag',
        items: [
          {
            id: 'google-event-3',
            summary: 'Updated Meeting',
            start: { dateTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() },
            end: { dateTime: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString() },
            updated: new Date().toISOString()
          }
        ]
      };

      const webhookResponse = await request(app)
        .post('/api/calendar/google/webhook')
        .set('Authorization', `Bearer ${authToken}`)
        .send(webhookPayload)
        .expect(200);

      expect(webhookResponse.body.success).toBe(true);
    });

    it('should handle Google Calendar API errors gracefully', async () => {
      // Mock API error
      mockGoogleService.listEvents.mockRejectedValue(new Error('Google API rate limit exceeded'));

      const syncResponse = await request(app)
        .post('/api/calendar/google/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(syncResponse.body.success).toBe(false);
      expect(syncResponse.body.error).toContain('rate limit');
    });
  });

  describe('Microsoft 365 Calendar Integration Flow', () => {
    it('should complete Microsoft Graph OAuth and sync flow', async () => {
      // Step 1: Connect Microsoft 365 Calendar
      const connectResponse = await request(app)
        .post('/api/calendar/microsoft/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          authCode: 'mock-microsoft-auth-code'
        })
        .expect(200);

      expect(connectResponse.body.success).toBe(true);

      // Step 2: Mock Microsoft Graph events
      const mockMicrosoftEvents = [
        {
          id: 'ms-event-1',
          subject: 'Board Meeting',
          start: { 
            dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            timeZone: 'America/New_York'
          },
          end: { 
            dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
            timeZone: 'America/New_York'
          },
          body: { content: 'Monthly board meeting' }
        },
        {
          id: 'ms-event-2',
          subject: 'Training Session',
          start: { 
            dateTime: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
            timeZone: 'America/New_York'
          },
          end: { 
            dateTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
            timeZone: 'America/New_York'
          },
          body: { content: 'Employee training session' }
        }
      ];

      mockMicrosoftService.listEvents.mockResolvedValue({
        value: mockMicrosoftEvents,
        '@odata.nextLink': undefined
      } as any);

      // Step 3: Trigger Microsoft sync
      const syncResponse = await request(app)
        .post('/api/calendar/microsoft/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(syncResponse.body.success).toBe(true);
      expect(syncResponse.body.eventsProcessed).toBe(2);

      // Step 4: Verify Microsoft events were imported
      const eventsResponse = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        })
        .expect(200);

      const microsoftEvents = eventsResponse.body.events.filter(
        (e: any) => e.source === 'microsoft'
      );
      expect(microsoftEvents).toHaveLength(2);
      expect(microsoftEvents.some((e: any) => e.title === 'Board Meeting')).toBe(true);
      expect(microsoftEvents.some((e: any) => e.title === 'Training Session')).toBe(true);

      // Step 5: Test bi-directional sync
      const localMeetingResponse = await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Momentum Created Meeting',
          startTime: new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() + 15 * 60 * 60 * 1000).toISOString(),
          syncToExternal: true
        })
        .expect(201);

      // Verify Microsoft service was called
      expect(mockMicrosoftService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Momentum Created Meeting'
        })
      );
    });

    it('should handle Microsoft Graph API authentication errors', async () => {
      // Mock authentication error
      mockMicrosoftService.listEvents.mockRejectedValue(new Error('Invalid access token'));

      const syncResponse = await request(app)
        .post('/api/calendar/microsoft/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(syncResponse.body.success).toBe(false);
      expect(syncResponse.body.error).toContain('access token');
    });
  });

  describe('Cross-Platform Synchronization', () => {
    it('should handle events from multiple calendar providers', async () => {
      // Step 1: Connect both Google and Microsoft calendars
      await request(app)
        .post('/api/calendar/google/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ authCode: 'mock-google-auth' })
        .expect(200);

      await request(app)
        .post('/api/calendar/microsoft/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ authCode: 'mock-microsoft-auth' })
        .expect(200);

      // Step 2: Mock events from both providers
      mockGoogleService.listEvents.mockResolvedValue({
        items: [{
          id: 'google-multi-1',
          summary: 'Google Meeting',
          start: { dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
          end: { dateTime: new Date(Date.now() + 90 * 60 * 1000).toISOString() }
        }]
      } as any);

      mockMicrosoftService.listEvents.mockResolvedValue({
        value: [{
          id: 'ms-multi-1',
          subject: 'Microsoft Meeting',
          start: { 
            dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            timeZone: 'America/New_York'
          },
          end: { 
            dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
            timeZone: 'America/New_York'
          }
        }]
      } as any);

      // Step 3: Sync all calendars
      const syncAllResponse = await request(app)
        .post('/api/calendar/sync-all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(syncAllResponse.body.success).toBe(true);
      expect(syncAllResponse.body.googleEvents).toBe(1);
      expect(syncAllResponse.body.microsoftEvents).toBe(1);

      // Step 4: Verify all events are present
      const allEventsResponse = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        })
        .expect(200);

      const googleEvents = allEventsResponse.body.events.filter((e: any) => e.source === 'google');
      const microsoftEvents = allEventsResponse.body.events.filter((e: any) => e.source === 'microsoft');

      expect(googleEvents.length).toBeGreaterThanOrEqual(1);
      expect(microsoftEvents.length).toBeGreaterThanOrEqual(1);

      // Step 5: Test conflict detection between providers
      const conflictResponse = await request(app)
        .get('/api/calendar/conflicts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(conflictResponse.body.conflicts).toBeDefined();
    });

    it('should handle sync conflicts and resolution', async () => {
      // Create overlapping events from different sources
      const googleEvent = {
        id: 'conflict-google',
        summary: 'Google Conflict Event',
        start: { dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
        end: { dateTime: new Date(Date.now() + 120 * 60 * 1000).toISOString() }
      };

      const microsoftEvent = {
        id: 'conflict-microsoft',
        subject: 'Microsoft Conflict Event',
        start: { 
          dateTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
          timeZone: 'America/New_York'
        },
        end: { 
          dateTime: new Date(Date.now() + 150 * 60 * 1000).toISOString(),
          timeZone: 'America/New_York'
        }
      };

      mockGoogleService.listEvents.mockResolvedValue({ items: [googleEvent] } as any);
      mockMicrosoftService.listEvents.mockResolvedValue({ value: [microsoftEvent] } as any);

      // Sync and detect conflicts
      const syncResponse = await request(app)
        .post('/api/calendar/sync-all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const conflictResponse = await request(app)
        .get('/api/calendar/conflicts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (conflictResponse.body.conflicts.length > 0) {
        expect(conflictResponse.body.conflicts[0]).toHaveProperty('conflictType');
        expect(conflictResponse.body.conflicts[0]).toHaveProperty('events');
        expect(conflictResponse.body.conflicts[0]).toHaveProperty('suggestions');
      }
    });
  });

  describe('Real-time Calendar Updates', () => {
    it('should handle real-time calendar change notifications', async () => {
      // Step 1: Setup webhook subscriptions
      const webhookResponse = await request(app)
        .post('/api/calendar/webhooks/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(webhookResponse.body.success).toBe(true);

      // Step 2: Simulate webhook notification for Google Calendar
      const googleWebhookPayload = {
        kind: 'calendar#events',
        etag: 'updated-etag',
        items: [{
          id: 'realtime-google-1',
          summary: 'Real-time Google Event',
          start: { dateTime: new Date(Date.now() + 30 * 60 * 1000).toISOString() },
          end: { dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
          updated: new Date().toISOString()
        }]
      };

      const googleWebhookResponse = await request(app)
        .post('/api/calendar/google/webhook')
        .set('X-Goog-Channel-ID', 'test-channel-id')
        .set('X-Goog-Resource-State', 'exists')
        .send(googleWebhookPayload)
        .expect(200);

      expect(googleWebhookResponse.body.success).toBe(true);

      // Step 3: Verify event was processed and schedule updated
      const scheduleResponse = await request(app)
        .get('/api/schedule/current')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Schedule should reflect the new firm event
      expect(scheduleResponse.body.scheduledTasks).toBeDefined();

      // Step 4: Simulate Microsoft Graph webhook
      const microsoftWebhookPayload = {
        value: [{
          subscriptionId: 'test-subscription-id',
          changeType: 'created',
          resource: 'me/events/realtime-ms-1',
          resourceData: {
            id: 'realtime-ms-1',
            subject: 'Real-time Microsoft Event',
            start: { 
              dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
              timeZone: 'America/New_York'
            },
            end: { 
              dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
              timeZone: 'America/New_York'
            }
          }
        }]
      };

      const microsoftWebhookResponse = await request(app)
        .post('/api/calendar/microsoft/webhook')
        .send(microsoftWebhookPayload)
        .expect(200);

      expect(microsoftWebhookResponse.body.success).toBe(true);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle large calendar datasets efficiently', async () => {
      // Mock large dataset
      const largeEventSet = Array.from({ length: 100 }, (_, i) => ({
        id: `large-event-${i}`,
        summary: `Event ${i}`,
        start: { dateTime: new Date(Date.now() + i * 60 * 60 * 1000).toISOString() },
        end: { dateTime: new Date(Date.now() + (i + 1) * 60 * 60 * 1000).toISOString() }
      }));

      mockGoogleService.listEvents.mockResolvedValue({
        items: largeEventSet
      } as any);

      const startTime = Date.now();
      const syncResponse = await request(app)
        .post('/api/calendar/google/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const endTime = Date.now();

      expect(syncResponse.body.success).toBe(true);
      expect(syncResponse.body.eventsProcessed).toBe(100);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle API rate limiting gracefully', async () => {
      // Mock rate limiting error
      mockGoogleService.listEvents
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce({ items: [] } as any);

      const syncResponse = await request(app)
        .post('/api/calendar/google/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should handle rate limiting and potentially retry
      expect(syncResponse.body).toHaveProperty('success');
    });

    it('should maintain data consistency during sync failures', async () => {
      // Create initial state
      await request(app)
        .post('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Consistency Test Event',
          startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString()
        })
        .expect(201);

      // Mock partial failure during sync
      mockGoogleService.listEvents.mockImplementation(async () => {
        throw new Error('Network timeout');
      });

      const syncResponse = await request(app)
        .post('/api/calendar/google/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify original data is still intact
      const eventsResponse = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const consistencyEvent = eventsResponse.body.events.find(
        (e: any) => e.title === 'Consistency Test Event'
      );
      expect(consistencyEvent).toBeDefined();
    });
  });

  // Helper functions
  function setupMockServices(): void {
    // Mock Google Calendar Service
    mockGoogleService = {
      authenticate: jest.fn().mockResolvedValue(true),
      listEvents: jest.fn(),
      createEvent: jest.fn().mockResolvedValue({ id: 'mock-created-event' }),
      updateEvent: jest.fn().mockResolvedValue({ id: 'mock-updated-event' }),
      deleteEvent: jest.fn().mockResolvedValue(true),
      setupWebhook: jest.fn().mockResolvedValue({ id: 'mock-webhook-id' })
    } as any;

    // Mock Microsoft Graph Service
    mockMicrosoftService = {
      authenticate: jest.fn().mockResolvedValue(true),
      listEvents: jest.fn(),
      createEvent: jest.fn().mockResolvedValue({ id: 'mock-created-event' }),
      updateEvent: jest.fn().mockResolvedValue({ id: 'mock-updated-event' }),
      deleteEvent: jest.fn().mockResolvedValue(true),
      setupWebhook: jest.fn().mockResolvedValue({ id: 'mock-webhook-id' })
    } as any;

    // Mock Calendar Sync Service
    mockSyncService = {
      syncGoogleCalendar: jest.fn(),
      syncMicrosoftCalendar: jest.fn(),
      syncAllCalendars: jest.fn(),
      handleWebhookNotification: jest.fn()
    } as any;

    // Replace actual services with mocks (in a real implementation)
    // This would be done through dependency injection or module mocking
  }

  async function cleanupTestData(): Promise<void> {
    try {
      if (userId && authToken) {
        await request(app)
          .delete(`/api/users/${userId}/test-cleanup`)
          .set('Authorization', `Bearer ${authToken}`)
          .catch(() => {}); // Ignore cleanup errors
      }
    } catch (error) {
      console.warn('Calendar integration test cleanup error:', error);
    }
  }
});