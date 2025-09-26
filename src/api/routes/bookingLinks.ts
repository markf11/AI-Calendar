import { Router } from 'express';
import { BookingLinkController } from '@/api/controllers/BookingLinkController';
import { BookingLinkService } from '@/services/BookingLinkService';
import { BookingLinkRepository } from '@/repositories/BookingLinkRepository';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { authenticateToken } from '@/api/middleware/auth';
import { validateBookingLinkCreation, validateBookingLinkUpdate } from '@/api/middleware/validation';
import { pool } from '@/config/database';

const router = Router();

// Initialize dependencies
const bookingLinkRepository = new BookingLinkRepository(pool);
const calendarEventRepository = new CalendarEventRepository(pool);
const userRepository = new UserRepository(pool);
const bookingLinkService = new BookingLinkService(
  bookingLinkRepository,
  calendarEventRepository,
  userRepository
);
const bookingLinkController = new BookingLinkController(bookingLinkService);

// Protected routes (require authentication)
router.post('/', authenticateToken, validateBookingLinkCreation, bookingLinkController.createBookingLink);
router.get('/', authenticateToken, bookingLinkController.getUserBookingLinks);
router.get('/stats', authenticateToken, bookingLinkController.getBookingStats);
router.get('/:linkId', authenticateToken, bookingLinkController.getBookingLink);
router.put('/:linkId', authenticateToken, validateBookingLinkUpdate, bookingLinkController.updateBookingLink);
router.patch('/:linkId/deactivate', authenticateToken, bookingLinkController.deactivateBookingLink);
router.patch('/:linkId/reactivate', authenticateToken, bookingLinkController.reactivateBookingLink);
router.delete('/:linkId', authenticateToken, bookingLinkController.deleteBookingLink);

// Public routes (no authentication required)
router.get('/public/:customUrl', bookingLinkController.getBookingLinkByUrl);

export default router;