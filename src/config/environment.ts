import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface EnvironmentConfig {
  // Server configuration
  port: number;
  nodeEnv: string;
  
  // Database configuration
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
    maxConnections: number;
  };
  
  // Redis configuration
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
  };
  
  // JWT configuration
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  
  // External API configuration
  google: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    webhookUrl: string;
  };
  
  microsoft: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    tenantId: string;
    webhookUrl: string;
  };
  
  // Security configuration
  encryption: {
    key: string;
    algorithm: string;
  };
  
  // Rate limiting
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  
  // CORS configuration
  cors: {
    origin: string[];
    credentials: boolean;
  };
}

const getEnvironmentConfig = (): EnvironmentConfig => {
  const requiredEnvVars = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'ENCRYPTION_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'MICROSOFT_CLIENT_ID',
    'MICROSOFT_CLIENT_SECRET',
    'MICROSOFT_TENANT_ID'
  ];

  // Check for required environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Required environment variable ${envVar} is not set`);
    }
  }

  return {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      name: process.env.DB_NAME || 'momentum',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      ssl: process.env.NODE_ENV === 'production',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    },
    
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'momentum:',
    },
    
    jwt: {
      secret: process.env.JWT_SECRET!,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET!,
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
      webhookUrl: process.env.GOOGLE_WEBHOOK_URL || 'http://localhost:3000/api/google-calendar/webhook',
    },
    
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      redirectUri: process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/auth/microsoft/callback',
      tenantId: process.env.MICROSOFT_TENANT_ID!,
      webhookUrl: process.env.MICROSOFT_WEBHOOK_URL || 'http://localhost:3000/api/microsoft-graph/webhook',
    },
    
    encryption: {
      key: process.env.ENCRYPTION_KEY!,
      algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-cbc',
    },
    
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    },
    
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
      credentials: process.env.CORS_CREDENTIALS === 'true',
    },
  };
};

export const config = getEnvironmentConfig();

export const isDevelopment = config.nodeEnv === 'development';
export const isProduction = config.nodeEnv === 'production';
export const isTest = config.nodeEnv === 'test';