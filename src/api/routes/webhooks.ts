import { Router } from 'express';
import { CalendarSyncController } from '@/api/controllers/CalendarSyncController';

const router = Router();
const calendarSyncController = new CalendarSyncController();

/**
 * @route POST /api/webhooks/google
 * @desc Handle Google Calendar webhook notifications
 * @access Public (verified by Google)
 */
router.post('/google',
  calendarSyncController.handleGoogleWebhook
);

/**
 * @route POST /api/webhooks/microsoft
 * @desc Handle Microsoft Graph webhook notifications
 * @access Public (verified by Microsoft)
 */
router.post('/microsoft',
  calendarSyncController.handleMicrosoftWebhook
);

export default router;