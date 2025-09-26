import { Router } from 'express';
import { CalendarSyncController } from '@/api/controllers/CalendarSyncController';
import { authenticateToken } from '@/api/middleware/auth';
import { validateRequest } from '@/api/middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const calendarSyncController = new CalendarSyncController();

// Validation schemas
const setupWebhooksValidation = [
  body('webhookBaseUrl')
    .isURL()
    .withMessage('webhookBaseUrl must be a valid URL')
];

const providerValidation = [
  param('provider')
    .isIn(['google', 'microsoft'])
    .withMessage('Provider must be either "google" or "microsoft"')
];

const syncOptionsValidation = [
  query('fullSync')
    .optional()
    .isBoolean()
    .withMessage('fullSync must be a boolean'),
  query('resolveConflicts')
    .optional()
    .isBoolean()
    .withMessage('resolveConflicts must be a boolean'),
  query('dryRun')
    .optional()
    .isBoolean()
    .withMessage('dryRun must be a boolean')
];

/**
 * @route POST /api/calendar-sync/sync
 * @desc Sync all calendars for the authenticated user
 * @access Private
 */
router.post('/sync', 
  authenticateToken,
  syncOptionsValidation,
  validateRequest,
  calendarSyncController.syncUserCalendars
);

/**
 * @route POST /api/calendar-sync/force-sync
 * @desc Force full sync for user's calendars
 * @access Private
 */
router.post('/force-sync',
  authenticateToken,
  calendarSyncController.forceFullSync
);

/**
 * @route GET /api/calendar-sync/status
 * @desc Get sync status for user's calendars
 * @access Private
 */
router.get('/status',
  authenticateToken,
  calendarSyncController.getSyncStatus
);

/**
 * @route GET /api/calendar-sync/conflicts/:provider
 * @desc Detect conflicts in user's calendar for specific provider
 * @access Private
 */
router.get('/conflicts/:provider',
  authenticateToken,
  providerValidation,
  validateRequest,
  calendarSyncController.detectConflicts
);

/**
 * @route POST /api/calendar-sync/push/:provider
 * @desc Push local changes to external calendar
 * @access Private
 */
router.post('/push/:provider',
  authenticateToken,
  providerValidation,
  validateRequest,
  calendarSyncController.pushLocalChanges
);

/**
 * @route POST /api/calendar-sync/webhooks/setup
 * @desc Setup webhook subscriptions for user
 * @access Private
 */
router.post('/webhooks/setup',
  authenticateToken,
  setupWebhooksValidation,
  validateRequest,
  calendarSyncController.setupWebhooks
);

// Webhook routes are mounted at root level, not under calendar-sync
// These will be available at /api/webhooks/google and /api/webhooks/microsoft

export default router;