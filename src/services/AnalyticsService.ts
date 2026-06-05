import { monitoringService } from './MonitoringService';

export interface FeatureUsageMetric {
  feature: string;
  userId: string;
  timestamp: Date;
  duration?: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface SchedulingMetric {
  userId: string;
  operation: 'create_task' | 'reschedule' | 'complete_task' | 'dependency_add';
  timestamp: Date;
  taskCount: number;
  schedulingDuration: number;
  success: boolean;
  conflictsResolved: number;
}

class AnalyticsService {
  private featureUsage: FeatureUsageMetric[] = [];
  private schedulingMetrics: SchedulingMetric[] = [];

  // Track feature usage
  public trackFeatureUsage(feature: string, userId: string, success: boolean = true, duration?: number, metadata?: Record<string, any>) {
    const metric: FeatureUsageMetric = {
      feature,
      userId,
      timestamp: new Date(),
      duration,
      success,
      metadata
    };
    
    this.featureUsage.push(metric);
    
    // Also track in monitoring service
    monitoringService.trackUserEvent(userId, 'feature_usage', {
      feature,
      success,
      duration,
      ...metadata
    });
  }

  // Track scheduling operations
  public trackSchedulingOperation(
    userId: string,
    operation: SchedulingMetric['operation'],
    taskCount: number,
    schedulingDuration: number,
    success: boolean,
    conflictsResolved: number = 0
  ) {
    const metric: SchedulingMetric = {
      userId,
      operation,
      timestamp: new Date(),
      taskCount,
      schedulingDuration,
      success,
      conflictsResolved
    };
    
    this.schedulingMetrics.push(metric);
    
    // Track performance
    monitoringService.trackUserEvent(userId, 'scheduling_operation', {
      operation,
      taskCount,
      schedulingDuration,
      success,
      conflictsResolved
    });
  }

  // Get feature adoption metrics
  public getFeatureAdoption(timeRange?: { start: Date; end: Date }) {
    let usage = this.featureUsage;
    
    if (timeRange) {
      usage = usage.filter(u => 
        u.timestamp >= timeRange.start && u.timestamp <= timeRange.end
      );
    }
    
    const featureStats = usage.reduce((acc, metric) => {
      if (!acc[metric.feature]) {
        acc[metric.feature] = {
          totalUsage: 0,
          uniqueUsers: new Set(),
          successRate: 0,
          avgDuration: 0,
          totalDuration: 0
        };
      }
      
      acc[metric.feature].totalUsage++;
      acc[metric.feature].uniqueUsers.add(metric.userId);
      if (metric.duration) {
        acc[metric.feature].totalDuration += metric.duration;
      }
      
      return acc;
    }, {} as Record<string, any>);
    
    // Calculate success rates and average durations
    Object.keys(featureStats).forEach(feature => {
      const featureUsage = usage.filter(u => u.feature === feature);
      const successCount = featureUsage.filter(u => u.success).length;
      featureStats[feature].successRate = successCount / featureUsage.length;
      featureStats[feature].uniqueUsers = featureStats[feature].uniqueUsers.size;
      
      if (featureStats[feature].totalDuration > 0) {
        const durationsCount = featureUsage.filter(u => u.duration).length;
        featureStats[feature].avgDuration = featureStats[feature].totalDuration / durationsCount;
      }
    });
    
    return featureStats;
  }
 
  // Get scheduling performance metrics
  public getSchedulingPerformance(timeRange?: { start: Date; end: Date }) {
    let metrics = this.schedulingMetrics;
    
    if (timeRange) {
      metrics = metrics.filter(m => 
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }
    
    const operationStats = metrics.reduce((acc, metric) => {
      if (!acc[metric.operation]) {
        acc[metric.operation] = {
          count: 0,
          successRate: 0,
          avgDuration: 0,
          avgTaskCount: 0,
          totalConflictsResolved: 0
        };
      }
      
      acc[metric.operation].count++;
      acc[metric.operation].avgDuration += metric.schedulingDuration;
      acc[metric.operation].avgTaskCount += metric.taskCount;
      acc[metric.operation].totalConflictsResolved += metric.conflictsResolved;
      
      return acc;
    }, {} as Record<string, any>);
    
    // Calculate averages and success rates
    Object.keys(operationStats).forEach(operation => {
      const operationMetrics = metrics.filter(m => m.operation === operation);
      const successCount = operationMetrics.filter(m => m.success).length;
      
      operationStats[operation].successRate = successCount / operationMetrics.length;
      operationStats[operation].avgDuration /= operationMetrics.length;
      operationStats[operation].avgTaskCount /= operationMetrics.length;
    });
    
    return operationStats;
  }

  // Get user engagement metrics
  public getUserEngagement(timeRange?: { start: Date; end: Date }) {
    let usage = this.featureUsage;
    
    if (timeRange) {
      usage = usage.filter(u => 
        u.timestamp >= timeRange.start && u.timestamp <= timeRange.end
      );
    }
    
    const userStats = usage.reduce((acc, metric) => {
      if (!acc[metric.userId]) {
        acc[metric.userId] = {
          totalActions: 0,
          uniqueFeatures: new Set(),
          lastActivity: metric.timestamp,
          totalDuration: 0
        };
      }
      
      acc[metric.userId].totalActions++;
      acc[metric.userId].uniqueFeatures.add(metric.feature);
      if (metric.timestamp > acc[metric.userId].lastActivity) {
        acc[metric.userId].lastActivity = metric.timestamp;
      }
      if (metric.duration) {
        acc[metric.userId].totalDuration += metric.duration;
      }
      
      return acc;
    }, {} as Record<string, any>);
    
    // Convert sets to counts
    Object.keys(userStats).forEach(userId => {
      userStats[userId].uniqueFeatures = userStats[userId].uniqueFeatures.size;
    });
    
    return userStats;
  }

  // Cleanup old analytics data
  public cleanupOldData(retentionDays: number = 30) {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    this.featureUsage = this.featureUsage.filter(f => f.timestamp > cutoffDate);
    this.schedulingMetrics = this.schedulingMetrics.filter(s => s.timestamp > cutoffDate);
  }
}

export const analyticsService = new AnalyticsService();