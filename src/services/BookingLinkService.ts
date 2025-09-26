import { BookingLink, BookingLinkSummary, BookingLinkStats } from '@/models/BookingLink';
import { BookingLinkConfig, AvailableSlot, DateRange, MeetingBookingRequest, BookingConfirmation } from '@/models/types';
import { BookingLinkRepository } from '@/repositories/BookingLinkRepository';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export class BookingLinkService {
  constructor(
    private bookingLinkRepository: BookingLinkRepository,
    private calendarEventRepository: CalendarEventRepository,
    private userRepository: UserRepository
  ) {}

  /**
   * Create a new booking link with customizable configuration
   */
  async createBookingLink(userId: string, config: BookingLinkConfig): Promise<BookingLink> {
    // Validate user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate configuration
    this.validateBookingLinkConfig(config);

    // Generate unique URL if not provided
    const customUrl = config.customUrl || this.generateUniqueUrl();

    // Check if custom URL is already taken
    if (await this.isUrlTaken(customUrl)) {
      throw new Error('Custom URL is already taken');
    }

    const bookingLink: Omit<BookingLink, 'createdAt' | 'updatedAt'> = {
      id: uuidv4(),
      userId,
      title: config.title,
      duration: config.duration,
      availabilityWindow: config.availabilityWindow,
      bufferBefore: config.bufferBefore,
      bufferAfter: config.bufferAfter,
      isActive: true,
      customUrl
    };

    return await this.bookingLinkRepository.create(bookingLink);
  }

  /**
   * Update an existing booking link
   */
  async updateBookingLink(userId: string, linkId: string, updates: Partial<BookingLinkConfig>): Promise<BookingLink> {
    const existingLink = await this.bookingLinkRepository.findById(linkId);
    if (!existingLink) {
      throw new Error('Booking link not found');
    }

    if (existingLink.userId !== userId) {
      throw new Error('Unauthorized to update this booking link');
    }

    // Validate updates if provided
    if (updates.title || updates.duration || updates.availabilityWindow || 
        updates.bufferBefore !== undefined || updates.bufferAfter !== undefined) {
      const configToValidate = {
        title: updates.title || existingLink.title,
        duration: updates.duration || existingLink.duration,
        availabilityWindow: updates.availabilityWindow || existingLink.availabilityWindow,
        bufferBefore: updates.bufferBefore !== undefined ? updates.bufferBefore : existingLink.bufferBefore,
        bufferAfter: updates.bufferAfter !== undefined ? updates.bufferAfter : existingLink.bufferAfter
      };
      this.validateBookingLinkConfig(configToValidate);
    }

    // Check custom URL if being updated
    if (updates.customUrl && updates.customUrl !== existingLink.customUrl) {
      if (await this.isUrlTaken(updates.customUrl)) {
        throw new Error('Custom URL is already taken');
      }
    }

    return await this.bookingLinkRepository.update(linkId, updates);
  }

  /**
   * Deactivate a booking link
   */
  async deactivateBookingLink(userId: string, linkId: string): Promise<void> {
    const existingLink = await this.bookingLinkRepository.findById(linkId);
    if (!existingLink) {
      throw new Error('Booking link not found');
    }

    if (existingLink.userId !== userId) {
      throw new Error('Unauthorized to deactivate this booking link');
    }

    await this.bookingLinkRepository.update(linkId, { isActive: false });
  }

  /**
   * Reactivate a booking link
   */
  async reactivateBookingLink(userId: string, linkId: string): Promise<void> {
    const existingLink = await this.bookingLinkRepository.findById(linkId);
    if (!existingLink) {
      throw new Error('Booking link not found');
    }

    if (existingLink.userId !== userId) {
      throw new Error('Unauthorized to reactivate this booking link');
    }

    await this.bookingLinkRepository.update(linkId, { isActive: true });
  }

  /**
   * Get all booking links for a user
   */
  async getUserBookingLinks(userId: string): Promise<BookingLinkSummary[]> {
    const links = await this.bookingLinkRepository.findByUserId(userId);
    
    return links.map(link => ({
      id: link.id,
      title: link.title,
      duration: link.duration,
      isActive: link.isActive,
      bookingUrl: this.generateBookingUrl(link.customUrl || link.id),
      createdAt: link.createdAt
    }));
  }

  /**
   * Get a specific booking link by ID
   */
  async getBookingLink(linkId: string): Promise<BookingLink | null> {
    return await this.bookingLinkRepository.findById(linkId);
  }

  /**
   * Get a booking link by custom URL
   */
  async getBookingLinkByUrl(customUrl: string): Promise<BookingLink | null> {
    return await this.bookingLinkRepository.findByCustomUrl(customUrl);
  }

  /**
   * Get booking statistics for a user's links
   */
  async getBookingStats(userId: string, linkId?: string): Promise<BookingLinkStats> {
    // This would typically query a bookings table, but for now return mock data
    // TODO: Implement actual booking statistics once booking records are tracked
    return {
      totalBookings: 0,
      thisWeekBookings: 0,
      thisMonthBookings: 0,
      averageBookingsPerWeek: 0
    };
  }

  /**
   * Delete a booking link permanently
   */
  async deleteBookingLink(userId: string, linkId: string): Promise<void> {
    const existingLink = await this.bookingLinkRepository.findById(linkId);
    if (!existingLink) {
      throw new Error('Booking link not found');
    }

    if (existingLink.userId !== userId) {
      throw new Error('Unauthorized to delete this booking link');
    }

    await this.bookingLinkRepository.delete(linkId);
  }

  /**
   * Generate a unique URL for booking links
   */
  private generateUniqueUrl(): string {
    // Generate a secure random string for the URL
    const randomBytes = crypto.randomBytes(8);
    const urlSafeString = randomBytes.toString('base64url');
    return urlSafeString;
  }

  /**
   * Check if a custom URL is already taken
   */
  private async isUrlTaken(customUrl: string): Promise<boolean> {
    const existingLink = await this.bookingLinkRepository.findByCustomUrl(customUrl);
    return existingLink !== null;
  }

  /**
   * Generate the full booking URL
   */
  private generateBookingUrl(urlIdentifier: string): string {
    // In a real application, this would use the actual domain
    const baseUrl = process.env.BASE_URL || 'https://momentum.app';
    return `${baseUrl}/book/${urlIdentifier}`;
  }

  /**
   * Validate booking link configuration
   */
  private validateBookingLinkConfig(config: BookingLinkConfig): void {
    if (!config.title || config.title.trim().length === 0) {
      throw new Error('Title is required');
    }

    if (config.title.length > 100) {
      throw new Error('Title must be 100 characters or less');
    }

    if (!config.duration || config.duration <= 0) {
      throw new Error('Duration must be greater than 0');
    }

    if (config.duration > 480) { // 8 hours max
      throw new Error('Duration cannot exceed 8 hours (480 minutes)');
    }

    if (config.bufferBefore < 0 || config.bufferAfter < 0) {
      throw new Error('Buffer times cannot be negative');
    }

    if (config.bufferBefore > 120 || config.bufferAfter > 120) {
      throw new Error('Buffer times cannot exceed 2 hours (120 minutes)');
    }

    if (!config.availabilityWindow) {
      throw new Error('Availability window is required');
    }

    this.validateAvailabilityWindow(config.availabilityWindow);

    if (config.customUrl) {
      this.validateCustomUrl(config.customUrl);
    }
  }

  /**
   * Validate availability window configuration
   */
  private validateAvailabilityWindow(window: any): void {
    if (!Array.isArray(window.daysOfWeek) || window.daysOfWeek.length === 0) {
      throw new Error('At least one day of the week must be selected');
    }

    if (window.daysOfWeek.some((day: number) => day < 0 || day > 6)) {
      throw new Error('Days of week must be between 0 (Sunday) and 6 (Saturday)');
    }

    if (!window.timeRange || !window.timeRange.start || !window.timeRange.end) {
      throw new Error('Time range is required');
    }

    if (!this.isValidTimeFormat(window.timeRange.start) || !this.isValidTimeFormat(window.timeRange.end)) {
      throw new Error('Time must be in HH:mm format');
    }

    if (window.timeRange.start >= window.timeRange.end) {
      throw new Error('End time must be after start time');
    }

    if (!window.advanceBookingDays || window.advanceBookingDays < 1) {
      throw new Error('Advance booking days must be at least 1');
    }

    if (window.advanceBookingDays > 365) {
      throw new Error('Advance booking days cannot exceed 365');
    }

    if (window.maxBookingsPerDay !== undefined && window.maxBookingsPerDay < 1) {
      throw new Error('Maximum bookings per day must be at least 1');
    }
  }

  /**
   * Validate custom URL format
   */
  private validateCustomUrl(customUrl: string): void {
    if (customUrl.length < 3) {
      throw new Error('Custom URL must be at least 3 characters long');
    }

    if (customUrl.length > 50) {
      throw new Error('Custom URL must be 50 characters or less');
    }

    // Allow alphanumeric characters, hyphens, and underscores
    const urlPattern = /^[a-zA-Z0-9_-]+$/;
    if (!urlPattern.test(customUrl)) {
      throw new Error('Custom URL can only contain letters, numbers, hyphens, and underscores');
    }

    // Reserved words that cannot be used as custom URLs
    const reservedWords = ['api', 'admin', 'www', 'app', 'book', 'calendar', 'dashboard', 'settings', 'help', 'support'];
    if (reservedWords.includes(customUrl.toLowerCase())) {
      throw new Error('This URL is reserved and cannot be used');
    }
  }

  /**
   * Validate time format (HH:mm)
   */
  private isValidTimeFormat(time: string): boolean {
    const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timePattern.test(time);
  }
}