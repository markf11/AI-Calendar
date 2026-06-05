// @ts-nocheck
import { UserRepository } from '@/repositories/UserRepository';
import { User, UpdateUserRequest } from '@/models/User';
import { WorkingHours, UserPreferences } from '@/models/types';
import { encrypt, decrypt } from '@/utils/encryption';

export interface OnboardingData {
  workingHours?: Partial<WorkingHours>;
  preferences?: Partial<UserPreferences>;
  timezone?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  timezone: string;
  workingHours: WorkingHours;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
      workingHours: user.workingHours,
      preferences: user.preferences,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: UpdateUserRequest): Promise<UserProfile | null> {
    // Validate timezone if provided
    if (updates.timezone) {
      if (!this.isValidTimezone(updates.timezone)) {
        throw new Error('Invalid timezone');
      }
    }

    // Validate working hours if provided
    if (updates.workingHours) {
      this.validateWorkingHours(updates.workingHours);
    }

    // Validate preferences if provided
    if (updates.preferences) {
      this.validateUserPreferences(updates.preferences);
    }

    const updatedUser = await this.userRepository.update(userId, updates);
    if (!updatedUser) {
      return null;
    }

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      timezone: updatedUser.timezone,
      workingHours: updatedUser.workingHours,
      preferences: updatedUser.preferences,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt
    };
  }

  /**
   * Complete user onboarding
   */
  async completeOnboarding(userId: string, onboardingData: OnboardingData): Promise<UserProfile | null> {
    const updates: UpdateUserRequest = {};

    if (onboardingData.timezone) {
      if (!this.isValidTimezone(onboardingData.timezone)) {
        throw new Error('Invalid timezone');
      }
      updates.timezone = onboardingData.timezone;
    }

    if (onboardingData.workingHours) {
      // Merge with existing working hours
      const currentUser = await this.userRepository.findById(userId);
      if (!currentUser) {
        throw new Error('User not found');
      }

      updates.workingHours = {
        ...currentUser.workingHours,
        ...onboardingData.workingHours
      };

      this.validateWorkingHours(updates.workingHours);
    }

    if (onboardingData.preferences) {
      // Merge with existing preferences
      const currentUser = await this.userRepository.findById(userId);
      if (!currentUser) {
        throw new Error('User not found');
      }

      updates.preferences = {
        ...currentUser.preferences,
        ...onboardingData.preferences
      };

      this.validateUserPreferences(updates.preferences);
    }

    return this.updateProfile(userId, updates);
  }

  /**
   * Update working hours
   */
  async updateWorkingHours(userId: string, workingHours: Partial<WorkingHours>): Promise<UserProfile | null> {
    // Get current user to merge working hours
    const currentUser = await this.userRepository.findById(userId);
    if (!currentUser) {
      throw new Error('User not found');
    }

    const updatedWorkingHours = {
      ...currentUser.workingHours,
      ...workingHours
    };

    this.validateWorkingHours(updatedWorkingHours);

    return this.updateProfile(userId, { workingHours: updatedWorkingHours });
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserProfile | null> {
    // Get current user to merge preferences
    const currentUser = await this.userRepository.findById(userId);
    if (!currentUser) {
      throw new Error('User not found');
    }

    const updatedPreferences = {
      ...currentUser.preferences,
      ...preferences
    };

    this.validateUserPreferences(updatedPreferences);

    return this.updateProfile(userId, { preferences: updatedPreferences });
  }

  /**
   * Delete user account
   */
  async deleteAccount(userId: string): Promise<boolean> {
    return this.userRepository.delete(userId);
  }

  /**
   * Get user's encrypted preferences (for secure storage)
   */
  async getEncryptedPreferences(userId: string): Promise<string | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return null;
    }

    return encrypt(JSON.stringify(user.preferences));
  }

  /**
   * Update user preferences from encrypted data
   */
  async updateFromEncryptedPreferences(userId: string, encryptedPreferences: string): Promise<UserProfile | null> {
    try {
      const decryptedData = decrypt(encryptedPreferences);
      const preferences = JSON.parse(decryptedData) as UserPreferences;
      
      this.validateUserPreferences(preferences);
      
      return this.updateProfile(userId, { preferences });
    } catch (error) {
      throw new Error('Failed to decrypt or parse preferences data');
    }
  }

  /**
   * Validate timezone
   */
  private isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate working hours
   */
  private validateWorkingHours(workingHours: WorkingHours): void {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

    const validateTimeRange = (range: { start: string; end: string }, name: string) => {
      if (!timeRegex.test(range.start)) {
        throw new Error(`Invalid start time format for ${name}`);
      }
      if (!timeRegex.test(range.end)) {
        throw new Error(`Invalid end time format for ${name}`);
      }

      const startMinutes = this.timeToMinutes(range.start);
      const endMinutes = this.timeToMinutes(range.end);

      if (startMinutes >= endMinutes) {
        throw new Error(`Start time must be before end time for ${name}`);
      }
    };

    // Validate required days
    const requiredDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
    for (const day of requiredDays) {
      if (!workingHours[day]) {
        throw new Error(`Working hours for ${day} are required`);
      }
      validateTimeRange(workingHours[day], day);
    }

    // Validate optional days
    if (workingHours.saturday) {
      validateTimeRange(workingHours.saturday, 'saturday');
    }
    if (workingHours.sunday) {
      validateTimeRange(workingHours.sunday, 'sunday');
    }

    // Validate lunch break
    if (workingHours.lunchBreak) {
      validateTimeRange(workingHours.lunchBreak, 'lunch break');
    }
  }

  /**
   * Validate user preferences
   */
  private validateUserPreferences(preferences: UserPreferences): void {
    if (preferences.maxContinuousWorkTime <= 0) {
      throw new Error('Max continuous work time must be positive');
    }

    if (preferences.preferredBreakDuration <= 0) {
      throw new Error('Preferred break duration must be positive');
    }

    if (preferences.defaultMeetingBuffer < 0) {
      throw new Error('Default meeting buffer cannot be negative');
    }

    // Validate energy preferences
    if (preferences.energyPreferences) {
      const { energyPreferences } = preferences;
      
      if (energyPreferences.highEnergyTimes) {
        energyPreferences.highEnergyTimes.forEach((range, index) => {
          this.validateTimeRange(range, `high energy time ${index + 1}`);
        });
      }

      if (energyPreferences.lowEnergyTimes) {
        energyPreferences.lowEnergyTimes.forEach((range, index) => {
          this.validateTimeRange(range, `low energy time ${index + 1}`);
        });
      }

      if (energyPreferences.meetingPreferredTimes) {
        energyPreferences.meetingPreferredTimes.forEach((range, index) => {
          this.validateTimeRange(range, `meeting preferred time ${index + 1}`);
        });
      }
    }
  }

  /**
   * Validate time range
   */
  private validateTimeRange(range: { start: string; end: string }, name: string): void {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (!timeRegex.test(range.start)) {
      throw new Error(`Invalid start time format for ${name}`);
    }
    if (!timeRegex.test(range.end)) {
      throw new Error(`Invalid end time format for ${name}`);
    }

    const startMinutes = this.timeToMinutes(range.start);
    const endMinutes = this.timeToMinutes(range.end);

    if (startMinutes >= endMinutes) {
      throw new Error(`Start time must be before end time for ${name}`);
    }
  }

  /**
   * Convert time string to minutes
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
}