import { Request, Response } from 'express';
import { MeetingBookingService } from '@/services/MeetingBookingService';
import { AvailabilityCalculationService } from '@/services/AvailabilityCalculationService';
import { MeetingBookingRequest, DateRange } from '@/models/types';

export class MeetingBookingController {
  constructor(
    private meetingBookingService: MeetingBookingService,
    private availabilityService: AvailabilityCalculationService
  ) {}

  /**
   * Get availability for a booking link (public endpoint)
   */
  getAvailability = async (req: Request, res: Response): Promise<void> => {
    try {
      const { linkId } = req.params;
      const { startDate, endDate, optimized } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'Start date and end date are required'
        });
        return;
      }

      const dateRange: DateRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      };

      // Validate date range
      if (isNaN(dateRange.start.getTime()) || isNaN(dateRange.end.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format'
        });
        return;
      }

      if (dateRange.start >= dateRange.end) {
        res.status(400).json({
          success: false,
          error: 'Start date must be before end date'
        });
        return;
      }

      // Get booking link (this will validate if it exists and is active)
      const bookingLink = await this.meetingBookingService.getBookingLink(linkId);
      if (!bookingLink) {
        res.status(404).json({
          success: false,
          error: 'Booking link not found or inactive'
        });
        return;
      }

      let availability;
      if (optimized === 'true') {
        availability = await this.availabilityService.getOptimizedAvailability(bookingLink, dateRange);
      } else {
        availability = await this.availabilityService.calculateAvailability(bookingLink, dateRange);
      }

      res.json({
        success: true,
        data: {
          bookingLink: {
            id: bookingLink.id,
            title: bookingLink.title,
            duration: bookingLink.duration,
            bufferBefore: bookingLink.bufferBefore,
            bufferAfter: bookingLink.bufferAfter
          },
          availability
        }
      });
    } catch (error) {
      console.error('Error getting availability:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get availability'
      });
    }
  };

  /**
   * Book a meeting (public endpoint)
   */
  bookMeeting = async (req: Request, res: Response): Promise<void> => {
    try {
      const { linkId } = req.params;
      const bookingRequest: MeetingBookingRequest = req.body;

      const confirmation = await this.meetingBookingService.bookMeeting(linkId, bookingRequest);

      res.status(201).json({
        success: true,
        data: confirmation,
        message: 'Meeting booked successfully'
      });
    } catch (error) {
      console.error('Error booking meeting:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to book meeting'
      });
    }
  };

  /**
   * Get booking details by confirmation code (public endpoint)
   */
  getBookingDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const { confirmationCode } = req.params;

      const booking = await this.meetingBookingService.getBookingDetails(confirmationCode);

      if (!booking) {
        res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
        return;
      }

      res.json({
        success: true,
        data: booking
      });
    } catch (error) {
      console.error('Error getting booking details:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get booking details'
      });
    }
  };

  /**
   * Cancel a booking (public endpoint)
   */
  cancelBooking = async (req: Request, res: Response): Promise<void> => {
    try {
      const { confirmationCode } = req.params;
      const { reason } = req.body;

      await this.meetingBookingService.cancelBooking(confirmationCode, reason);

      res.json({
        success: true,
        message: 'Booking cancelled successfully'
      });
    } catch (error) {
      console.error('Error cancelling booking:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel booking'
      });
    }
  };

  /**
   * Reschedule a booking (public endpoint)
   */
  rescheduleBooking = async (req: Request, res: Response): Promise<void> => {
    try {
      const { confirmationCode } = req.params;
      const { newStartTime } = req.body;

      if (!newStartTime) {
        res.status(400).json({
          success: false,
          error: 'New start time is required'
        });
        return;
      }

      const newStartDate = new Date(newStartTime);
      if (isNaN(newStartDate.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format for new start time'
        });
        return;
      }

      const confirmation = await this.meetingBookingService.rescheduleBooking(
        confirmationCode,
        newStartDate
      );

      res.json({
        success: true,
        data: confirmation,
        message: 'Booking rescheduled successfully'
      });
    } catch (error) {
      console.error('Error rescheduling booking:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reschedule booking'
      });
    }
  };

  /**
   * Get bookings for a booking link (protected endpoint)
   */
  getBookingsForLink = async (req: Request, res: Response): Promise<void> => {
    try {
      const { linkId } = req.params;
      const userId = req.user?.id;
      const { status, startDate, endDate } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      let filters: any = {};

      if (status) {
        const statusArray = Array.isArray(status) ? status : [status];
        filters.status = statusArray;
      }

      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          filters.dateRange = { start, end };
        }
      }

      const bookings = await this.meetingBookingService.getBookingsForLink(
        linkId,
        userId,
        Object.keys(filters).length > 0 ? filters : undefined
      );

      res.json({
        success: true,
        data: bookings
      });
    } catch (error) {
      console.error('Error getting bookings for link:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get bookings'
      });
    }
  };

  /**
   * Get booking statistics for user (protected endpoint)
   */
  getBookingStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { startDate, endDate } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      let dateRange: { start: Date; end: Date } | undefined;

      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          dateRange = { start, end };
        }
      }

      const statistics = await this.meetingBookingService.getBookingStatistics(userId, dateRange);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Error getting booking statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get booking statistics'
      });
    }
  };

  /**
   * Check if a specific time slot is available (public endpoint)
   */
  checkTimeSlotAvailability = async (req: Request, res: Response): Promise<void> => {
    try {
      const { linkId } = req.params;
      const { startTime } = req.query;

      if (!startTime) {
        res.status(400).json({
          success: false,
          error: 'Start time is required'
        });
        return;
      }

      const requestedTime = new Date(startTime as string);
      if (isNaN(requestedTime.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format'
        });
        return;
      }

      // Get booking link
      const bookingLink = await this.meetingBookingService.getBookingLink(linkId);
      if (!bookingLink) {
        res.status(404).json({
          success: false,
          error: 'Booking link not found or inactive'
        });
        return;
      }

      const isAvailable = await this.availabilityService.isTimeSlotAvailable(
        bookingLink,
        requestedTime
      );

      res.json({
        success: true,
        data: {
          available: isAvailable,
          requestedTime: requestedTime,
          duration: bookingLink.duration
        }
      });
    } catch (error) {
      console.error('Error checking time slot availability:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check availability'
      });
    }
  };

  /**
   * Get next available slot after a given time (public endpoint)
   */
  getNextAvailableSlot = async (req: Request, res: Response): Promise<void> => {
    try {
      const { linkId } = req.params;
      const { afterTime } = req.query;

      if (!afterTime) {
        res.status(400).json({
          success: false,
          error: 'After time is required'
        });
        return;
      }

      const afterDate = new Date(afterTime as string);
      if (isNaN(afterDate.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format'
        });
        return;
      }

      // Get booking link
      const bookingLink = await this.meetingBookingService.getBookingLink(linkId);
      if (!bookingLink) {
        res.status(404).json({
          success: false,
          error: 'Booking link not found or inactive'
        });
        return;
      }

      const nextSlot = await this.availabilityService.getNextAvailableSlot(
        bookingLink,
        afterDate
      );

      res.json({
        success: true,
        data: {
          nextAvailableSlot: nextSlot,
          searchedAfter: afterDate
        }
      });
    } catch (error) {
      console.error('Error getting next available slot:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get next available slot'
      });
    }
  };

  /**
   * Send booking reminders (internal endpoint - could be called by cron job)
   */
  sendBookingReminders = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.meetingBookingService.sendBookingReminders();

      res.json({
        success: true,
        message: 'Booking reminders sent successfully'
      });
    } catch (error) {
      console.error('Error sending booking reminders:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send booking reminders'
      });
    }
  };

  /**
   * Helper method to get booking link (used by other methods)
   */
  private async getBookingLink(linkId: string) {
    return await this.meetingBookingService.getBookingDetails(linkId);
  }
}