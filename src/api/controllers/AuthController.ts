import { Request, Response } from 'express';
import { AuthService, RegisterRequest, ChangePasswordRequest } from '@/services/AuthService';
import { LoginRequest } from '@/models/User';
import { AuthenticatedRequest } from '@/api/middleware/auth';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Register a new user
   */
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const registerData: RegisterRequest = req.body;
      const result = await this.authService.register(registerData);

      res.status(201).json({
        success: true,
        data: result,
        message: 'User registered successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      
      // Check for specific error types
      if (errorMessage.includes('Email already registered')) {
        res.status(409).json({
          error: {
            message: errorMessage,
            code: 'EMAIL_ALREADY_EXISTS'
          }
        });
        return;
      }

      if (errorMessage.includes('Password validation failed')) {
        res.status(400).json({
          error: {
            message: errorMessage,
            code: 'INVALID_PASSWORD'
          }
        });
        return;
      }

      if (errorMessage.includes('Passwords do not match')) {
        res.status(400).json({
          error: {
            message: errorMessage,
            code: 'PASSWORD_MISMATCH'
          }
        });
        return;
      }

      res.status(500).json({
        error: {
          message: 'Internal server error during registration',
          code: 'REGISTRATION_ERROR'
        }
      });
    }
  };

  /**
   * Login user
   */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const loginData: LoginRequest = req.body;
      const result = await this.authService.login(loginData);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Login successful'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      
      if (errorMessage.includes('Invalid email or password')) {
        res.status(401).json({
          error: {
            message: 'Invalid email or password',
            code: 'INVALID_CREDENTIALS'
          }
        });
        return;
      }

      res.status(500).json({
        error: {
          message: 'Internal server error during login',
          code: 'LOGIN_ERROR'
        }
      });
    }
  };

  /**
   * Refresh access token
   */
  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      const result = await this.authService.refreshToken(refreshToken);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Token refreshed successfully'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Token refresh failed';
      
      if (errorMessage.includes('Invalid refresh token') || 
          errorMessage.includes('Refresh token not found') ||
          errorMessage.includes('User not found')) {
        res.status(401).json({
          error: {
            message: 'Invalid or expired refresh token',
            code: 'INVALID_REFRESH_TOKEN'
          }
        });
        return;
      }

      res.status(500).json({
        error: {
          message: 'Internal server error during token refresh',
          code: 'TOKEN_REFRESH_ERROR'
        }
      });
    }
  };

  /**
   * Logout user
   */
  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      await this.authService.logout(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      // Even if logout fails, we should return success to the client
      // as the token might already be expired or invalid
      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });
    }
  };

  /**
   * Logout from all devices
   */
  logoutAll = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user.id;
      await this.authService.logoutAll(userId);

      res.status(200).json({
        success: true,
        message: 'Logged out from all devices successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: {
          message: 'Internal server error during logout',
          code: 'LOGOUT_ERROR'
        }
      });
    }
  };

  /**
   * Change user password
   */
  changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user.id;
      const changePasswordData: ChangePasswordRequest = req.body;
      
      await this.authService.changePassword(userId, changePasswordData);

      res.status(200).json({
        success: true,
        message: 'Password changed successfully. Please log in again on all devices.'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Password change failed';
      
      if (errorMessage.includes('Current password is incorrect')) {
        res.status(400).json({
          error: {
            message: errorMessage,
            code: 'INCORRECT_CURRENT_PASSWORD'
          }
        });
        return;
      }

      if (errorMessage.includes('Password validation failed')) {
        res.status(400).json({
          error: {
            message: errorMessage,
            code: 'INVALID_NEW_PASSWORD'
          }
        });
        return;
      }

      if (errorMessage.includes('New passwords do not match')) {
        res.status(400).json({
          error: {
            message: errorMessage,
            code: 'PASSWORD_MISMATCH'
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
          message: 'Internal server error during password change',
          code: 'PASSWORD_CHANGE_ERROR'
        }
      });
    }
  };

  /**
   * Get current user info (from token)
   */
  getCurrentUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      res.status(200).json({
        success: true,
        data: {
          user: req.user
        },
        message: 'User information retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: {
          message: 'Internal server error',
          code: 'GET_USER_ERROR'
        }
      });
    }
  };

  /**
   * Verify token endpoint (for client-side token validation)
   */
  verifyToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // If we reach here, the token is valid (middleware already verified it)
      res.status(200).json({
        success: true,
        data: {
          valid: true,
          user: req.user
        },
        message: 'Token is valid'
      });
    } catch (error) {
      res.status(401).json({
        error: {
          message: 'Invalid token',
          code: 'INVALID_TOKEN'
        }
      });
    }
  };
}