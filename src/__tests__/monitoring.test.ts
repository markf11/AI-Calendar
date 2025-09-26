import { monitoringService } from '../services/MonitoringService';
import { analyticsService } from '../services/AnalyticsService';

describe('MonitoringService', () => {
  beforeEach(() => {
    // Clear metrics before each test
    monitoringService.cleanupOldMetrics(0);
  });

  describe('Performance Tracking', () => {
    it('should track performance metrics correctly', () => {
      const tracker = monitoringService.trackPerformance('test_operation', 'user123', { test: true });
      
      // Simulate some work
      setTimeout(() => {
        const duration = tracker.end();
        expect(duration).toBeGreaterThan(0);
      }, 10);
    });

    it('should calculate performance statistics', () => {
      // Add some test metrics
      const tracker1 = monitoringService.trackPerformance('api_test');
      tracker1.end();
      
      const tracker2 = monitoringService.trackPerformance('api_test');
      tracker2.end();
      
      const stats = monitoringService.getPerformanceStats('api_test');
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(2);
      expect(stats?.average).toBeGreaterThan(0);
    });

    it('should filter performance stats by time range', () => {
      const tracker = monitoringService.trackPerformance('time_test');
      tracker.end();
      
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      
      const stats = monitoringService.getPerformanceStats('time_test', {
        start: oneHourAgo,
        end: oneHourFromNow
      });
      
      expect(stats?.count).toBe(1);
    });
  });

  describe('Error Tracking', () => {
    it('should track errors with proper metadata', () => {
      const error = new Error('Test error');
      monitoringService.trackError(error, 'test_operation', 'medium', 'user123', { context: 'test' });
      
      const errorStats = monitoringService.getErrorStats();
      expect(errorStats.totalErrors).toBe(1);
      expect(errorStats.errorsBySeverity.medium).toBe(1);
      expect(errorStats.errorsByOperation.test_operation).toBe(1);
    });

    it('should track critical errors separately', () => {
      const error1 = new Error('Critical error');
      const error2 = new Error('Medium error');
      
      monitoringService.trackError(error1, 'critical_op', 'critical');
      monitoringService.trackError(error2, 'medium_op', 'medium');
      
      const errorStats = monitoringService.getErrorStats();
      expect(errorStats.errorsBySeverity.critical).toBe(1);
      expect(errorStats.errorsBySeverity.medium).toBe(1);
    });
  });

  describe('User Analytics', () => {
    it('should track user events', () => {
      monitoringService.trackUserEvent('user123', 'task_created', { taskType: 'work' });
      monitoringService.trackUserEvent('user456', 'task_completed', { duration: 30 });
      
      const analytics = monitoringService.getUserAnalytics();
      expect(analytics.totalEvents).toBe(2);
      expect(analytics.uniqueUsers).toBe(2);
      expect(analytics.eventsByType.task_created).toBe(1);
      expect(analytics.eventsByType.task_completed).toBe(1);
    });

    it('should calculate daily active users', () => {
      monitoringService.trackUserEvent('user123', 'login');
      monitoringService.trackUserEvent('user123', 'task_created');
      monitoringService.trackUserEvent('user456', 'login');
      
      const analytics = monitoringService.getUserAnalytics();
      expect(analytics.dailyActiveUsers).toBe(2);
    });
  });

  describe('API Response Time Middleware', () => {
    it('should create middleware function', () => {
      const middleware = monitoringService.apiResponseTimeMiddleware();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup old metrics', () => {
      const tracker = monitoringService.trackPerformance('cleanup_test');
      tracker.end();
      
      monitoringService.trackUserEvent('user123', 'test_event');
      
      // Cleanup with 0 retention days should remove all metrics
      monitoringService.cleanupOldMetrics(0);
      
      const stats = monitoringService.getPerformanceStats();
      const analytics = monitoringService.getUserAnalytics();
      
      expect(stats).toBeNull();
      expect(analytics.totalEvents).toBe(0);
    });
  });
});des
cribe('AnalyticsService', () => {
  beforeEach(() => {
    // Clear analytics data before each test
    analyticsService.cleanupOldData(0);
  });

  describe('Feature Usage Tracking', () => {
    it('should track feature usage correctly', () => {
      analyticsService.trackFeatureUsage('calendar_view', 'user123', true, 1500, { view: 'week' });
      analyticsService.trackFeatureUsage('task_creation', 'user123', true, 800);
      analyticsService.trackFeatureUsage('calendar_view', 'user456', false, 200);
      
      const adoption = analyticsService.getFeatureAdoption();
      
      expect(adoption.calendar_view.totalUsage).toBe(2);
      expect(adoption.calendar_view.uniqueUsers).toBe(2);
      expect(adoption.calendar_view.successRate).toBe(0.5);
      expect(adoption.task_creation.totalUsage).toBe(1);
      expect(adoption.task_creation.successRate).toBe(1);
    });

    it('should calculate average durations correctly', () => {
      analyticsService.trackFeatureUsage('feature_test', 'user123', true, 1000);
      analyticsService.trackFeatureUsage('feature_test', 'user123', true, 2000);
      
      const adoption = analyticsService.getFeatureAdoption();
      expect(adoption.feature_test.avgDuration).toBe(1500);
    });
  });

  describe('Scheduling Metrics', () => {
    it('should track scheduling operations', () => {
      analyticsService.trackSchedulingOperation('user123', 'create_task', 5, 150, true, 2);
      analyticsService.trackSchedulingOperation('user123', 'reschedule', 8, 300, true, 1);
      analyticsService.trackSchedulingOperation('user456', 'create_task', 3, 100, false, 0);
      
      const performance = analyticsService.getSchedulingPerformance();
      
      expect(performance.create_task.count).toBe(2);
      expect(performance.create_task.successRate).toBe(0.5);
      expect(performance.reschedule.count).toBe(1);
      expect(performance.reschedule.successRate).toBe(1);
    });

    it('should calculate scheduling averages', () => {
      analyticsService.trackSchedulingOperation('user123', 'test_op', 4, 200, true, 1);
      analyticsService.trackSchedulingOperation('user123', 'test_op', 6, 400, true, 3);
      
      const performance = analyticsService.getSchedulingPerformance();
      expect(performance.test_op.avgDuration).toBe(300);
      expect(performance.test_op.avgTaskCount).toBe(5);
      expect(performance.test_op.totalConflictsResolved).toBe(4);
    });
  });

  describe('User Engagement', () => {
    it('should track user engagement metrics', () => {
      analyticsService.trackFeatureUsage('feature1', 'user123', true, 1000);
      analyticsService.trackFeatureUsage('feature2', 'user123', true, 500);
      analyticsService.trackFeatureUsage('feature1', 'user456', true, 800);
      
      const engagement = analyticsService.getUserEngagement();
      
      expect(engagement.user123.totalActions).toBe(2);
      expect(engagement.user123.uniqueFeatures).toBe(2);
      expect(engagement.user123.totalDuration).toBe(1500);
      expect(engagement.user456.totalActions).toBe(1);
      expect(engagement.user456.uniqueFeatures).toBe(1);
    });

    it('should track last activity correctly', () => {
      const now = new Date();
      analyticsService.trackFeatureUsage('feature1', 'user123', true);
      
      // Simulate later activity
      setTimeout(() => {
        analyticsService.trackFeatureUsage('feature2', 'user123', true);
        
        const engagement = analyticsService.getUserEngagement();
        expect(engagement.user123.lastActivity).toBeInstanceOf(Date);
        expect(engagement.user123.lastActivity.getTime()).toBeGreaterThan(now.getTime());
      }, 10);
    });
  });

  describe('Time Range Filtering', () => {
    it('should filter metrics by time range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      
      analyticsService.trackFeatureUsage('test_feature', 'user123', true);
      
      const recentAdoption = analyticsService.getFeatureAdoption({
        start: oneHourAgo,
        end: now
      });
      
      const olderAdoption = analyticsService.getFeatureAdoption({
        start: twoHoursAgo,
        end: oneHourAgo
      });
      
      expect(recentAdoption.test_feature.totalUsage).toBe(1);
      expect(olderAdoption.test_feature).toBeUndefined();
    });
  });
});