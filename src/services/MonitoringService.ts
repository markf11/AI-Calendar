import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorMetric {
  error: Error;
  operation: string;
  timestamp: Date;
  userId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface UserAnalyticsEvent {
  userId: string;
  event: string;
  timestamp: Date;
  properties?: Record<string, any>;
}

class MonitoringService {
  private performanceMetrics: PerformanceMetric[] = [];
  private errorMetrics: ErrorMetric[] = [];
  private userAnalytics: UserAnalyticsEvent[] = [];
  private alertThresholds = {
    apiResponseTime: 1000, // ms
    schedulingOperationTime: 2000, // ms
    errorRate: 0.05, // 5%
    criticalErrorCount: 5 // per hour
  };

  // Performance monitoring
  public trackPerformance(operation: string, userId?: string, metadata?: Record<string, any>) {
    const startTime = performance.now();
    
    return {
      end: () => {
        const duration = performance.now() - startTime;
        const metric: PerformanceMetric = {
          operation,
          duration,
          timestamp: new Date(),
          userId,
          metadata
        };
        
        this.performanceMetrics.push(metric);
        this.checkPerformanceAlerts(metric);
        
        return duration;
      }
    };
  }

  // Error tracking
  public trackError(error: Error, operation: string, severity: ErrorMetric['severity'], userId?: string, metadata?: Record<string, any>) {
    const errorMetric: ErrorMetric = {
      error,
      operation,
      timestamp: new Date(),
      userId,
      severity,
      metadata
    };
    
    this.errorMetrics.push(errorMetric);
    this.checkErrorAlerts(errorMetric);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${severity.toUpperCase()}] ${operation}:`, error.message);
      if (metadata) {
        console.error('Metadata:', metadata);
      }
    }
  }

  // User analytics
  public trackUserEvent(userId: string, event: string, properties?: Record<string, any>) {
    const analyticsEvent: UserAnalyticsEvent = {
      userId,
      event,
      timestamp: new Date(),
      properties
    };
    
    this.userAnalytics.push(analyticsEvent);
  }

  // Express middleware for API response time monitoring
  public apiResponseTimeMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const tracker = this.trackPerformance(`API_${req.method}_${req.route?.path || req.path}`, req.user?.id, {
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent')
      });
      
      res.on('finish', () => {
        const duration = tracker.end();
        
        // Track additional response metrics
        this.trackUserEvent(req.user?.id || 'anonymous', 'api_request', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration
        });
      });
      
      next();
    };
  }

  // Get performance statistics
  public getPerformanceStats(operation?: string, timeRange?: { start: Date; end: Date }) {
    let metrics = this.performanceMetrics;
    
    if (operation) {
      metrics = metrics.filter(m => m.operation === operation);
    }
    
    if (timeRange) {
      metrics = metrics.filter(m => 
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }
    
    if (metrics.length === 0) {
      return null;
    }
    
    const durations = metrics.map(m => m.duration);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const p95 = this.calculatePercentile(durations, 95);
    const p99 = this.calculatePercentile(durations, 99);
    
    return {
      count: metrics.length,
      average: avg,
      min,
      max,
      p95,
      p99,
      operation
    };
  }

  // Get error statistics
  public getErrorStats(timeRange?: { start: Date; end: Date }) {
    let errors = this.errorMetrics;
    
    if (timeRange) {
      errors = errors.filter(e => 
        e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
      );
    }
    
    const totalErrors = errors.length;
    const errorsBySeverity = errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const errorsByOperation = errors.reduce((acc, error) => {
      acc[error.operation] = (acc[error.operation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalErrors,
      errorsBySeverity,
      errorsByOperation,
      recentErrors: errors.slice(-10) // Last 10 errors
    };
  }

  // Get user analytics
  public getUserAnalytics(timeRange?: { start: Date; end: Date }) {
    let events = this.userAnalytics;
    
    if (timeRange) {
      events = events.filter(e => 
        e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
      );
    }
    
    const uniqueUsers = new Set(events.map(e => e.userId)).size;
    const eventsByType = events.reduce((acc, event) => {
      acc[event.event] = (acc[event.event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const activeUsers = events.filter(e => 
      e.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    const dailyActiveUsers = new Set(activeUsers.map(e => e.userId)).size;
    
    return {
      totalEvents: events.length,
      uniqueUsers,
      dailyActiveUsers,
      eventsByType,
      recentEvents: events.slice(-20) // Last 20 events
    };
  }

  // Alert checking
  private checkPerformanceAlerts(metric: PerformanceMetric) {
    if (metric.operation.startsWith('API_') && metric.duration > this.alertThresholds.apiResponseTime) {
      this.sendAlert('performance', `Slow API response: ${metric.operation} took ${metric.duration}ms`, 'medium');
    }
    
    if (metric.operation.includes('scheduling') && metric.duration > this.alertThresholds.schedulingOperationTime) {
      this.sendAlert('performance', `Slow scheduling operation: ${metric.operation} took ${metric.duration}ms`, 'high');
    }
  }

  private checkErrorAlerts(errorMetric: ErrorMetric) {
    if (errorMetric.severity === 'critical') {
      this.sendAlert('error', `Critical error in ${errorMetric.operation}: ${errorMetric.error.message}`, 'critical');
    }
    
    // Check error rate in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentErrors = this.errorMetrics.filter(e => e.timestamp > oneHourAgo);
    const recentCriticalErrors = recentErrors.filter(e => e.severity === 'critical');
    
    if (recentCriticalErrors.length >= this.alertThresholds.criticalErrorCount) {
      this.sendAlert('error', `High critical error rate: ${recentCriticalErrors.length} critical errors in the last hour`, 'critical');
    }
  }

  private sendAlert(type: string, message: string, severity: string) {
    // In a real implementation, this would send to external alerting systems
    console.error(`[ALERT] [${severity.toUpperCase()}] [${type}] ${message}`);
    
    // Could integrate with services like:
    // - PagerDuty
    // - Slack
    // - Email notifications
    // - SMS alerts
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  // Cleanup old metrics to prevent memory leaks
  public cleanupOldMetrics(retentionDays: number = 7) {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    this.performanceMetrics = this.performanceMetrics.filter(m => m.timestamp > cutoffDate);
    this.errorMetrics = this.errorMetrics.filter(e => e.timestamp > cutoffDate);
    this.userAnalytics = this.userAnalytics.filter(e => e.timestamp > cutoffDate);
  }
}

export const monitoringService = new MonitoringService();