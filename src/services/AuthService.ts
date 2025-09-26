import { UserRepository } from '@/repositories/UserRepository';
import { RefreshTokenRepository, RefreshTokenData } from '@/repositories/RefreshTokenRepository';
import { AuthUtils, TokenPair } from '@/utils/auth';
import { CreateUserRequest, LoginRequest, LoginResponse, UserAuthData } from '@/models/User';
import { config } from '@/config/environment';

export interface RegisterRequest extends CreateUserRequest {
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export class AuthService {
  private userRepository: UserRepository;
  private refreshTokenRepository: RefreshTokenRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.refreshTokenRepository = new RefreshTokenRepository();
  }

  /**
   * Register a new user
   */
  async register(registerData: RegisterRequest): Promise<LoginResponse> {
    // Validate input
    if (registerData.password !== registerData.confirmPassword) {
      throw new Error('Passwords do not match');
    }

    // Validate password strength
    const passwordValidation = AuthUtils.validatePassword(registerData.password);
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    // Check if email already exists
    const emailExists = await this.userRepository.emailExists(registerData.email);
    if (emailExists) {
      throw new Error('Email already registered');
    }

    // Hash password
    const passwordHash = await AuthUtils.hashPassword(registerData.password);

    // Create user
    const user = await this.userRepository.create({
      email: registerData.email,
      name: registerData.name,
      timezone: registerData.timezone,
      password: registerData.password,
      passwordHash
    });

    // Generate tokens
    const userAuthData: UserAuthData = {
      id: user.id,
      email: user.email,
      name: user.name
    };

    const tokens = AuthUtils.generateTokens(userAuthData);

    // Store refresh token
    await this.storeRefreshToken(tokens.refreshToken, userAuthData);

    return {
      user: userAuthData,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn
    };
  }

  /**
   * Login user
   */
  async login(loginData: LoginRequest): Promise<LoginResponse> {
    // Get user credentials
    const userCredentials = await this.userRepository.getUserCredentials(loginData.email);
    if (!userCredentials) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await AuthUtils.verifyPassword(loginData.password, userCredentials.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const userAuthData: UserAuthData = {
      id: userCredentials.id,
      email: userCredentials.email,
      name: userCredentials.name
    };

    const tokens = AuthUtils.generateTokens(userAuthData);

    // Store refresh token
    await this.storeRefreshToken(tokens.refreshToken, userAuthData);

    return {
      user: userAuthData,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    // Verify refresh token
    let tokenPayload;
    try {
      tokenPayload = AuthUtils.verifyRefreshToken(refreshToken);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }

    // Check if refresh token exists in storage
    const tokenData = await this.refreshTokenRepository.get(refreshToken);
    if (!tokenData) {
      throw new Error('Refresh token not found or expired');
    }

    // Verify user still exists
    const userAuthData = await this.userRepository.getUserAuthData(tokenPayload.userId);
    if (!userAuthData) {
      // User was deleted, clean up the token
      await this.refreshTokenRepository.delete(refreshToken);
      throw new Error('User not found');
    }

    // Generate new access token
    const newTokens = AuthUtils.generateTokens(userAuthData);

    return {
      accessToken: newTokens.accessToken,
      expiresIn: newTokens.expiresIn
    };
  }

  /**
   * Logout user (invalidate refresh token)
   */
  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokenRepository.delete(refreshToken);
  }

  /**
   * Logout from all devices (invalidate all refresh tokens for user)
   */
  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepository.deleteAllForUser(userId);
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, changePasswordData: ChangePasswordRequest): Promise<void> {
    // Validate input
    if (changePasswordData.newPassword !== changePasswordData.confirmPassword) {
      throw new Error('New passwords do not match');
    }

    // Validate new password strength
    const passwordValidation = AuthUtils.validatePassword(changePasswordData.newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    // Get user credentials to verify current password
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const userCredentials = await this.userRepository.getUserCredentials(user.email);
    if (!userCredentials) {
      throw new Error('User credentials not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await AuthUtils.verifyPassword(
      changePasswordData.currentPassword,
      userCredentials.passwordHash
    );
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await AuthUtils.hashPassword(changePasswordData.newPassword);

    // Update password
    const updated = await this.userRepository.updatePassword(userId, newPasswordHash);
    if (!updated) {
      throw new Error('Failed to update password');
    }

    // Invalidate all refresh tokens to force re-login on all devices
    await this.refreshTokenRepository.deleteAllForUser(userId);
  }

  /**
   * Verify access token and return user data
   */
  async verifyAccessToken(token: string): Promise<UserAuthData> {
    const tokenPayload = AuthUtils.verifyAccessToken(token);
    
    // Verify user still exists
    const userAuthData = await this.userRepository.getUserAuthData(tokenPayload.userId);
    if (!userAuthData) {
      throw new Error('User not found');
    }

    return userAuthData;
  }

  /**
   * Store refresh token with expiration
   */
  private async storeRefreshToken(refreshToken: string, userAuthData: UserAuthData): Promise<void> {
    const expirationTime = this.parseExpirationTime(config.jwt.refreshExpiresIn);
    const expiresAt = new Date(Date.now() + expirationTime * 1000);

    const tokenData: RefreshTokenData = {
      userId: userAuthData.id,
      email: userAuthData.email,
      createdAt: new Date(),
      expiresAt
    };

    await this.refreshTokenRepository.store(refreshToken, tokenData);
  }

  /**
   * Parse expiration time string to seconds
   */
  private parseExpirationTime(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error('Invalid expiration time format');
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 60 * 60 * 24;
      default: throw new Error('Invalid time unit');
    }
  }
}