// @ts-nocheck
import { CalendarSyncService, SyncOptions } from '@/services/CalendarSyncService';
import { CalendarWebhookService } from '@/services/CalendarWebhookService';
import { GoogleCalendarService } from '@/services/GoogleCalendarService';
import { MicrosoftGraphService } from '@/services/MicrosoftGraphService';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import { CalendarConnectionRepository } from '@/repositories/CalendarConnectionRepository';
import { CalendarEvent } from '@/models/CalendarEvent';
import { CalendarConnection, SyncResult } from '@/models/types';
import { Pool } from 'pg';
import { EncryptionUtils } from '@/utils/encryption';

// Mock dependencies
jest.mock('@/services/GoogleCalendarService');
jest.mock('@/services/MicrosoftGraphService');
jest.mock('@/repositories/CalendarEventRepository');
jest.mock('@/repositories/CalendarConnectionRepository');
jest.mock('@/utils/encryption');

describe('CalendarSyncService', () => {
  let syncService: CalendarSyncService;
  let mockDb: jest.Mocked<Pool>;
  let mockGoogleService: jest.Mocked<GoogleCalendarService>;
  let mockMicrosoftService: jest.Mocked<MicrosoftGraphService>;
  let mockEventRepository: jest.Mocked<CalendarEventRepository>;
  let mockConnectionRepository: jest.Mocked<CalendarConnectionRepository>;

  const mockUserId = 'user-123';
  const mockConnection: CalendarConnection = {
    id: 'conn-123',
    userId: mockUserId,
    provider: 'google',
    accountEmail: 'test@example.com',
    accessToken: 'encrypted-access-token',
    refreshToken: 'encrypted-refresh-token',
    expiresAt: new Date(Date.now() + 3600000),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockCalendarEvent: CalendarEvent = {
    id: 'event-123',
    userId: mockUserId,
    externalId: 'google-event-123',
    title: 'Test Event',
    description: 'Test Description',
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: new Date('2024-01-01T11:00:00Z'),
    isFlexible: false,
    source: 'google',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {} as jest.Mocked<Pool>;
    syncService = new CalendarSyncService(mockDb);

    // Get mocked instances
    mockGoogleService = jest.mocked(GoogleCalendarService.prototype);
    mockMicrosoftService = jest.mocked(MicrosoftGraphService.prototype);
    mockEventRepository = jest.mocked(CalendarEventRepository.prototype);
    mockConnectionRepository = jest.mocked(CalendarConnectionRepository.prototype);
  });

  describe('syncUserCalendars', () => {
    it('should sync all user calendars successfully', async () => {
      // Arrange
      const connections = [mockConnection];
      const expectedResult: SyncResult = {
        success: true,
        eventsAdded: 1,
        eventsUpdated: 0,
        eventsDeleted: 0,
        errors: []
      };

      mockConnectionRepository.findByUserId.mockResolvedValue(connections);
      mockGoogleService.syncEvents.mockResolvedValue({
        events: [mockCalendarEvent],
        nextSyncToken: 'next-token'
      });
      mockEventRepository.findBySource.mockResolvedValue([]);
      mockEventRepository.create.mockResolvedValue(mockCalendarEvent);

      // Act
      const result = await syncService.syncUserCalendars(mockUserId);

      // Assert
      expect(result.success).toBe(true);
      expect(result.eventsAdded).toBe(1);
      expect(mockConnectionRepository.findByUserId).toHaveBeenCalledWith(mockUserId);
      expect(mockGoogleService.syncEvents).toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      // Arrange
      const connections = [mockConnection];
      mockConnectionRepository.findByUserId.mockResolvedValue(connections);
      mockGoogleService.syncEvents.mockRejectedValue(new Error('API Error'));

      // Act
      const result = await syncService.syncUserCalendars(mockUserId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('API Error');
    });

    it('should perform full sync when requested', async () => {
      // Arrange
      const connections = [mockConnection];
      const options: SyncOptions = { fullSync: true };

      mockConnectionRepository.findByUserId.mockResolvedValue(connections);
      mockGoogleService.syncEvents.mockResolvedValue({
        events: [],
        nextSyncToken: 'token'
      });
      mockEventRepository.findBySource.mockResolvedValue([]);

      // Act
      await syncService.syncUserCalendars(mockUserId, options);

      // Assert
      expect(mockGoogleService.syncEvents).toHaveBeenCalledWith(
        mockConnection,
        'primary',
        undefined // No sync token for full sync
      );
    });
  });

  describe('syncCalendar', () => {
    it('should sync Google calendar successfully', async () => {
      // Arrange
      const externalEvents = [mockCalendarEvent];
      const localEvents: CalendarEvent[] = [];

      mockGoogleService.syncEvents.mockResolvedValue({
        events: externalEvents,
        nextSyncToken: 'next-token'
      });
      mockEventRepository.findBySource.mockResolvedValue(localEvents);
      mockEventRepository.create.mockResolvedValue(mockCalendarEvent);

      // Act
      const result = await syncService.syncCalendar(mockConnection);

      // Assert
      expect(result.success).toBe(true);
      expect(result.eventsAdded).toBe(1);
      expect(mockEventRepository.create).toHaveBeenCalledWith(mockUserId, {
        ...mockCalendarEvent,
        source: 'google'
      });
    });

    it('should sync Microsoft calendar successfully', async () => {
      // Arrange
      const microsoftConnection = { ...mockConnection, provider: 'microsoft' as const };
      const externalEvents = [{ ...mockCalendarEvent, source: 'microsoft' as const }];

      mockMicrosoftService.syncEvents.mockResolvedValue({
        events: externalEvents,
        nextDeltaToken: 'delta-token'
      });
      mockEventRepository.findBySource.mockResolvedValue([]);
      mockEventRepository.create.mockResolvedValue(externalEvents[0]);

      // Act
      const result = await syncService.syncCalendar(microsoftConnection);

      // Assert
      expect(result.success).toBe(true);
      expect(result.eventsAdded).toBe(1);
      expect(mockMicrosoftService.syncEvents).toHaveBeenCalled();
    });

    it('should update existing events when they have changed', async () => {
      // Arrange
      const updatedEvent = {
        ...mockCalendarEvent,
        title: 'Updated Title',
        updatedAt: new Date(Date.now() + 1000)
      };
      const localEvents = [mockCalendarEvent];

      mockGoogleService.syncEvents.mockResolvedValue({
        events: [updatedEvent],
        nextSyncToken: 'token'
      });
      mockEventRepository.findBySource.mockResolvedValue(localEvents);
      mockEventRepository.update.mockResolvedValue(updatedEvent);

      // Act
      const result = await syncService.syncCalendar(mockConnection);

      // Assert
      expect(result.success).toBe(true);
      expect(result.eventsUpdated).toBe(1);
      expect(mockEventRepository.update).toHaveBeenCalledWith(mockCalendarEvent.id, {
        title: 'Updated Title',
        description: updatedEvent.description,
        startTime: updatedEvent.startTime,
        endTime: updatedEvent.endTime
      });
    });

    it('should delete local events that no longer exist externally', async () => {
      // Arrange
      const localEvents = [mockCalendarEvent];
      const externalEvents: CalendarEvent[] = []; // Event deleted externally

      mockGoogleService.syncEvents.mockResolvedValue({
        events: externalEvents,
        nextSyncToken: 'token'
      });
      mockEventRepository.findBySource.mockResolvedValue(localEvents);
      mockEventRepository.delete.mockResolvedValue();

      // Act
      const result = await syncService.syncCalendar(mockConnection);

      // Assert
      expect(result.success).toBe(true);
      expect(result.eventsDeleted).toBe(1);
      expect(mockEventRepository.delete).toHaveBeenCalledWith(mockCalendarEvent.id);
    });

    it('should handle unsupported provider', async () => {
      // Arrange
      const invalidConnection = { ...mockConnection, provider: 'invalid' as any };

      // Act & Assert
      await expect(syncService.syncCalendar(invalidConnection))
        .rejects.toThrow('Unsupported calendar provider: invalid');
    });
  });

  describe('detectConflicts', () => {
    it('should detect time overlap conflicts', async () => {
      // Arrange
      const event1: CalendarEvent = {
        ...mockCalendarEvent,
        id: 'event-1',
        title: 'Event 1',
        isFlexible: false
      };
      const event2: CalendarEvent = {
        ...mockCalendarEvent,
        id: 'event-2',
        title: 'Event 2',
        isFlexible: false
      };

      mockEventRepository.findBySource.mockResolvedValue([event1]);
      mockEventRepository.findConflictingEvents.mockResolvedValue([event2]);

      // Act
      const conflicts = await syncService.detectConflicts(mockUserId, 'google');

      // Assert
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('time_overlap');
      expect(conflicts[0].description).toContain('Time overlap');
      expect(conflicts[0].resolution).toBe('manual_review');
    });

    it('should not report conflicts for flexible events', async () => {
      // Arrange
      const flexibleEvent: CalendarEvent = {
        ...mockCalendarEvent,
        isFlexible: true
      };
      const firmEvent: CalendarEvent = {
        ...mockCalendarEvent,
        id: 'event-2',
        isFlexible: false
      };

      mockEventRepository.findBySource.mockResolvedValue([flexibleEvent]);
      mockEventRepository.findConflictingEvents.mockResolvedValue([firmEvent]);

      // Act
      const conflicts = await syncService.detectConflicts(mockUserId, 'google');

      // Assert
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('pushLocalChanges', () => {
    it('should push local events to Google Calendar', async () => {
      // Arrange
      const localEvent: CalendarEvent = {
        ...mockCalendarEvent,
        source: 'momentum',
        externalId: undefined
      };

      mockConnectionRepository.findByUserAndProvider.mockResolvedValue(mockConnection);
      mockEventRepository.findBySource.mockResolvedValue([localEvent]);
      mockGoogleService.createEvent.mockResolvedValue('google-event-456');
      mockEventRepository.update.mockResolvedValue(localEvent);

      // Act
      const result = await syncService.pushLocalChanges(mockUserId, 'google');

      // Assert
      expect(result.success).toBe(true);
      expect(result.eventsAdded).toBe(1);
      expect(mockGoogleService.createEvent).toHaveBeenCalledWith(mockConnection, {
        title: localEvent.title,
        description: localEvent.description,
        startTime: localEvent.startTime,
        endTime: localEvent.endTime
      });
    });

    it('should throw error when no connection found', async () => {
      // Arrange
      mockConnectionRepository.findByUserAndProvider.mockResolvedValue(null);

      // Act & Assert
      await expect(syncService.pushLocalChanges(mockUserId, 'google'))
        .rejects.toThrow('No google calendar connection found for user');
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync status for a key', () => {
      // Arrange
      const key = `${mockUserId}-google`;
      
      // Act
      const status = syncService.getSyncStatus(key);

      // Assert
      expect(status).toBeUndefined(); // Initially no status
    });
  });
});

describe('CalendarWebhookService', () => {
  let webhookService: CalendarWebhookService;
  let mockDb: jest.Mocked<Pool>;
  let mockSyncService: jest.Mocked<CalendarSyncService>;
  let mockConnectionRepository: jest.Mocked<CalendarConnectionRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {} as jest.Mocked<Pool>;
    webhookService = new CalendarWebhookService(mockDb);

    // Mock the sync service
    mockSyncService = {
      syncCalendar: jest.fn()
    } as any;
    (webhookService as any).syncService = mockSyncService;

    mockConnectionRepository = jest.mocked(CalendarConnectionRepository.prototype);
    (webhookService as any).connectionRepository = mockConnectionRepository;
  });

  describe('handleGoogleWebhook', () => {
    it('should handle valid Google webhook', async () => {
      // Arrange
      const payload = {
        provider: 'google' as const,
        'x-goog-channel-id': 'channel-123',
        'x-goog-channel-token': mockUserId,
        'x-goog-resource-id': 'resource-123',
        'x-goog-resource-uri': 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        'x-goog-resource-state': 'exists' as const,
        'x-goog-message-number': '1'
      };

      mockConnectionRepository.findByUserAndProvider.mockResolvedValue(mockConnection);
      mockSyncService.syncCalendar.mockResolvedValue({
        success: true,
        eventsAdded: 0,
        eventsUpdated: 1,
        eventsDeleted: 0,
        errors: []
      });

      // Act
      await webhookService.handleGoogleWebhook(payload);

      // Assert
      expect(mockConnectionRepository.findByUserAndProvider).toHaveBeenCalledWith(mockUserId, 'google');
      expect(mockSyncService.syncCalendar).toHaveBeenCalledWith(mockConnection, { resolveConflicts: true });
    });

    it('should skip sync notifications', async () => {
      // Arrange
      const payload = {
        provider: 'google' as const,
        'x-goog-channel-id': 'channel-123',
        'x-goog-channel-token': mockUserId,
        'x-goog-resource-id': 'resource-123',
        'x-goog-resource-uri': 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        'x-goog-resource-state': 'sync' as const,
        'x-goog-message-number': '1'
      };

      mockConnectionRepository.findByUserAndProvider.mockResolvedValue(mockConnection);

      // Act
      await webhookService.handleGoogleWebhook(payload);

      // Assert
      expect(mockSyncService.syncCalendar).not.toHaveBeenCalled();
    });

    it('should handle missing connection gracefully', async () => {
      // Arrange
      const payload = {
        provider: 'google' as const,
        'x-goog-channel-id': 'channel-123',
        'x-goog-channel-token': mockUserId,
        'x-goog-resource-id': 'resource-123',
        'x-goog-resource-uri': 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        'x-goog-resource-state': 'exists' as const,
        'x-goog-message-number': '1'
      };

      mockConnectionRepository.findByUserAndProvider.mockResolvedValue(null);

      // Act
      await webhookService.handleGoogleWebhook(payload);

      // Assert
      expect(mockSyncService.syncCalendar).not.toHaveBeenCalled();
    });

    it('should throw error for invalid webhook', async () => {
      // Arrange
      const invalidPayload = {
        provider: 'google' as const,
        'x-goog-channel-id': 'channel-123'
        // Missing required headers
      } as any;

      // Act & Assert
      await expect(webhookService.handleGoogleWebhook(invalidPayload))
        .rejects.toThrow('Invalid Google webhook payload');
    });
  });

  describe('handleMicrosoftWebhook', () => {
    it('should handle valid Microsoft webhook', async () => {
      // Arrange
      const payload = {
        provider: 'microsoft' as const,
        subscriptionId: 'sub-123',
        clientState: mockUserId,
        resource: '/me/calendar/events',
        resourceData: {
          '@odata.type': '#Microsoft.Graph.Event',
          '@odata.id': '/me/calendar/events/event-123',
          id: 'event-123'
        },
        subscriptionExpirationDateTime: new Date(Date.now() + 86400000).toISOString(),
        tenantId: 'tenant-123',
        changeType: 'updated' as const
      };

      const microsoftConnection = { ...mockConnection, provider: 'microsoft' as const };
      mockConnectionRepository.findByUserAndProvider.mockResolvedValue(microsoftConnection);
      mockSyncService.syncCalendar.mockResolvedValue({
        success: true,
        eventsAdded: 0,
        eventsUpdated: 1,
        eventsDeleted: 0,
        errors: []
      });

      // Act
      await webhookService.handleMicrosoftWebhook(payload);

      // Assert
      expect(mockConnectionRepository.findByUserAndProvider).toHaveBeenCalledWith(mockUserId, 'microsoft');
      expect(mockSyncService.syncCalendar).toHaveBeenCalledWith(microsoftConnection, { resolveConflicts: true });
    });

    it('should throw error for invalid webhook', async () => {
      // Arrange
      const invalidPayload = {
        provider: 'microsoft' as const,
        subscriptionId: 'sub-123'
        // Missing required fields
      } as any;

      // Act & Assert
      await expect(webhookService.handleMicrosoftWebhook(invalidPayload))
        .rejects.toThrow('Invalid Microsoft webhook payload');
    });
  });

  describe('handleWebhookValidation', () => {
    it('should return validation token', () => {
      // Arrange
      const validationToken = 'validation-token-123';

      // Act
      const result = webhookService.handleWebhookValidation(validationToken);

      // Assert
      expect(result).toBe(validationToken);
    });
  });
});