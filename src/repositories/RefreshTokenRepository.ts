import { Redis } from 'ioredis';
import { RedisClient } from '@/config/redis';
import { config } from '@/config/environment';

export interface RefreshTokenData {
  userId: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
}

export class RefreshTokenRepository {
  private redis: Redis;
  private keyPrefix: string;

  constructor() {
    this.redis = RedisClient.getInstance().getClient();
    this.keyPrefix = `${config.redis.keyPrefix}refresh_token:`;
  }

  /**
   * Store a refresh token
   */
  async store(token: string, data: RefreshTokenData): Promise<void> {
    const key = this.getKey(token);
    const ttl = Math.floor((data.expiresAt.getTime() - Date.now()) / 1000);
    
    if (ttl <= 0) {
      throw new Error('Token already expired');
    }

    await this.redis.setex(
      key,
      ttl,
      JSON.stringify({
        userId: data.userId,
        email: data.email,
        createdAt: data.createdAt.toISOString(),
        expiresAt: data.expiresAt.toISOString()
      })
    );
  }

  /**
   * Retrieve refresh token data
   */
  async get(token: string): Promise<RefreshTokenData | null> {
    const key = this.getKey(token);
    const data = await this.redis.get(key);
    
    if (!data) {
      return null;
    }

    try {
      const parsed = JSON.parse(data);
      return {
        userId: parsed.userId,
        email: parsed.email,
        createdAt: new Date(parsed.createdAt),
        expiresAt: new Date(parsed.expiresAt)
      };
    } catch (error) {
      // Invalid data format, remove the key
      await this.redis.del(key);
      return null;
    }
  }

  /**
   * Delete a refresh token
   */
  async delete(token: string): Promise<boolean> {
    const key = this.getKey(token);
    const result = await this.redis.del(key);
    return result > 0;
  }

  /**
   * Delete all refresh tokens for a user
   */
  async deleteAllForUser(userId: string): Promise<number> {
    const pattern = `${this.keyPrefix}*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) {
      return 0;
    }

    // Get all token data and filter by userId
    const pipeline = this.redis.pipeline();
    keys.forEach(key => pipeline.get(key));
    const results = await pipeline.exec();

    const keysToDelete: string[] = [];
    
    if (results) {
      for (let i = 0; i < results.length; i++) {
        const [error, data] = results[i];
        if (!error && data) {
          try {
            const parsed = JSON.parse(data as string);
            if (parsed.userId === userId) {
              keysToDelete.push(keys[i]);
            }
          } catch {
            // Invalid data, mark for deletion
            keysToDelete.push(keys[i]);
          }
        }
      }
    }

    if (keysToDelete.length === 0) {
      return 0;
    }

    const deleteResult = await this.redis.del(...keysToDelete);
    return deleteResult;
  }

  /**
   * Check if a refresh token exists and is valid
   */
  async exists(token: string): Promise<boolean> {
    const key = this.getKey(token);
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * Get remaining TTL for a refresh token
   */
  async getTTL(token: string): Promise<number> {
    const key = this.getKey(token);
    return this.redis.ttl(key);
  }

  /**
   * Clean up expired tokens (Redis handles this automatically, but this can be used for manual cleanup)
   */
  async cleanupExpired(): Promise<number> {
    const pattern = `${this.keyPrefix}*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) {
      return 0;
    }

    // Check TTL for each key and remove those that are expired or have no TTL
    const pipeline = this.redis.pipeline();
    keys.forEach(key => pipeline.ttl(key));
    const results = await pipeline.exec();

    const keysToDelete: string[] = [];
    
    if (results) {
      for (let i = 0; i < results.length; i++) {
        const [error, ttl] = results[i];
        if (!error && (ttl === -1 || ttl === -2)) {
          // -1 means no expiration set, -2 means key doesn't exist
          keysToDelete.push(keys[i]);
        }
      }
    }

    if (keysToDelete.length === 0) {
      return 0;
    }

    const deleteResult = await this.redis.del(...keysToDelete);
    return deleteResult;
  }

  /**
   * Generate Redis key for refresh token
   */
  private getKey(token: string): string {
    return `${this.keyPrefix}${token}`;
  }
}