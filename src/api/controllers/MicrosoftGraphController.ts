import { Request, Response } from 'express';
import { MicrosoftGraphService } from '@/services/MicrosoftGraphService';
import { CalendarConnectionRepository } from '@/repositories/CalendarConnectionRepository';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import { db } from '@/config/database';
import { encrypt } from '@/utils/encryption';
import { config } from '@/config/environment';
import { AuthenticatedRequest } from '@/api/middleware/auth';

export class MicrosoftGraphController {
  private microsoftGraphService: MicrosoftGraphService;
  private connectionRepository: CalendarConnectionRepository;
  private eventRepository: CalendarEventRepository;

  constructor() {
    this.microsoftGraphService = new MicrosoftGraphService();
    this.connectionRepository = new CalendarConnectionRepository(db);
    this.eventRepository = new CalendarEventRepository(db);
  }

  /**
   * Get Microsoft Graph OAuth authorization URL
   */
  getAuthUrl = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const authUrl = await this.microsoftGraphService.getAuthUrl();
      
      res.json({
        success: true,
        data: {
          authUrl,
          provider: 'microsoft'
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
      const credentials = await this.microsoftGraphService.exchangeCodeForTokens(code);
      
      // Get user profile to store account email
      const tempConnection = {
        userId,
        provider: 'microsoft' as const,
        accountEmail: '', // Will be updated below
        accessToken: encrypt(credentials.accessToken),
        refreshToken: encrypt(credentials.refreshToken),
        expiresAt: new Date(credentials.expiryDate || Date.now() + 3600000),
        isActive: true
      };

      // Create temporary connection to get user profile
      const profile = await this.microsoftGraphService.getUserProfile({
        ...tempConnection,
        id: 'temp',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Check if connection already exists for this user and email
      const existingConnection = await this.connectionRepository.findByUserAndProvider(userId, 'microsoft');
      
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
        await this.microsoftGraphService.subscribeToChanges(connection, config.microsoft.webhookUrl);
      } catch (webhookError) {
        console.warn('Failed to set up webhook subscription:', webhookError);
        // Don't fail the connection if webhook setup fails
      }

      res.json({
        success: true,
        data: {
          connectionId: connection.id,
          accountEmail: profile.email,
          provider: 'microsoft'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to connect Microsoft Calendar',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get user's Microsoft Calendar connections
   */
  getConnections = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const connections = await this.connectionRepository.findByUserId(userId);
      const microsoftConnections = connections.filter(conn => conn.provider === 'microsoft');

      res.json({
        success: true,
        data: microsoftConnections.map(conn => ({
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
        error: 'Failed to fetch Microsoft Calendar connections',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Sync Microsoft Calendar events
   */
  syncEvents = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { connectionId } = req.params;

      if (!connectionId) {
        res.status(400).json({
          success: false,
          error: 'Connection ID is required'
        });
        return;
      }

      const result = await this.syncCalendar(userId, connectionId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to sync Microsoft Calendar events',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Create event in Microsoft Calendar
   */
  createEvent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { connectionId } = req.params;
      const eventData = req.body;

      if (!connectionId) {
        res.status(400).json({
          success: false,
          error: 'Connection ID is required'
        });
        return;
      }

      // Validate required fields
      if (!eventData.title || !eventData.startTime || !eventData.endTime) {
        res.status(400).json({
          success: false,
          error: 'Title, startTime, and endTime are required'
        });
        return;
      }

      // Get connection
      const connection = await this.connectionRepository.findByUserAndProvider(userId, 'microsoft');
      if (!connection || connection.id !== connectionId) {
        res.status(404).json({
          success: false,
          error: 'Microsoft Calendar connection not found'
        });
        return;
      }

      // Create event in Microsoft Calendar
      const externalId = await this.microsoftGraphService.createEvent(connection, {
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
        source: 'microsoft' as const
      });

      res.json({
        success: true,
        data: localEvent
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to create Microsoft Calendar event',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Update event in Microsoft Calendar
   */
  updateEvent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { connectionId, eventId } = req.params;
      const updates = req.body;

      if (!connectionId || !eventId) {
        res.status(400).json({
          success: false,
          error: 'Connection ID and Event ID are required'
        });
        return;
      }

      // Get connection
      const connection = await this.connectionRepository.findByUserAndProvider(userId, 'microsoft');
      if (!connection || connection.id !== connectionId) {
        res.status(404).json({
          success: false,
          error: 'Microsoft Calendar connection not found'
        });
        return;
      }

      // Get local event
      const localEvent = await this.eventRepository.findById(eventId);
      if (!localEvent || localEvent.userId !== userId || localEvent.source !== 'microsoft') {
        res.status(404).json({
          success: false,
          error: 'Event not found'
        });
        return;
      }

      // Update event in Microsoft Calendar
      if (localEvent.externalId) {
        const updateData = {
          ...updates,
          startTime: updates.startTime ? new Date(updates.startTime) : undefined,
          endTime: updates.endTime ? new Date(updates.endTime) : undefined
        };

        await this.microsoftGraphService.updateEvent(connection, localEvent.externalId, updateData);
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
        error: 'Failed to update Microsoft Calendar event',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Delete event from Microsoft Calendar
   */
  deleteEvent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { connectionId, eventId } = req.params;

      if (!connectionId || !eventId) {
        res.status(400).json({
          success: false,
          error: 'Connection ID and Event ID are required'
        });
        return;
      }

      // Get connection
      const connection = await this.connectionRepository.findByUserAndProvider(userId, 'microsoft');
      if (!connection || connection.id !== connectionId) {
        res.status(404).json({
          success: false,
          error: 'Microsoft Calendar connection not found'
        });
        return;
      }

      // Get local event
      const localEvent = await this.eventRepository.findById(eventId);
      if (!localEvent || localEvent.userId !== userId || localEvent.source !== 'microsoft') {
        res.status(404).json({
          success: false,
          error: 'Event not found'
        });
        return;
      }

      // Delete from Microsoft Calendar
      if (localEvent.externalId) {
        await this.microsoftGraphService.deleteEvent(connection, localEvent.externalId);
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
        error: 'Failed to delete Microsoft Calendar event',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Disconnect Microsoft Calendar
   */
  disconnect = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { connectionId } = req.params;

      if (!connectionId) {
        res.status(400).json({
          success: false,
          error: 'Connection ID is required'
        });
        return;
      }

      // Get connection
      const connection = await this.connectionRepository.findByUserAndProvider(userId, 'microsoft');
      if (!connection || connection.id !== connectionId) {
        res.status(404).json({
          success: false,
          error: 'Microsoft Calendar connection not found'
        });
        return;
      }

      // Deactivate connection
      await this.connectionRepository.deactivate(connectionId);

      res.json({
        success: true,
        message: 'Microsoft Calendar disconnected successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to disconnect Microsoft Calendar',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Handle webhook notifications from Microsoft Graph
   */
  handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const validationToken = req.query.validationToken as string;
      
      // Handle subscription validation
      if (validationToken) {
        res.status(200).send(validationToken);
        return;
      }

      // Process webhook notifications
      const notifications = req.body.value || [];
      
      for (const notification of notifications) {
        const clientState = notification.clientState;
        const changeType = notification.changeType;
        
        if (!clientState) {
          continue;
        }

        // clientState contains the userId
        const userId = clientState;
        const connection = await this.connectionRepository.findByUserAndProvider(userId, 'microsoft');
        
        if (connection && (changeType === 'created' || changeType === 'updated' || changeType === 'deleted')) {
          // Trigger async sync (don't wait for completion)
          this.syncCalendar(userId, connection.id).catch(error => {
            console.error('Webhook sync failed:', error);
          });
        }
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
    const connection = await this.connectionRepository.findByUserAndProvider(userId, 'microsoft');
    if (!connection || connection.id !== connectionId) {
      throw new Error('Connection not found');
    }

    // Sync events from Microsoft Calendar
    const { events } = await this.microsoftGraphService.syncEvents(connection);

    let eventsAdded = 0;
    let eventsUpdated = 0;

    // Process each event
    for (const event of events) {
      if (!event.externalId) continue;

      const existingEvent = await this.eventRepository.findByExternalId(
        event.externalId,
        'microsoft',
        userId
      );

      if (existingEvent) {
        // Update existing event
        await this.eventRepository.update(existingEvent.id, {
          title: event.title,
          description: event.description || undefined,
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
          description: event.description || undefined,
          startTime: event.startTime,
          endTime: event.endTime,
          isFlexible: event.isFlexible,
          travelTimeBefore: event.travelTimeBefore,
          travelTimeAfter: event.travelTimeAfter,
          externalId: event.externalId,
          source: 'microsoft'
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