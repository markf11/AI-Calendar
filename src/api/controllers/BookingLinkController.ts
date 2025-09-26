import { Request, Response } from 'express';
import { BookingLinkService } from '@/services/BookingLinkService';
import { BookingLinkConfig } from '@/models/types';

export class BookingLinkController {
  constructor(private bookingLinkService: BookingLinkService) {}

  /**
   * Create a new booking link
   */
  createBookingLink = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const config: BookingLinkConfig = req.body;
      const bookingLink = await this.bookingLinkService.createBookingLink(userId, config);

      res.status(201).json({
        success: true,
        data: bookingLink
      });
    } catch (error) {
      console.error('Error creating booking link:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create booking link'
      });
    }
  };

  /**
   * Get all booking links for the authenticated user
   */
  getUserBookingLinks = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const bookingLinks = await this.bookingLinkService.getUserBookingLinks(userId);

      res.json({
        success: true,
        data: bookingLinks
      });
    } catch (error) {
      console.error('Error fetching booking links:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch booking links'
      });
    }
  };

  /**
   * Get a specific booking link by ID
   */
  getBookingLink = async (req: Request, res: Response): Promise<void> => {
    try {
      const { linkId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const bookingLink = await this.bookingLinkService.getBookingLink(linkId);

      if (!bookingLink) {
        res.status(404).json({
          success: false,
          error: 'Booking link not found'
        });
        return;
      }

      // Check if user owns this booking link
      if (bookingLink.userId !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied'
        });
        return;
      }

      res.json({
        success: true,
        data: bookingLink
      });
    } catch (error) {
      console.error('Error fetching booking link:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch booking link'
      });
    }
  };

  /**
   * Get a booking link by custom URL (public endpoint)
   */
  getBookingLinkByUrl = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customUrl } = req.params;

      const bookingLink = await this.bookingLinkService.getBookingLinkByUrl(customUrl);

      if (!bookingLink || !bookingLink.isActive) {
        res.status(404).json({
          success: false,
          error: 'Booking link not found or inactive'
        });
        return;
      }

      // Return public information only
      res.json({
        success: true,
        data: {
          id: bookingLink.id,
          title: bookingLink.title,
          duration: bookingLink.duration,
          availabilityWindow: bookingLink.availabilityWindow,
          bufferBefore: bookingLink.bufferBefore,
          bufferAfter: bookingLink.bufferAfter
        }
      });
    } catch (error) {
      console.error('Error fetching booking link by URL:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch booking link'
      });
    }
  };

  /**
   * Update a booking link
   */
  updateBookingLink = async (req: Request, res: Response): Promise<void> => {
    try {
      const { linkId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const updates: Partial<BookingLinkConfig> = req.body;
      const updatedLink = await this.bookingLinkService.updateBookingLink(userId, linkId, updates);

      res.json({
        success: true,
        data: updatedLink
      });
    } catch (error) {
      console.error('Error updating booking link:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update booking link'
      });
    }
  };

  /**
   * Deactivate a booking link
   */
  deactivateBookingLink = async (req: Request, res: Response): Promise<void> => {
    try {
      const { linkId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await this.bookingLinkService.deactivateBookingLink(userId, linkId);

      res.json({
        success: true,
        message: 'Booking link deactivated successfully'
      });
    } catch (error) {
      console.error('Error deactivating booking link:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deactivate booking link'
      });
    }
  };

  /**
   * Reactivate a booking link
   */
  reactivateBookingLink = async (req: Request, res: Response): Promise<void> => {
    try {
      const { linkId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await this.bookingLinkService.reactivateBookingLink(userId, linkId);

      res.json({
        success: true,
        message: 'Booking link reactivated successfully'
      });
    } catch (error) {
      console.error('Error reactivating booking link:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reactivate booking link'
      });
    }
  };

  /**
   * Delete a booking link
   */
  deleteBookingLink = async (req: Request, res: Response): Promise<void> => {
    try {
      const { linkId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await this.bookingLinkService.deleteBookingLink(userId, linkId);

      res.json({
        success: true,
        message: 'Booking link deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting booking link:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete booking link'
      });
    }
  };

  /**
   * Get booking statistics
   */
  getBookingStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { linkId } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const stats = await this.bookingLinkService.getBookingStats(userId, linkId as string);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching booking stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch booking statistics'
      });
    }
  };
}