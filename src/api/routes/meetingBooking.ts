// @ts-nocheck
import { Router } from 'express';
import { MeetingBookingController } from '@/api/controllers/MeetingBookingController';
import { MeetingBookingService } from '@/services/MeetingBookingService';
import { AvailabilityCalculationService } from '@/services/AvailabilityCalculationService';
import { BookingLinkRepository } from '@/repositories/BookingLinkRepository';
import { BookingRecordRepository } from '@/repositories/BookingRecordRepository';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import { TaskRepository } from '@/repositories/TaskRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { ReschedulingTriggerService } from '@/services/ReschedulingTriggerService';
import { authenticateToken } from '@/api/middleware/auth';
import { validateMeetingBooking, validateMeetingReschedule } from '@/api/middleware/validation';
import { pool } from '@/config/database';

const router = Router();

// Initialize dependencies
const bookingLinkRepository = new BookingLinkRepository(pool);
const bookingRecordRepository = new BookingRecordRepository(pool);
const calendarEventRepository = new CalendarEventRepository(pool);
const taskRepository = new TaskRepository();
const userRepository = new UserRepository(pool);

// Initialize services
const availabilityService = new AvailabilityCalculationService(
  calendarEventRepository,
  taskRepository,
  userRepository
);

// Note: ReschedulingTriggerService would need proper initialization
const reschedulingService = new ReschedulingTriggerService(
  taskRepository,
  calendarEventRepository,
  userRepository
);

const meetingBookingService = new MeetingBookingService(
  bookingLinkRepository,
  calendarEventRepository,
  userRepository,
  availabilityService,
  reschedulingService,
  bookingRecordRepository
);

const meetingBookingController = new MeetingBookingController(
  meetingBookingService,
  availabilityService
);

// Public routes (no authentication required)
router.get('/:linkId/availability', meetingBookingController.getAvailability);
router.post('/:linkId/book', validateMeetingBooking, meetingBookingController.bookMeeting);
router.get('/booking/:confirmationCode', meetingBookingController.getBookingDetails);
router.post('/booking/:confirmationCode/cancel', meetingBookingController.cancelBooking);
router.post('/booking/:confirmationCode/reschedule', validateMeetingReschedule, meetingBookingController.rescheduleBooking);
router.get('/:linkId/check-availability', meetingBookingController.checkTimeSlotAvailability);
router.get('/:linkId/next-available', meetingBookingController.getNextAvailableSlot);

// Protected routes (require authentication)
router.get('/:linkId/bookings', authenticateToken, meetingBookingController.getBookingsForLink);
router.get('/statistics', authenticateToken, meetingBookingController.getBookingStatistics);

// Internal routes (for system use)
router.post('/send-reminders', meetingBookingController.sendBookingReminders);

export default router;