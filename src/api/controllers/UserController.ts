import { Request, Response } from 'express';
import { UserService, OnboardingData } from '@/services/UserService';
import { UpdateUserRequest } from '@/models/User';
import { WorkingHours, UserPreferences } from '@/models/types';
import { AuthenticatedRequest } from '@/api/middleware/auth';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  /**
   * Get user profile
   */
  getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user.id;
      const profile = await this.userService.getUserProfile(userId);

      if (!profile) {
        res.status(404).json({
          error: {
            message: 'User profile not found',
            code: 'USER_NOT_FOUND'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { profile },
        message: 'User profile retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: {
          message: 'Internal server error while retrieving profile',
          code: 'GET_PROFILE_ERROR'
        }
      });
    }
  };

  /**
   * Update user profile
   */
  updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user.id;
      const updates: UpdateUserRequest = req.body;

      const updatedProfile = await this.userService.updateProfile(userId, updates);

      if (!updatedProfile) {
        res.status(404).json({
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { profile: updatedProfile },
        message: 'Profile updated successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Profile update failed';
      
      if (errorMessage.includes('Invalid timezone')) {
        res.status(400).json({
          error: {
            message: errorMessage,
            code: 'INVALID_TIMEZONE'
          }
        });
        return;
      }

      if (errorMessage.includes('Invalid') || errorMessage.includes('must be')) {
        res.status(400).json({
          error: {
            message: errorMessage,
            code: 'VALIDATION_ERROR'
          }
        });
        return;
      }

      res.status(500).json({
        error: {
          message: 'Internal server error during profile update',
          code: 'UPDATE_PROFILE_ERROR'
        }
      });
    }
  };

  /**
   * Complete user onboarding
   */
  completeOnboarding = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user.id;
      const onboardingData: OnboardingData = req.body;

      const updatedProfile = await this.userService.completeOnboarding(userId, onboardingData);

      if (!updatedProfile) {
        res.status(404).json({
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { profile: updatedProfile },
        message: 'Onboarding completed successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Onboarding failed';
      
      if (errorMessage.includes('Invalid timezone')) {
        res.status(400).json({
          error: {
            message: errorMessage,
            code: 'INVALID_TIMEZONE'
          }
        });
        return;
      }

      if (errorMessage.includes('Invalid') || errorMessage.includes('must be')) {
        res.status(400).json({
          error: {
            message: errorMessage,
            code: 'VALIDATION_ERROR'
          }
        });
        return;
      }

      if (errorMessage.includes('User not found')) {
        res.status(404).json({
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
        return;
      }

      res.status(500).json({
        error: {
          message: 'Internal server error during onboarding',
          code: 'ONBOARDING_ERROR'
        }
      });
    }
  };

  /**
   * Update working hours
   */
  updateWorkingHours = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user.id;
      const workingHours: Partial<WorkingHours> = req.body;

      const updatedProfile = await this.userService.updateWorkingHours(userId, workingHours);

      if (!updatedProfile) {
        res.status(404).json({
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { 
          profile: updatedProfile,
          workingHours: updatedProfile.workingHours 
        },
        message: 'Working hours updated successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Working hours update failed';
      
      if (errorMessage.includes('Invalid') || errorMessage.includes('must be')) {
        res.status(400).json({
          error: {
            message: errorMessage,
            code: 'VALIDATION_ERROR'
          }
        });
        return;
      }

      if (errorMessage.includes('User not found')) {
        res.status(404).json({
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
        return;
      }

      res.status(500).json({
        error: {
          message: 'Internal server error during working hours update',
          code: 'UPDATE_WORKING_HOURS_ERROR'
        }
      });
    }
  };

  /**
   * Update user preferences
   */
  updatePreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user.id;
      const preferences: Partial<UserPreferences> = req.body;

      const updatedProfile = await this.userService.updatePreferences(userId, preferences);

      if (!updatedProfile) {
        res.status(404).json({
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { 
          profile: updatedProfile,
          preferences: updatedProfile.preferences 
        },
        message: 'Preferences updated successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Preferences update failed';
      
      if (errorMessage.includes('Invalid') || errorMessage.includes('must be')) {
        res.status(400).json({
          error: {
            message: errorMessage,
            code: 'VALIDATION_ERROR'
          }
        });
        return;
      }

      if (errorMessage.includes('User not found')) {
        res.status(404).json({
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
        return;
      }

      res.status(500).json({
        error: {
          message: 'Internal server error during preferences update',
          code: 'UPDATE_PREFERENCES_ERROR'
        }
      });
    }
  };

  /**
   * Get encrypted preferences (for secure client-side storage)
   */
  getEncryptedPreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user.id;
      const encryptedPreferences = await this.userService.getEncryptedPreferences(userId);

      if (!encryptedPreferences) {
        res.status(404).json({
          error: {
            message: 'User preferences not found',
            code: 'PREFERENCES_NOT_FOUND'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { encryptedPreferences },
        message: 'Encrypted preferences retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: {
          message: 'Internal server error while retrieving encrypted preferences',
          code: 'GET_ENCRYPTED_PREFERENCES_ERROR'
        }
      });
    }
  };

  /**
   * Update preferences from encrypted data
   */
  updateFromEncryptedPreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user.id;
      const { encryptedPreferences } = req.body;

      if (!encryptedPreferences) {
        res.status(400).json({
          error: {
            message: 'Encrypted preferences data is required',
            code: 'MISSING_ENCRYPTED_DATA'
          }
        });
        return;
      }

      const updatedProfile = await this.userService.updateFromEncryptedPreferences(userId, encryptedPreferences);

      if (!updatedProfile) {
        res.status(404).json({
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { profile: updatedProfile },
        message: 'Preferences updated from encrypted data successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Encrypted preferences update failed';
      
      if (errorMessage.includes('Failed to decrypt')) {
        res.status(400).json({
          error: {
            message: 'Invalid encrypted preferences data',
            code: 'INVALID_ENCRYPTED_DATA'
          }
        });
        return;
      }

      res.status(500).json({
        error: {
          message: 'Internal server error during encrypted preferences update',
          code: 'UPDATE_ENCRYPTED_PREFERENCES_ERROR'
        }
      });
    }
  };

  /**
   * Delete user account
   */
  deleteAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user.id;
      const deleted = await this.userService.deleteAccount(userId);

      if (!deleted) {
        res.status(404).json({
          error: {
            message: 'User not found',
            code: 'USER_NOT_FOUND'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: {
          message: 'Internal server error during account deletion',
          code: 'DELETE_ACCOUNT_ERROR'
        }
      });
    }
  };
}