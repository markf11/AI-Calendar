import * as crypto from 'crypto';
import { config } from '../config/environment';

export class EncryptionUtils {
  private static readonly algorithm = config.encryption.algorithm;
  private static readonly key = Buffer.from(config.encryption.key, 'hex');

  /**
   * Encrypt sensitive data
   */
  static encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.key);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const result = {
      encrypted,
      iv: iv.toString('hex')
    };

    return JSON.stringify(result);
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedString: string): string {
    const encryptedData = JSON.parse(encryptedString);
    const decipher = crypto.createDecipher('aes-256-cbc', this.key);

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Hash password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    const bcrypt = require('bcryptjs');
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    const bcrypt = require('bcryptjs');
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generate secure random string
   */
  static generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate UUID v4
   */
  static generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Create HMAC signature
   */
  static createHMAC(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  static verifyHMAC(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.createHMAC(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Encrypt calendar tokens for storage
   */
  static encryptCalendarToken(token: string): string {
    return this.encrypt(token);
  }

  /**
   * Decrypt calendar tokens from storage
   */
  static decryptCalendarToken(encryptedToken: string): string {
    return this.decrypt(encryptedToken);
  }
}
// Individual function exports for backward compatibility
export const encrypt = EncryptionUtils.encrypt;
export const decrypt = EncryptionUtils.decrypt;
export const hashPassword = EncryptionUtils.hashPassword;
export const verifyPassword = EncryptionUtils.verifyPassword;