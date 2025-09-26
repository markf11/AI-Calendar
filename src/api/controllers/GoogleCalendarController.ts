import { Request, Response } from 'express';
import { GoogleCalendarService } from '@/services/GoogleCalendarService';
import { CalendarConnectionRepository } from '@/repositories/CalendarConnectionRepository';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import { db } from '@/config/database';
import { encrypt } from '@/utils/encryption';
import { config } from '@/config/environment';
import { AuthenticatedRequest } from '@/api/middleware/auth';

export class GoogleCalendarController {
  private googleCalendarService: GoogleCalendarService;
  private connectionRepository: CalendarConnectionRepository;
  private eventRepository: CalendarEventRepository;

  constructor() {
    this.googleCalendarService = new GoogleCalendarService();
    this.connectionRepository = new CalendarConnectionRepository(db);
    this.eventRepository = new CalendarEventRepository(db);
  }

  /**
   * Get Google Calendar OAuth authorization URL
   */
  getAuthUrl = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const authUrl = this.googleCalendarService.getAuthUrl();
      
      res.json({
        success: true,
        data: {
          authUrl,
          provider: 'google'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate authorization URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  handleCallback = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { code } = req.body;
      const userId = req.user!.id;

      if (!code) {
        res.status(400).json({
          success: false,
          error: 'Authorization code is required'
        });
        return;
      }

      // Exchange code for tokens
      const credentials = await this.googleCalendarService.exchangeCodeForTokens(code);
      
      // Get user profile to store account email
      const tempConnection = {
        userId,
        provider: 'google' as const,
        accountEmail: '', // Will be updated below
        accessToken: encrypt(credentials.accessToken),
        refreshToken: encrypt(credentials.refreshToken),
        expiresAt: new Date(credentials.expiryDate || Date.now() + 3600000),
        isActive: true
      };

      // Create temporary connection to get user profile
      const profile = await this.googleCalendarService.getUserProfile({
        ...tempConnection,
        id: 'temp',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Check if connection already exists for this user and email
      const existingConnection = await this.connectionRepository.findByUserAndProvider(userId, 'google');
      
      let connection;
      if (existingConnection && existingConnection.accountEmail === profile.email) {
        // Update existing connection
        connection = await this.connectionRepository.updateTokens(
          existingConnection.id,
          encrypt(credentials.accessToken),
          encrypt(credentials.refreshToken),
          new Date(credentials.expiryDate || Date.now() + 3600000)
        );
      } else {
        // Create new connection
        connection = await this.connectionRepository.create({
          ...tempConnection,
          accountEmail: profile.email
        });
      }

      // Trigger initial sync
      await this.syncCalendar(userId, connection.id);

      // Set up webhook subscription for real-time updates
      try {
        await this.googleCalendarService.subscribeToChanges(connection, config.google.webhookUrl);
      } catch (webhookError) {
        console.warn('Failed to set up webhook subscription:', webhookError);
        // Don't fail the connection if webhook setup fails
      }

      res.json({
        success: true,
        data: {
          connectionId: connection.id,
          accountEmail: profile.email,
          provider: 'google'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to connect Google Calendar',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get user's Google Calendar connections
   */
  getConnections = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const connections = await this.connectionRepository.findByUserId(userId);
      const googleConnections = connections.filter(conn => conn.provider === 'google');

      res.json({
        success: true,
        data: googleConnections.map(conn => ({
          id: conn.id,
          accountEmail: conn.accountEmail,
          provider: conn.provider,
          isActive: conn.isActive,
          createdAt: conn.createdAt
        }))
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch Google Calendar connections',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Sync Google Calendar events
   */
  syncEvents = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { connectionId } = req.params;

      const result = await this.syncCalendar(userId, connectionId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to sync Google Calendar events',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Create event in Google Calendar
   */
  createEvent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { connectionId } = req.params;
      const eventData = req.body;

      // Validate required fields
      if (!eventData.title || !eventData.startTime || !eventData.endTime) {
        res.status(400).json({
          success: false,
          error: 'Title, startTime, and endTime are required'
        });
        return;
      }

      // Get connection
      const connection = await this.connectionRepository.findByUserAndProvider(userId, 'google');
      if (!connection || connection.id !== connectionId) {
        res.status(404).json({
          success: false,
          error: 'Google Calendar connection not found'
        });
        return;
      }

      // Create event in Google Calendar
      const externalId = await this.googleCalendarService.createEvent(connection, {
        title: eventData.title,
        description: eventData.description,
        startTime: new Date(eventData.startTime),
        endTime: new Date(eventData.endTime),
        isFlexible: eventData.isFlexible,
        travelTimeBefore: eventData.travelTimeBefore,
        travelTimeAfter: eventData.travelTimeAfter
      });

      // Create event in local database
      const localEvent = await this.eventRepository.create(userId, {
        ...eventData,
        startTime: new Date(eventData.startTime),
        endTime: new Date(eventData.endTime),
        externalId,
        source: 'google' as const
      });

      res.json({
        success: true,
        data: localEvent
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to create Google Calendar event',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Update event in Google Calendar
   */
  updateEvent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { connectionId, eventId } = req.params;
      const updates = req.body;

      // Get connection
      const connection = await this.connectionRepository.findByUserAndProvider(userId, 'google');
      if (!connection || connection.id !== connectionId) {
        res.status(404).json({
          success: false,
          error: 'Google Calendar connection not found'
        });
        return;
      }

      // Get local event
      const localEvent = await this.eventRepository.findById(eventId);
      if (!localEvent || localEvent.userId !== userId || localEvent.source !== 'google') {
        res.status(404).json({
          success: false,
          error: 'Event not found'
        });
        return;
      }

      // Update event in Google Calendar
      if (localEvent.externalId) {
        const updateData = {
          ...updates,
          startTime: updates.startTime ? new Date(updates.startTime) : undefined,
          endTime: updates.endTime ? new Date(updates.endTime) : undefined
        };

        await this.googleCalendarService.updateEvent(connection, localEvent.externalId, updateData);
      }

      // Update local event
      const updatedEvent = await this.eventRepository.update(eventId, {
        ...updates,
        startTime: updates.startTime ? new Date(updates.startTime) : undefined,
        endTime: updates.endTime ? new Date(updates.endTime) : undefined
      });

      res.json({
        success: true,
        data: updatedEvent
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update Google Calendar event',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Delete event from Google Calendar
   */
  deleteEvent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { connectionId, eventId } = req.params;

      // Get connection
      const connection = await this.connectionRepository.findByUserAndProvider(userId, 'google');
      if (!connection || connection.id !== connectionId) {
        res.status(404).json({
          success: false,
          error: 'Google Calendar connection not found'
        });
        return;
      }

      // Get local event
      const localEvent = await this.eventRepository.findById(eventId);
      if (!localEvent || localEvent.userId !== userId || localEvent.source !== 'google') {
        res.status(404).json({
          success: false,
          error: 'Event not found'
        });
        return;
      }

      // Delete from Google Calendar
      if (localEvent.externalId) {
        await this.googleCalendarService.deleteEvent(connection, localEvent.externalId);
      }

      // Delete from local database
      await this.eventRepository.delete(eventId);

      res.json({
        success: true,
        message: 'Event deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to delete Google Calendar event',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Disconnect Google Calendar
   */
  disconnect = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { connectionId } = req.params;

      // Get connection
      const connection = await this.connectionRepository.findByUserAndProvider(userId, 'google');
      if (!connection || connection.id !== connectionId) {
        res.status(404).json({
          success: false,
          error: 'Google Calendar connection not found'
        });
        return;
      }

      // Deactivate connection
      await this.connectionRepository.deactivate(connectionId);

      res.json({
        success: true,
        message: 'Google Calendar disconnected successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to disconnect Google Calendar',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Handle webhook notifications from Google Calendar
   */
  handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const channelId = req.headers['x-goog-channel-id'] as string;
      const channelToken = req.headers['x-goog-channel-token'] as string;
      const resourceState = req.headers['x-goog-resource-state'] as string;

      // Verify webhook authenticity using the token (userId)
      if (!channelToken) {
        res.status(401).json({
          success: false,
          error: 'Invalid webhook token'
        });
        return;
      }

      // Only process sync events (not exists events)
      if (resourceState === 'sync') {
        res.status(200).json({ success: true });
        return;
      }

      // Trigger sync for the user
      const userId = channelToken;
      const connection = await this.connectionRepository.findByUserAndProvider(userId, 'google');
      
      if (connection) {
        // Trigger async sync (don't wait for completion)
        this.syncCalendar(userId, connection.id).catch(error => {
          console.error('Webhook sync failed:', error);
        });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Webhook processing failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process webhook'
      });
    }
  };

  /**
   * Internal method to sync calendar events
   */
  private async syncCalendar(userId: string, connectionId: string) {
    const connection = await this.connectionRepository.findByUserAndProvider(userId, 'google');
    if (!connection || connection.id !== connectionId) {
      throw new Error('Connection not found');
    }

    // Sync events from Google Calendar
    const { events } = await this.googleCalendarService.syncEvents(connection);

    let eventsAdded = 0;
    let eventsUpdated = 0;

    // Process each event
    for (const event of events) {
      if (!event.externalId) continue;

      const existingEvent = await this.eventRepository.findByExternalId(
        event.externalId,
        'google',
        userId
      );

      if (existingEvent) {
        // Update existing event
        await this.eventRepository.update(existingEvent.id, {
          title: event.title,
          description: event.description,
          startTime: event.startTime,
          endTime: event.endTime,
          isFlexible: event.isFlexible,
          travelTimeBefore: event.travelTimeBefore,
          travelTimeAfter: event.travelTimeAfter
        });
        eventsUpdated++;
      } else {
        // Create new event
        await this.eventRepository.create(userId, {
          title: event.title,
          description: event.description,
          startTime: event.startTime,
          endTime: event.endTime,
          isFlexible: event.isFlexible,
          travelTimeBefore: event.travelTimeBefore,
          travelTimeAfter: event.travelTimeAfter,
          externalId: event.externalId,
          source: 'google'
        });
        eventsAdded++;
      }
    }

    return {
      success: true,
      eventsAdded,
      eventsUpdated,
      eventsDeleted: 0, // TODO: Implement deletion detection
      errors: []
    };
  }
}