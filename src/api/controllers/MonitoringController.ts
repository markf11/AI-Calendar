import { Request, Response } from 'express';
import { monitoringService } from '../../services/MonitoringService';
import { analyticsService } from '../../services/AnalyticsService';

export class MonitoringController {
  // Get system health status
  public async getHealthStatus(req: Request, res: Response) {
    try {
      const tracker = monitoringService.trackPerformance('health_check');
      
      // Check various system components
      const health = {
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
      };
      
      tracker.end();
      res.json(health);
    } catch (error) {
      monitoringService.trackError(error as Error, 'health_check', 'high');
      res.status(500).json({ error: 'Health check failed' });
    }
  }

  // Get performance metrics
  public async getPerformanceMetrics(req: Request, res: Response) {
    try {
      const { operation, startDate, endDate } = req.query;
      
      let timeRange;
      if (startDate && endDate) {
        timeRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }
      
      const stats = monitoringService.getPerformanceStats(
        operation as string,
        timeRange
      );
      
      res.json(stats);
    } catch (error) {
      monitoringService.trackError(error as Error, 'get_performance_metrics', 'medium');
      res.status(500).json({ error: 'Failed to get performance metrics' });
    }
  }

  // Get error statistics
  public async getErrorStats(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      let timeRange;
      if (startDate && endDate) {
        timeRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }
      
      const stats = monitoringService.getErrorStats(timeRange);
      res.json(stats);
    } catch (error) {
      monitoringService.trackError(error as Error, 'get_error_stats', 'medium');
      res.status(500).json({ error: 'Failed to get error statistics' });
    }
  }

  // Get user analytics
  public async getUserAnalytics(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      let timeRange;
      if (startDate && endDate) {
        timeRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }
      
      const analytics = monitoringService.getUserAnalytics(timeRange);
      res.json(analytics);
    } catch (error) {
      monitoringService.trackError(error as Error, 'get_user_analytics', 'medium');
      res.status(500).json({ error: 'Failed to get user analytics' });
    }
  }
}  /
/ Get feature adoption metrics
  public async getFeatureAdoption(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      let timeRange;
      if (startDate && endDate) {
        timeRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }
      
      const adoption = analyticsService.getFeatureAdoption(timeRange);
      res.json(adoption);
    } catch (error) {
      monitoringService.trackError(error as Error, 'get_feature_adoption', 'medium');
      res.status(500).json({ error: 'Failed to get feature adoption metrics' });
    }
  }

  // Get scheduling performance
  public async getSchedulingPerformance(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      let timeRange;
      if (startDate && endDate) {
        timeRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }
      
      const performance = analyticsService.getSchedulingPerformance(timeRange);
      res.json(performance);
    } catch (error) {
      monitoringService.trackError(error as Error, 'get_scheduling_performance', 'medium');
      res.status(500).json({ error: 'Failed to get scheduling performance metrics' });
    }
  }

  // Get user engagement metrics
  public async getUserEngagement(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      let timeRange;
      if (startDate && endDate) {
        timeRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }
      
      const engagement = analyticsService.getUserEngagement(timeRange);
      res.json(engagement);
    } catch (error) {
      monitoringService.trackError(error as Error, 'get_user_engagement', 'medium');
      res.status(500).json({ error: 'Failed to get user engagement metrics' });
    }
  }
}