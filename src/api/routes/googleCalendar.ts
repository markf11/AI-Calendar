import { Router } from 'express';
import { GoogleCalendarController } from '@/api/controllers/GoogleCalendarController';
import { authenticateToken } from '@/api/middleware/auth';
import { validateRequest } from '@/api/middleware/validation';
import Joi from 'joi';

// Define schemas inline for now
const callbackSchema = Joi.object({
  code: Joi.string().required()
});

const createEventSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().optional(),
  startTime: Joi.date().iso().required(),
  endTime: Joi.date().iso().required(),
  isFlexible: Joi.boolean().optional(),
  travelTimeBefore: Joi.number().integer().min(0).optional(),
  travelTimeAfter: Joi.number().integer().min(0).optional()
});

const updateEventSchema = Joi.object({
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  startTime: Joi.date().iso().optional(),
  endTime: Joi.date().iso().optional(),
  isFlexible: Joi.boolean().optional(),
  travelTimeBefore: Joi.number().integer().min(0).optional(),
  travelTimeAfter: Joi.number().integer().min(0).optional()
}).min(1);

const router = Router();
const googleCalendarController = new GoogleCalendarController();

// OAuth routes
router.get('/auth/url', authenticateToken, googleCalendarController.getAuthUrl);
router.post('/auth/callback', authenticateToken, validateRequest(callbackSchema), googleCalendarController.handleCallback);

// Connection management
router.get('/connections', authenticateToken, googleCalendarController.getConnections);
router.delete('/connections/:connectionId', authenticateToken, googleCalendarController.disconnect);

// Event management
router.post('/connections/:connectionId/sync', authenticateToken, googleCalendarController.syncEvents);
router.post('/connections/:connectionId/events', authenticateToken, validateRequest(createEventSchema), googleCalendarController.createEvent);
router.put('/connections/:connectionId/events/:eventId', authenticateToken, validateRequest(updateEventSchema), googleCalendarController.updateEvent);
router.delete('/connections/:connectionId/events/:eventId', authenticateToken, googleCalendarController.deleteEvent);

// Webhook endpoint (no auth required - verified by token)
router.post('/webhook', googleCalendarController.handleWebhook);

export default router;