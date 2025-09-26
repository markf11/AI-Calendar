import request from 'supertest';
import express from 'express';
import monitoringRoutes from '../api/routes/monitoring';
import { monitoringService } from '../services/MonitoringService';
import { analyticsService } from '../services/AnalyticsService';

const app = express();
app.use(express.json());
app.use('/api/monitoring', monitoringRoutes);

// Mock authentication middleware for testing
jest.mock('../api/middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user' };
    next();
  }
}));

describe('Monitoring API Integration', () => {
  beforeEach(() => {
    // Clear metrics before each test
    monitoringService.cleanupOldMetrics(0);
    analyticsService.cleanupOldData(0);
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/monitoring/health')
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
      expect(response.body.uptime).toBeGreaterThan(0);
      expect(response.body.memory).toBeDefined();
    });
  });

  describe('Performance Metrics', () => {
    it('should return performance metrics', async () => {
      // Add some test metrics
      const tracker = monitoringService.trackPerformance('test_api_call');
      tracker.end();
      
      const response = await request(app)
        .get('/api/monitoring/performance')
        .expect(200);
      
      expect(response.body).toBeDefined();
    });

    it('should filter performance metrics by operation', async () => {
      const tracker1 = monitoringService.trackPerformance('operation_a');
      tracker1.end();
      
      const tracker2 = monitoringService.trackPerformance('operation_b');
      tracker2.end();
      
      const response = await request(app)
        .get('/api/monitoring/performance?operation=operation_a')
        .expect(200);
      
      expect(response.body.operation).toBe('operation_a');
      expect(response.body.count).toBe(1);
    });

    it('should filter performance metrics by date range', async () => {
      const tracker = monitoringService.trackPerformance('date_test');
      tracker.end();
      
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const response = await request(app)
        .get(`/api/monitoring/performance?startDate=${oneHourAgo.toISOString()}&endDate=${now.toISOString()}`)
        .expect(200);
      
      expect(response.body).toBeDefined();
    });
  });

  describe('Error Statistics', () => {
    it('should return error statistics', async () => {
      // Add some test errors
      monitoringService.trackError(new Error('Test error'), 'test_operation', 'medium');
      
      const response = await request(app)
        .get('/api/monitoring/errors')
        .expect(200);
      
      expect(response.body.totalErrors).toBe(1);
      expect(response.body.errorsBySeverity.medium).toBe(1);
    });
  });

  describe('User Analytics', () => {
    it('should return user analytics', async () => {
      // Add some test user events
      monitoringService.trackUserEvent('user123', 'test_event');
      
      const response = await request(app)
        .get('/api/monitoring/analytics/users')
        .expect(200);
      
      expect(response.body.totalEvents).toBe(1);
      expect(response.body.uniqueUsers).toBe(1);
    });
  });

  describe('Feature Adoption', () => {
    it('should return feature adoption metrics', async () => {
      // Add some test feature usage
      analyticsService.trackFeatureUsage('test_feature', 'user123', true);
      
      const response = await request(app)
        .get('/api/monitoring/analytics/features')
        .expect(200);
      
      expect(response.body.test_feature).toBeDefined();
      expect(response.body.test_feature.totalUsage).toBe(1);
    });
  });

  describe('Scheduling Performance', () => {
    it('should return scheduling performance metrics', async () => {
      // Add some test scheduling metrics
      analyticsService.trackSchedulingOperation('user123', 'create_task', 5, 150, true, 2);
      
      const response = await request(app)
        .get('/api/monitoring/analytics/scheduling')
        .expect(200);
      
      expect(response.body.create_task).toBeDefined();
      expect(response.body.create_task.count).toBe(1);
    });
  });

  describe('User Engagement', () => {
    it('should return user engagement metrics', async () => {
      // Add some test engagement data
      analyticsService.trackFeatureUsage('feature1', 'user123', true);
      analyticsService.trackFeatureUsage('feature2', 'user123', true);
      
      const response = await request(app)
        .get('/api/monitoring/analytics/engagement')
        .expect(200);
      
      expect(response.body.user123).toBeDefined();
      expect(response.body.user123.totalActions).toBe(2);
    });
  });
});