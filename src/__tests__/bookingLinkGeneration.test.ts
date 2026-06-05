// @ts-nocheck
import { BookingLinkService } from '@/services/BookingLinkService';
import { BookingLinkRepository } from '@/repositories/BookingLinkRepository';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { BookingLink } from '@/models/BookingLink';
import { BookingLinkConfig, AvailabilityWindow } from '@/models/types';
import { User } from '@/models/User';

// Mock dependencies
jest.mock('@/repositories/BookingLinkRepository');
jest.mock('@/repositories/CalendarEventRepository');
jest.mock('@/repositories/UserRepository');

describe('BookingLinkService - Link Generation', () => {
  let bookingLinkService: BookingLinkService;
  let mockBookingLinkRepository: jest.Mocked<BookingLinkRepository>;
  let mockCalendarEventRepository: jest.Mocked<CalendarEventRepository>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashed-password',
    timezone: 'America/New_York',
    workingHours: {
      monday: { start: '09:00', end: '17:00' },
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' }
    },
    preferences: {
      maxContinuousWorkTime: 120,
      preferredBreakDuration: 15,
      groupSimilarTasks: true,
      protectFocusTime: false,
      optimizeForEarlyCompletion: true,
      defaultMeetingBuffer: 10,
      energyPreferences: {
        highEnergyTimes: [{ start: '09:00', end: '11:00' }],
        lowEnergyTimes: [{ start: '14:00', end: '16:00' }],
        meetingPreferredTimes: [{ start: '10:00', end: '12:00' }]
      },
      autoRescheduleEnabled: true,
      notificationSettings: {
        taskReminders: true,
        scheduleChanges: true,
        deadlineAlerts: true,
        completionCelebrations: true
      }
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const validAvailabilityWindow: AvailabilityWindow = {
    daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
    timeRange: { start: '09:00', end: '17:00' },
    advanceBookingDays: 30,
    maxBookingsPerDay: 5
  };

  const validBookingLinkConfig: BookingLinkConfig = {
    title: 'Team Meeting',
    duration: 60,
    availabilityWindow: validAvailabilityWindow,
    bufferBefore: 10,
    bufferAfter: 5,
    customUrl: 'team-meeting'
  };

  beforeEach(() => {
    mockBookingLinkRepository = new BookingLinkRepository({} as any) as jest.Mocked<BookingLinkRepository>;
    mockCalendarEventRepository = new CalendarEventRepository({} as any) as jest.Mocked<CalendarEventRepository>;
    mockUserRepository = new UserRepository({} as any) as jest.Mocked<UserRepository>;

    bookingLinkService = new BookingLinkService(
      mockBookingLinkRepository,
      mockCalendarEventRepository,
      mockUserRepository
    );

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createBookingLink', () => {
    it('should create a booking link with valid configuration', async () => {
      const expectedBookingLink: BookingLink = {
        id: 'booking-link-123',
        userId: 'user-123',
        title: 'Team Meeting',
        duration: 60,
        availabilityWindow: validAvailabilityWindow,
        bufferBefore: 10,
        bufferAfter: 5,
        isActive: true,
        customUrl: 'team-meeting',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockBookingLinkRepository.findByCustomUrl.mockResolvedValue(null);
      mockBookingLinkRepository.create.mockResolvedValue(expectedBookingLink);

      const result = await bookingLinkService.createBookingLink('user-123', validBookingLinkConfig);

      expect(result).toEqual(expectedBookingLink);
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
      expect(mockBookingLinkRepository.findByCustomUrl).toHaveBeenCalledWith('team-meeting');
      expect(mockBookingLinkRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          title: 'Team Meeting',
          duration: 60,
          availabilityWindow: validAvailabilityWindow,
          bufferBefore: 10,
          bufferAfter: 5,
          isActive: true,
          customUrl: 'team-meeting'
        })
      );
    });

    it('should generate unique URL when custom URL is not provided', async () => {
      const configWithoutCustomUrl = { ...validBookingLinkConfig };
      delete configWithoutCustomUrl.customUrl;

      const expectedBookingLink: BookingLink = {
        id: 'booking-link-123',
        userId: 'user-123',
        title: 'Team Meeting',
        duration: 60,
        availabilityWindow: validAvailabilityWindow,
        bufferBefore: 10,
        bufferAfter: 5,
        isActive: true,
        customUrl: 'generated-url',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockBookingLinkRepository.findByCustomUrl.mockResolvedValue(null);
      mockBookingLinkRepository.create.mockResolvedValue(expectedBookingLink);

      const result = await bookingLinkService.createBookingLink('user-123', configWithoutCustomUrl);

      expect(result).toEqual(expectedBookingLink);
      expect(mockBookingLinkRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customUrl: expect.any(String)
        })
      );
    });

    it('should throw error when user does not exist', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        bookingLinkService.createBookingLink('nonexistent-user', validBookingLinkConfig)
      ).rejects.toThrow('User not found');

      expect(mockUserRepository.findById).toHaveBeenCalledWith('nonexistent-user');
      expect(mockBookingLinkRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error when custom URL is already taken', async () => {
      const existingBookingLink: BookingLink = {
        id: 'existing-link',
        userId: 'other-user',
        title: 'Existing Meeting',
        duration: 30,
        availabilityWindow: validAvailabilityWindow,
        bufferBefore: 0,
        bufferAfter: 0,
        isActive: true,
        customUrl: 'team-meeting',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockBookingLinkRepository.findByCustomUrl.mockResolvedValue(existingBookingLink);

      await expect(
        bookingLinkService.createBookingLink('user-123', validBookingLinkConfig)
      ).rejects.toThrow('Custom URL is already taken');

      expect(mockBookingLinkRepository.findByCustomUrl).toHaveBeenCalledWith('team-meeting');
      expect(mockBookingLinkRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for invalid title', async () => {
      const invalidConfig = { ...validBookingLinkConfig, title: '' };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        bookingLinkService.createBookingLink('user-123', invalidConfig)
      ).rejects.toThrow('Title is required');
    });

    it('should throw error for title too long', async () => {
      const invalidConfig = { ...validBookingLinkConfig, title: 'a'.repeat(101) };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        bookingLinkService.createBookingLink('user-123', invalidConfig)
      ).rejects.toThrow('Title must be 100 characters or less');
    });

    it('should throw error for invalid duration', async () => {
      const invalidConfig = { ...validBookingLinkConfig, duration: 0 };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        bookingLinkService.createBookingLink('user-123', invalidConfig)
      ).rejects.toThrow('Duration must be greater than 0');
    });

    it('should throw error for duration too long', async () => {
      const invalidConfig = { ...validBookingLinkConfig, duration: 500 };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        bookingLinkService.createBookingLink('user-123', invalidConfig)
      ).rejects.toThrow('Duration cannot exceed 8 hours (480 minutes)');
    });

    it('should throw error for negative buffer times', async () => {
      const invalidConfig = { ...validBookingLinkConfig, bufferBefore: -5 };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        bookingLinkService.createBookingLink('user-123', invalidConfig)
      ).rejects.toThrow('Buffer times cannot be negative');
    });

    it('should throw error for buffer times too long', async () => {
      const invalidConfig = { ...validBookingLinkConfig, bufferAfter: 150 };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        bookingLinkService.createBookingLink('user-123', invalidConfig)
      ).rejects.toThrow('Buffer times cannot exceed 2 hours (120 minutes)');
    });

    it('should throw error for empty days of week', async () => {
      const invalidConfig = {
        ...validBookingLinkConfig,
        availabilityWindow: {
          ...validAvailabilityWindow,
          daysOfWeek: []
        }
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        bookingLinkService.createBookingLink('user-123', invalidConfig)
      ).rejects.toThrow('At least one day of the week must be selected');
    });

    it('should throw error for invalid time format', async () => {
      const invalidConfig = {
        ...validBookingLinkConfig,
        availabilityWindow: {
          ...validAvailabilityWindow,
          timeRange: { start: '25:00', end: '17:00' }
        }
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        bookingLinkService.createBookingLink('user-123', invalidConfig)
      ).rejects.toThrow('Time must be in HH:mm format');
    });

    it('should throw error when end time is before start time', async () => {
      const invalidConfig = {
        ...validBookingLinkConfig,
        availabilityWindow: {
          ...validAvailabilityWindow,
          timeRange: { start: '17:00', end: '09:00' }
        }
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        bookingLinkService.createBookingLink('user-123', invalidConfig)
      ).rejects.toThrow('End time must be after start time');
    });

    it('should throw error for invalid custom URL format', async () => {
      const invalidConfig = { ...validBookingLinkConfig, customUrl: 'invalid url!' };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        bookingLinkService.createBookingLink('user-123', invalidConfig)
      ).rejects.toThrow('Custom URL can only contain letters, numbers, hyphens, and underscores');
    });

    it('should throw error for reserved custom URL', async () => {
      const invalidConfig = { ...validBookingLinkConfig, customUrl: 'admin' };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        bookingLinkService.createBookingLink('user-123', invalidConfig)
      ).rejects.toThrow('This URL is reserved and cannot be used');
    });

    it('should throw error for custom URL too short', async () => {
      const invalidConfig = { ...validBookingLinkConfig, customUrl: 'ab' };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        bookingLinkService.createBookingLink('user-123', invalidConfig)
      ).rejects.toThrow('Custom URL must be at least 3 characters long');
    });

    it('should throw error for custom URL too long', async () => {
      const invalidConfig = { ...validBookingLinkConfig, customUrl: 'a'.repeat(51) };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      await expect(
        bookingLinkService.createBookingLink('user-123', invalidConfig)
      ).rejects.toThrow('Custom URL must be 50 characters or less');
    });
  });

  describe('updateBookingLink', () => {
    const existingBookingLink: BookingLink = {
      id: 'booking-link-123',
      userId: 'user-123',
      title: 'Original Meeting',
      duration: 30,
      availabilityWindow: validAvailabilityWindow,
      bufferBefore: 5,
      bufferAfter: 5,
      isActive: true,
      customUrl: 'original-meeting',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should update booking link with valid changes', async () => {
      const updates = { title: 'Updated Meeting', duration: 45 };
      const updatedBookingLink = { ...existingBookingLink, ...updates };

      mockBookingLinkRepository.findById.mockResolvedValue(existingBookingLink);
      mockBookingLinkRepository.update.mockResolvedValue(updatedBookingLink);

      const result = await bookingLinkService.updateBookingLink('user-123', 'booking-link-123', updates);

      expect(result).toEqual(updatedBookingLink);
      expect(mockBookingLinkRepository.findById).toHaveBeenCalledWith('booking-link-123');
      expect(mockBookingLinkRepository.update).toHaveBeenCalledWith('booking-link-123', updates);
    });

    it('should throw error when booking link does not exist', async () => {
      mockBookingLinkRepository.findById.mockResolvedValue(null);

      await expect(
        bookingLinkService.updateBookingLink('user-123', 'nonexistent-link', { title: 'New Title' })
      ).rejects.toThrow('Booking link not found');

      expect(mockBookingLinkRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error when user is not authorized', async () => {
      const unauthorizedLink = { ...existingBookingLink, userId: 'other-user' };
      mockBookingLinkRepository.findById.mockResolvedValue(unauthorizedLink);

      await expect(
        bookingLinkService.updateBookingLink('user-123', 'booking-link-123', { title: 'New Title' })
      ).rejects.toThrow('Unauthorized to update this booking link');

      expect(mockBookingLinkRepository.update).not.toHaveBeenCalled();
    });

    it('should check custom URL availability when updating', async () => {
      const updates = { customUrl: 'new-url' };
      const updatedBookingLink = { ...existingBookingLink, ...updates };

      mockBookingLinkRepository.findById.mockResolvedValue(existingBookingLink);
      mockBookingLinkRepository.findByCustomUrl.mockResolvedValue(null);
      mockBookingLinkRepository.update.mockResolvedValue(updatedBookingLink);

      const result = await bookingLinkService.updateBookingLink('user-123', 'booking-link-123', updates);

      expect(result).toEqual(updatedBookingLink);
      expect(mockBookingLinkRepository.findByCustomUrl).toHaveBeenCalledWith('new-url');
    });

    it('should throw error when new custom URL is taken', async () => {
      const takenLink: BookingLink = {
        id: 'other-link',
        userId: 'other-user',
        title: 'Other Meeting',
        duration: 30,
        availabilityWindow: validAvailabilityWindow,
        bufferBefore: 0,
        bufferAfter: 0,
        isActive: true,
        customUrl: 'taken-url',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockBookingLinkRepository.findById.mockResolvedValue(existingBookingLink);
      mockBookingLinkRepository.findByCustomUrl.mockResolvedValue(takenLink);

      await expect(
        bookingLinkService.updateBookingLink('user-123', 'booking-link-123', { customUrl: 'taken-url' })
      ).rejects.toThrow('Custom URL is already taken');

      expect(mockBookingLinkRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deactivateBookingLink', () => {
    const existingBookingLink: BookingLink = {
      id: 'booking-link-123',
      userId: 'user-123',
      title: 'Active Meeting',
      duration: 30,
      availabilityWindow: validAvailabilityWindow,
      bufferBefore: 0,
      bufferAfter: 0,
      isActive: true,
      customUrl: 'active-meeting',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should deactivate booking link successfully', async () => {
      mockBookingLinkRepository.findById.mockResolvedValue(existingBookingLink);
      mockBookingLinkRepository.update.mockResolvedValue({ ...existingBookingLink, isActive: false });

      await bookingLinkService.deactivateBookingLink('user-123', 'booking-link-123');

      expect(mockBookingLinkRepository.findById).toHaveBeenCalledWith('booking-link-123');
      expect(mockBookingLinkRepository.update).toHaveBeenCalledWith('booking-link-123', { isActive: false });
    });

    it('should throw error when booking link does not exist', async () => {
      mockBookingLinkRepository.findById.mockResolvedValue(null);

      await expect(
        bookingLinkService.deactivateBookingLink('user-123', 'nonexistent-link')
      ).rejects.toThrow('Booking link not found');

      expect(mockBookingLinkRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error when user is not authorized', async () => {
      const unauthorizedLink = { ...existingBookingLink, userId: 'other-user' };
      mockBookingLinkRepository.findById.mockResolvedValue(unauthorizedLink);

      await expect(
        bookingLinkService.deactivateBookingLink('user-123', 'booking-link-123')
      ).rejects.toThrow('Unauthorized to deactivate this booking link');

      expect(mockBookingLinkRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('getUserBookingLinks', () => {
    it('should return user booking links with summary information', async () => {
      const bookingLinks: BookingLink[] = [
        {
          id: 'link-1',
          userId: 'user-123',
          title: 'Meeting 1',
          duration: 30,
          availabilityWindow: validAvailabilityWindow,
          bufferBefore: 0,
          bufferAfter: 0,
          isActive: true,
          customUrl: 'meeting-1',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        },
        {
          id: 'link-2',
          userId: 'user-123',
          title: 'Meeting 2',
          duration: 60,
          availabilityWindow: validAvailabilityWindow,
          bufferBefore: 5,
          bufferAfter: 5,
          isActive: false,
          customUrl: 'meeting-2',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02')
        }
      ];

      mockBookingLinkRepository.findByUserId.mockResolvedValue(bookingLinks);

      const result = await bookingLinkService.getUserBookingLinks('user-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'link-1',
        title: 'Meeting 1',
        duration: 30,
        isActive: true,
        bookingUrl: expect.stringContaining('/book/meeting-1'),
        createdAt: new Date('2024-01-01')
      });
      expect(result[1]).toEqual({
        id: 'link-2',
        title: 'Meeting 2',
        duration: 60,
        isActive: false,
        bookingUrl: expect.stringContaining('/book/meeting-2'),
        createdAt: new Date('2024-01-02')
      });
    });

    it('should return empty array when user has no booking links', async () => {
      mockBookingLinkRepository.findByUserId.mockResolvedValue([]);

      const result = await bookingLinkService.getUserBookingLinks('user-123');

      expect(result).toEqual([]);
      expect(mockBookingLinkRepository.findByUserId).toHaveBeenCalledWith('user-123');
    });
  });

  describe('deleteBookingLink', () => {
    const existingBookingLink: BookingLink = {
      id: 'booking-link-123',
      userId: 'user-123',
      title: 'Meeting to Delete',
      duration: 30,
      availabilityWindow: validAvailabilityWindow,
      bufferBefore: 0,
      bufferAfter: 0,
      isActive: true,
      customUrl: 'meeting-to-delete',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should delete booking link successfully', async () => {
      mockBookingLinkRepository.findById.mockResolvedValue(existingBookingLink);
      mockBookingLinkRepository.delete.mockResolvedValue();

      await bookingLinkService.deleteBookingLink('user-123', 'booking-link-123');

      expect(mockBookingLinkRepository.findById).toHaveBeenCalledWith('booking-link-123');
      expect(mockBookingLinkRepository.delete).toHaveBeenCalledWith('booking-link-123');
    });

    it('should throw error when booking link does not exist', async () => {
      mockBookingLinkRepository.findById.mockResolvedValue(null);

      await expect(
        bookingLinkService.deleteBookingLink('user-123', 'nonexistent-link')
      ).rejects.toThrow('Booking link not found');

      expect(mockBookingLinkRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw error when user is not authorized', async () => {
      const unauthorizedLink = { ...existingBookingLink, userId: 'other-user' };
      mockBookingLinkRepository.findById.mockResolvedValue(unauthorizedLink);

      await expect(
        bookingLinkService.deleteBookingLink('user-123', 'booking-link-123')
      ).rejects.toThrow('Unauthorized to delete this booking link');

      expect(mockBookingLinkRepository.delete).not.toHaveBeenCalled();
    });
  });
});