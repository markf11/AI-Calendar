import { Router } from 'express';
import { MicrosoftGraphController } from '@/api/controllers/MicrosoftGraphController';
import { authenticateToken } from '@/api/middleware/auth';
import { validateRequest } from '@/api/middleware/validation';
import { microsoftGraphSchemas } from '@/utils/validation/microsoftGraphSchemas';

const router = Router();
const microsoftGraphController = new MicrosoftGraphController();

// Authentication routes
router.get('/auth-url', authenticateToken, microsoftGraphController.getAuthUrl);
router.post('/callback', authenticateToken, validateRequest(microsoftGraphSchemas.callback), microsoftGraphController.handleCallback);

// Connection management
router.get('/connections', authenticateToken, microsoftGraphController.getConnections);
router.delete('/connections/:connectionId', authenticateToken, microsoftGraphController.disconnect);

// Event synchronization
router.post('/connections/:connectionId/sync', authenticateToken, microsoftGraphController.syncEvents);

// Event management
router.post('/connections/:connectionId/events', authenticateToken, validateRequest(microsoftGraphSchemas.createEvent), microsoftGraphController.createEvent);
router.put('/connections/:connectionId/events/:eventId', authenticateToken, validateRequest(microsoftGraphSchemas.updateEvent), microsoftGraphController.updateEvent);
router.delete('/connections/:connectionId/events/:eventId', authenticateToken, microsoftGraphController.deleteEvent);

// Webhook endpoint (no authentication required for Microsoft Graph webhooks)
router.post('/webhook', microsoftGraphController.handleWebhook);

export default router;