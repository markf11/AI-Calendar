import Redis, { RedisOptions } from 'ioredis';

export interface RedisConfig extends RedisOptions {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
}

export const getRedisConfig = (): RedisConfig => {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'momentum:',
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
  };
};

export class RedisClient {
  private static instance: RedisClient;
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;

  private constructor() {
    const config = getRedisConfig();
    
    // Main Redis client for general operations
    this.client = new Redis(config);
    
    // Dedicated clients for pub/sub operations
    this.subscriber = new Redis(config);
    this.publisher = new Redis(config);

    this.setupEventHandlers();
  }

  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log('Redis client connected');
    });

    this.client.on('error', (err) => {
      console.error('Redis client error:', err);
    });

    this.subscriber.on('connect', () => {
      console.log('Redis subscriber connected');
    });

    this.publisher.on('connect', () => {
      console.log('Redis publisher connected');
    });
  }

  public getClient(): Redis {
    return this.client;
  }

  public getSubscriber(): Redis {
    return this.subscriber;
  }

  public getPublisher(): Redis {
    return this.publisher;
  }

  // Cache operations
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serializedValue = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, serializedValue);
    } else {
      await this.client.set(key, serializedValue);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Error parsing cached value:', error);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  // Hash operations for user sessions and preferences
  async hset(key: string, field: string, value: any): Promise<void> {
    await this.client.hset(key, field, JSON.stringify(value));
  }

  async hget<T>(key: string, field: string): Promise<T | null> {
    const value = await this.client.hget(key, field);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Error parsing hash value:', error);
      return null;
    }
  }

  async hgetall<T>(key: string): Promise<Record<string, T>> {
    const values = await this.client.hgetall(key);
    const result: Record<string, T> = {};
    
    for (const [field, value] of Object.entries(values)) {
      try {
        result[field] = JSON.parse(value) as T;
      } catch (error) {
        console.error(`Error parsing hash field ${field}:`, error);
      }
    }
    
    return result;
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.client.hdel(key, field);
  }

  // List operations for queues
  async lpush(key: string, value: any): Promise<void> {
    await this.client.lpush(key, JSON.stringify(value));
  }

  async rpop<T>(key: string): Promise<T | null> {
    const value = await this.client.rpop(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Error parsing queue value:', error);
      return null;
    }
  }

  async llen(key: string): Promise<number> {
    return await this.client.llen(key);
  }

  // Pub/Sub operations for real-time features
  async publish(channel: string, message: any): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    await this.subscriber.subscribe(channel);
    
    this.subscriber.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch (error) {
          console.error('Error parsing pub/sub message:', error);
        }
      }
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.subscriber.unsubscribe(channel);
  }

  // Set operations for tracking active users
  async sadd(key: string, member: string): Promise<void> {
    await this.client.sadd(key, member);
  }

  async srem(key: string, member: string): Promise<void> {
    await this.client.srem(key, member);
  }

  async smembers(key: string): Promise<string[]> {
    return await this.client.smembers(key);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.client.sismember(key, member);
    return result === 1;
  }

  // Cleanup and connection management
  async disconnect(): Promise<void> {
    await Promise.all([
      this.client.disconnect(),
      this.subscriber.disconnect(),
      this.publisher.disconnect()
    ]);
  }

  async flushdb(): Promise<void> {
    await this.client.flushdb();
  }
}

// Cache key generators for consistent naming
export const CacheKeys = {
  user: (userId: string) => `user:${userId}`,
  userPreferences: (userId: string) => `user:${userId}:preferences`,
  userSchedule: (userId: string, date: string) => `schedule:${userId}:${date}`,
  taskCache: (userId: string) => `tasks:${userId}`,
  projectCache: (userId: string) => `projects:${userId}`,
  calendarEvents: (userId: string, date: string) => `events:${userId}:${date}`,
  bookingAvailability: (linkId: string, date: string) => `booking:${linkId}:${date}`,
  activeUsers: () => 'active_users',
  userSession: (sessionId: string) => `session:${sessionId}`,
  reschedulingQueue: () => 'rescheduling_queue',
  notificationQueue: () => 'notification_queue',
};

// Pub/Sub channels for real-time features
export const PubSubChannels = {
  scheduleUpdated: (userId: string) => `schedule_updated:${userId}`,
  taskCompleted: (userId: string) => `task_completed:${userId}`,
  calendarSynced: (userId: string) => `calendar_synced:${userId}`,
  meetingBooked: (userId: string) => `meeting_booked:${userId}`,
  systemNotification: () => 'system_notification',
};