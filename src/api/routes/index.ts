import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import taskRoutes from './tasks';
import projectRoutes from './projects';
import googleCalendarRoutes from './googleCalendar';
import microsoftGraphRoutes from './microsoftGraph';
import calendarSyncRoutes from './calendarSync';
import webhookRoutes from './webhooks';
import bookingLinkRoutes from './bookingLinks';
import meetingBookingRoutes from './meetingBooking';
import syncRoutes from './sync';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tasks', taskRoutes);
router.use('/projects', projectRoutes);
router.use('/google-calendar', googleCalendarRoutes);
router.use('/microsoft-graph', microsoftGraphRoutes);
router.use('/calendar-sync', calendarSyncRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/booking-links', bookingLinkRoutes);
router.use('/meetings', meetingBookingRoutes);
router.use('/sync', syncRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;