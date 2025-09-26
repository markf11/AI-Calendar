import { Request, Response } from 'express';
import { CalendarSyncService, SyncOptions } from '@/services/CalendarSyncService';
import { CalendarWebhookService, GoogleWebhookPayload, MicrosoftWebhookPayload } from '@/services/CalendarWebhookService';
import { db } from '@/config/database';
import { AuthenticatedRequest } from '@/api/middleware/auth';

export class CalendarSyncController {
  private syncService: CalendarSyncService;
  private webhookService: CalendarWebhookService;

  constructor() {
    this.syncService = new CalendarSyncService(db);
    this.webhookService = new CalendarWebhookService(db);
  }

  /**
   * Sync all calendars for the authenticated user
   */
  syncUserCalendars = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const options: SyncOptions = {
        fullSync: req.query.fullSync === 'true',
        resolveConflicts: req.query.resolveConflicts === 'true',
        dryRun: req.query.dryRun === 'true'
      };

      const result = await this.syncService.syncUserCalendars(userId, options);

      res.json({
        success: true,
        data: result,
        message: 'Calendar sync completed'
      });
    } catch (error) {
      console.error('Calendar sync error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to sync calendars',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get sync status for user's calendars
   */
  getSyncStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      
      // Get sync status for all providers
      const googleStatus = this.syncService.getSyncStatus(`${userId}-google`);
      const microsoftStatus = this.syncService.getSyncStatus(`${userId}-microsoft`);

      res.json({
        success: true,
        data: {
          google: googleStatus,
          microsoft: microsoftStatus
        }
      });
    } catch (error) {
      console.error('Get sync status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get sync status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Detect conflicts in user's calendar
   */
  detectConflicts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { provider } = req.params;

      if (provider !== 'google' && provider !== 'microsoft') {
        res.status(400).json({
          success: false,
          error: 'Invalid provider. Must be "google" or "microsoft"'
        });
        return;
      }

      const conflicts = await this.syncService.detectConflicts(userId, provider);

      res.json({
        success: true,
        data: {
          conflicts,
          count: conflicts.length
        }
      });
    } catch (error) {
      console.error('Detect conflicts error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to detect conflicts',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Push local changes to external calendar
   */
  pushLocalChanges = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { provider } = req.params;

      if (provider !== 'google' && provider !== 'microsoft') {
        res.status(400).json({
          success: false,
          error: 'Invalid provider. Must be "google" or "microsoft"'
        });
        return;
      }

      const result = await this.syncService.pushLocalChanges(userId, provider);

      res.json({
        success: true,
        data: result,
        message: 'Local changes pushed successfully'
      });
    } catch (error) {
      console.error('Push local changes error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to push local changes',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Handle Google Calendar webhook
   */
  handleGoogleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const payload: GoogleWebhookPayload = {
        provider: 'google',
        'x-goog-channel-id': req.headers['x-goog-channel-id'] as string,
        'x-goog-channel-token': req.headers['x-goog-channel-token'] as string,
        'x-goog-resource-id': req.headers['x-goog-resource-id'] as string,
        'x-goog-resource-uri': req.headers['x-goog-resource-uri'] as string,
        'x-goog-resource-state': req.headers['x-goog-resource-state'] as 'exists' | 'not_exists' | 'sync',
        'x-goog-message-number': req.headers['x-goog-message-number'] as string
      };

      await this.webhookService.handleGoogleWebhook(payload);

      // Google expects a 200 response
      res.status(200).send('OK');
    } catch (error) {
      console.error('Google webhook error:', error);
      res.status(500).send('Internal Server Error');
    }
  };

  /**
   * Handle Microsoft Graph webhook
   */
  handleMicrosoftWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      // Handle validation request
      if (req.query.validationToken) {
        const validationToken = req.query.validationToken as string;
        const response = this.webhookService.handleWebhookValidation(validationToken);
        res.status(200).send(response);
        return;
      }

      // Handle notification
      const notifications = req.body.value || [req.body];
      
      for (const notification of notifications) {
        const payload: MicrosoftWebhookPayload = {
          provider: 'microsoft',
          subscriptionId: notification.subscriptionId,
          clientState: notification.clientState,
          resource: notification.resource,
          resourceData: notification.resourceData,
          subscriptionExpirationDateTime: notification.subscriptionExpirationDateTime,
          tenantId: notification.tenantId,
          changeType: notification.changeType
        };

        await this.webhookService.handleMicrosoftWebhook(payload);
      }

      // Microsoft expects a 202 response
      res.status(202).send('Accepted');
    } catch (error) {
      console.error('Microsoft webhook error:', error);
      res.status(500).send('Internal Server Error');
    }
  };

  /**
   * Setup webhook subscriptions for user
   */
  setupWebhooks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { webhookBaseUrl } = req.body;

      if (!webhookBaseUrl) {
        res.status(400).json({
          success: false,
          error: 'webhookBaseUrl is required'
        });
        return;
      }

      await this.webhookService.setupWebhookSubscriptions(userId, webhookBaseUrl);

      res.json({
        success: true,
        message: 'Webhook subscriptions setup successfully'
      });
    } catch (error) {
      console.error('Setup webhooks error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to setup webhooks',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Force full sync for user's calendars
   */
  forceFullSync = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      
      const result = await this.syncService.syncUserCalendars(userId, {
        fullSync: true,
        resolveConflicts: true
      });

      res.json({
        success: true,
        data: result,
        message: 'Full calendar sync completed'
      });
    } catch (error) {
      console.error('Force full sync error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform full sync',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}