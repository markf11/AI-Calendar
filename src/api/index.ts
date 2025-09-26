import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from '@/config/environment';
import routes from './routes';
import { handleAuthError } from './middleware/auth';

export function createApp(): express.Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
      error: {
        message: 'Too many requests from this IP, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
      }
    },
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api/', limiter);

  // Body parsing middleware
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API routes
  app.use('/api', routes);

  // Auth error handling middleware
  app.use(handleAuthError);

  // Global error handler
  app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', error);
    
    res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  });

  // 404 handler
  app.use('*', (req: express.Request, res: express.Response) => {
    res.status(404).json({
      error: {
        message: 'Route not found',
        code: 'ROUTE_NOT_FOUND'
      }
    });
  });

  return app;
}