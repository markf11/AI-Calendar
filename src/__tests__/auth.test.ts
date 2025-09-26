import { AuthUtils } from '@/utils/auth';
import { UserAuthData } from '@/models/User';

describe('AuthUtils', () => {
  const mockUser: UserAuthData = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User'
  };

  describe('Password hashing and verification', () => {
    it('should hash and verify passwords correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await AuthUtils.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      
      const isValid = await AuthUtils.verifyPassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await AuthUtils.verifyPassword('wrongpassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Token generation and verification', () => {
    it('should generate valid token pairs', () => {
      const tokens = AuthUtils.generateTokens(mockUser);
      
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBeGreaterThan(0);
    });

    it('should verify access tokens correctly', () => {
      const tokens = AuthUtils.generateTokens(mockUser);
      const payload = AuthUtils.verifyAccessToken(tokens.accessToken);
      
      expect(payload.userId).toBe(mockUser.id);
      expect(payload.email).toBe(mockUser.email);
      expect(payload.type).toBe('access');
    });

    it('should verify refresh tokens correctly', () => {
      const tokens = AuthUtils.generateTokens(mockUser);
      const payload = AuthUtils.verifyRefreshToken(tokens.refreshToken);
      
      expect(payload.userId).toBe(mockUser.id);
      expect(payload.email).toBe(mockUser.email);
      expect(payload.type).toBe('refresh');
    });

    it('should reject invalid tokens', () => {
      expect(() => {
        AuthUtils.verifyAccessToken('invalid-token');
      }).toThrow();
    });
  });

  describe('Password validation', () => {
    it('should validate strong passwords', () => {
      const result = AuthUtils.validatePassword('StrongPass123!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
      const result = AuthUtils.validatePassword('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should require uppercase letters', () => {
      const result = AuthUtils.validatePassword('lowercase123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should require lowercase letters', () => {
      const result = AuthUtils.validatePassword('UPPERCASE123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should require numbers', () => {
      const result = AuthUtils.validatePassword('NoNumbers!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should require special characters', () => {
      const result = AuthUtils.validatePassword('NoSpecial123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should require minimum length', () => {
      const result = AuthUtils.validatePassword('Short1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });
  });

  describe('Token extraction', () => {
    it('should extract token from Bearer header', () => {
      const token = 'sample-jwt-token';
      const header = `Bearer ${token}`;
      
      const extracted = AuthUtils.extractTokenFromHeader(header);
      expect(extracted).toBe(token);
    });

    it('should return null for invalid headers', () => {
      expect(AuthUtils.extractTokenFromHeader(undefined)).toBeNull();
      expect(AuthUtils.extractTokenFromHeader('Invalid header')).toBeNull();
      expect(AuthUtils.extractTokenFromHeader('Basic token')).toBeNull();
    });
  });
});