import { CalendarSyncService } from './CalendarSyncService';
import { CalendarConnectionRepository } from '@/repositories/CalendarConnectionRepository';
import { Pool } from 'pg';

export interface WebhookPayload {
  provider: 'google' | 'microsoft';
  userId?: string;
  calendarId?: string;
  eventId?: string;
  changeType?: 'created' | 'updated' | 'deleted';
  resourceId?: string;
  channelId?: string;
  token?: string;
  expiration?: string;
}

export interface GoogleWebhookPayload extends WebhookPayload {
  provider: 'google';
  'x-goog-channel-id': string;
  'x-goog-channel-token': string;
  'x-goog-resource-id': string;
  'x-goog-resource-uri': string;
  'x-goog-resource-state': 'exists' | 'not_exists' | 'sync';
  'x-goog-message-number': string;
}

export interface MicrosoftWebhookPayload extends WebhookPayload {
  provider: 'microsoft';
  subscriptionId: string;
  clientState: string;
  resource: string;
  resourceData: {
    '@odata.type': string;
    '@odata.id': string;
    id: string;
  };
  subscriptionExpirationDateTime: string;
  tenantId: string;
}

export class CalendarWebhookService {
  private syncService: CalendarSyncService;
  private connectionRepository: CalendarConnectionRepository;

  constructor(db: Pool) {
    this.syncService = new CalendarSyncService(db);
    this.connectionRepository = new CalendarConnectionRepository(db);
  }

  /**
   * Handle Google Calendar webhook notification
   */
  async handleGoogleWebhook(payload: GoogleWebhookPayload): Promise<void> {
    try {
      // Verify webhook authenticity
      if (!this.verifyGoogleWebhook(payload)) {
        throw new Error('Invalid Google webhook payload');
      }

      // Extract user ID from token
      const userId = payload['x-goog-channel-token'];
      if (!userId) {
        throw new Error('Missing user ID in Google webhook');
      }

      // Get user's Google calendar connection
      const connection = await this.connectionRepository.findByUserAndProvider(userId, 'google');
      if (!connection) {
        console.warn(`No Google calendar connection found for user ${userId}`);
        return;
      }

      // Skip sync notifications (these are sent when we start watching)
      if (payload['x-goog-resource-state'] === 'sync') {
        return;
      }

      // Trigger calendar sync
      await this.syncService.syncCalendar(connection, { resolveConflicts: true });

      console.log(`Successfully processed Google webhook for user ${userId}`);
    } catch (error) {
      console.error('Failed to handle Google webhook:', error);
      throw error;
    }
  }

  /**
   * Handle Microsoft Graph webhook notification
   */
  async handleMicrosoftWebhook(payload: MicrosoftWebhookPayload): Promise<void> {
    try {
      // Verify webhook authenticity
      if (!this.verifyMicrosoftWebhook(payload)) {
        throw new Error('Invalid Microsoft webhook payload');
      }

      // Extract user ID from client state
      const userId = payload.clientState;
      if (!userId) {
        throw new Error('Missing user ID in Microsoft webhook');
      }

      // Get user's Microsoft calendar connection
      const connection = await this.connectionRepository.findByUserAndProvider(userId, 'microsoft');
      if (!connection) {
        console.warn(`No Microsoft calendar connection found for user ${userId}`);
        return;
      }

      // Trigger calendar sync
      await this.syncService.syncCalendar(connection, { resolveConflicts: true });

      console.log(`Successfully processed Microsoft webhook for user ${userId}`);
    } catch (error) {
      console.error('Failed to handle Microsoft webhook:', error);
      throw error;
    }
  }

  /**
   * Verify Google webhook payload
   */
  private verifyGoogleWebhook(payload: GoogleWebhookPayload): boolean {
    // Check required headers
    const requiredHeaders = [
      'x-goog-channel-id',
      'x-goog-channel-token',
      'x-goog-resource-id',
      'x-goog-resource-uri',
      'x-goog-resource-state'
    ];

    for (const header of requiredHeaders) {
      if (!payload[header as keyof GoogleWebhookPayload]) {
        console.error(`Missing required Google webhook header: ${header}`);
        return false;
      }
    }

    // Additional verification could include:
    // - Checking if the channel ID exists in our database
    // - Verifying the resource URI matches expected pattern
    // - Checking expiration time

    return true;
  }

  /**
   * Verify Microsoft webhook payload
   */
  private verifyMicrosoftWebhook(payload: MicrosoftWebhookPayload): boolean {
    // Check required fields
    if (!payload.subscriptionId || !payload.clientState || !payload.resource) {
      console.error('Missing required Microsoft webhook fields');
      return false;
    }

    // Additional verification could include:
    // - Checking if the subscription ID exists in our database
    // - Verifying the client state matches expected user ID format
    // - Checking subscription expiration

    return true;
  }

  /**
   * Handle webhook validation (for Microsoft Graph)
   */
  handleWebhookValidation(validationToken: string): string {
    // Microsoft Graph sends a validation token that we need to return
    // to confirm we can receive webhooks
    return validationToken;
  }

  /**
   * Setup webhook subscriptions for a user
   */
  async setupWebhookSubscriptions(userId: string, webhookBaseUrl: string): Promise<void> {
    const connections = await this.connectionRepository.findByUserId(userId);

    for (const connection of connections) {
      try {
        if (connection.provider === 'google') {
          await this.setupGoogleWebhook(connection, webhookBaseUrl);
        } else if (connection.provider === 'microsoft') {
          await this.setupMicrosoftWebhook(connection, webhookBaseUrl);
        }
      } catch (error) {
        console.error(`Failed to setup webhook for ${connection.provider} calendar:`, error);
      }
    }
  }

  /**
   * Setup Google Calendar webhook
   */
  private async setupGoogleWebhook(connection: any, webhookBaseUrl: string): Promise<void> {
    const webhookUrl = `${webhookBaseUrl}/webhooks/google`;
    
    // Note: This would typically be called from the GoogleCalendarService
    // but we're showing the integration here
    console.log(`Setting up Google webhook for user ${connection.userId} at ${webhookUrl}`);
  }

  /**
   * Setup Microsoft Graph webhook
   */
  private async setupMicrosoftWebhook(connection: any, webhookBaseUrl: string): Promise<void> {
    const webhookUrl = `${webhookBaseUrl}/webhooks/microsoft`;
    
    // Note: This would typically be called from the MicrosoftGraphService
    // but we're showing the integration here
    console.log(`Setting up Microsoft webhook for user ${connection.userId} at ${webhookUrl}`);
  }

  /**
   * Cleanup expired webhook subscriptions
   */
  async cleanupExpiredWebhooks(): Promise<void> {
    // This would typically run as a scheduled job to clean up
    // expired webhook subscriptions and renew them as needed
    console.log('Cleaning up expired webhook subscriptions...');
    
    // Implementation would:
    // 1. Query database for webhook subscriptions
    // 2. Check expiration dates
    // 3. Renew or remove expired subscriptions
    // 4. Update database with new subscription details
  }

  /**
   * Handle webhook errors and retry logic
   */
  async handleWebhookError(error: Error, payload: WebhookPayload): Promise<void> {
    console.error('Webhook processing error:', {
      error: error.message,
      provider: payload.provider,
      userId: payload.userId,
      timestamp: new Date().toISOString()
    });

    // Could implement retry logic here:
    // 1. Store failed webhook in queue
    // 2. Retry with exponential backoff
    // 3. Alert administrators after max retries
  }
}