import { User } from '@/models/User';
import { Task } from '@/models/Task';
import { ValidationResult, ConflictReport, SchedulingConflict } from '@/models/types';
import { ScheduleValidationService } from './ScheduleValidationService';

/**
 * Service for generating and managing user alerts for scheduling conflicts
 * Provides specific recommendations and actionable suggestions
 */
export class UserAlertService {
  
  constructor(
    private scheduleValidationService: ScheduleValidationService
  ) {}

  /**
   * Generate comprehensive alert for scheduling conflicts
   */
  async generateSchedulingAlert(
    user: User,
    tasks: Task[],
    calendarEvents: any[]
  ): Promise<SchedulingAlert> {
    try {
      // Validate schedule and detect conflicts
      const [validationResult, conflictReport] = await Promise.all([
        this.scheduleValidationService.validateSchedule(user, tasks, calendarEvents),
        this.scheduleValidationService.detectConflicts(user, tasks, calendarEvents)
      ]);

      // Determine alert severity
      const severity = this.determineAlertSeverity(validationResult, conflictReport);

      // Generate alert message
      const message = this.generateAlertMessage(validationResult, conflictReport, severity);

      // Generate specific recommendations
      const recommendations = this.generateSpecificRecommendations(
        validationResult,
        conflictReport,
        tasks,
        user
      );

      // Generate quick actions
      const quickActions = this.generateQuickActions(validationResult, conflictReport, tasks);

      return {
        id: this.generateAlertId(),
        userId: user.id,
        severity,
        title: this.generateAlertTitle(severity, validationResult, conflictReport),
        message,
        recommendations,
        quickActions,
        affectedTasks: this.getAffectedTaskIds(validationResult, conflictReport, tasks),
        createdAt: new Date(),
        isResolved: false,
        metadata: {
          validationResult,
          conflictReport,
          totalViolations: validationResult.violations.length,
          totalConflicts: conflictReport.conflicts.length
        }
      };

    } catch (error) {
      return this.generateErrorAlert(user.id, error);
    }
  }

  /**
   * Generate alert for impossible scheduling scenarios
   */
  generateImpossibleScheduleAlert(
    userId: string,
    impossibleTasks: Task[],
    reason: string
  ): SchedulingAlert {
    const recommendations: AlertRecommendation[] = [
      {
        id: 'extend-deadlines',
        title: 'Extend Deadlines',
        description: 'Consider extending deadlines for tasks that cannot be completed on time',
        action: 'extend_deadlines',
        priority: 'high',
        affectedTaskIds: impossibleTasks.filter(t => t.deadline).map(t => t.id)
      },
      {
        id: 'break-down-tasks',
        title: 'Break Down Large Tasks',
        description: 'Split large tasks into smaller, more manageable parts',
        action: 'break_down_tasks',
        priority: 'medium',
        affectedTaskIds: impossibleTasks.filter(t => t.duration > 240).map(t => t.id)
      },
      {
        id: 'increase-working-hours',
        title: 'Increase Working Hours',
        description: 'Temporarily increase daily working hours to accommodate urgent tasks',
        action: 'adjust_working_hours',
        priority: 'medium',
        affectedTaskIds: []
      }
    ];

    return {
      id: this.generateAlertId(),
      userId,
      severity: 'error',
      title: 'Impossible Schedule Detected',
      message: `Cannot schedule ${impossibleTasks.length} tasks due to: ${reason}`,
      recommendations,
      quickActions: [
        {
          id: 'reschedule-all',
          label: 'Reschedule All Tasks',
          action: 'trigger_rescheduling',
          style: 'primary'
        },
        {
          id: 'review-deadlines',
          label: 'Review Deadlines',
          action: 'open_deadline_review',
          style: 'secondary'
        }
      ],
      affectedTasks: impossibleTasks.map(t => t.id),
      createdAt: new Date(),
      isResolved: false,
      metadata: {
        reason,
        impossibleTaskCount: impossibleTasks.length
      }
    };
  }

  /**
   * Generate alert for deadline conflicts
   */
  generateDeadlineConflictAlert(
    userId: string,
    conflictingTasks: Task[]
  ): SchedulingAlert {
    const hardDeadlineTasks = conflictingTasks.filter(t => t.isHardDeadline);
    const softDeadlineTasks = conflictingTasks.filter(t => !t.isHardDeadline);

    const recommendations: AlertRecommendation[] = [];

    if (hardDeadlineTasks.length > 0) {
      recommendations.push({
        id: 'prioritize-hard-deadlines',
        title: 'Prioritize Hard Deadlines',
        description: 'Focus on tasks with hard deadlines first',
        action: 'prioritize_tasks',
        priority: 'critical',
        affectedTaskIds: hardDeadlineTasks.map(t => t.id)
      });
    }

    if (softDeadlineTasks.length > 0) {
      recommendations.push({
        id: 'extend-soft-deadlines',
        title: 'Extend Soft Deadlines',
        description: 'Consider extending soft deadlines to create more scheduling flexibility',
        action: 'extend_deadlines',
        priority: 'medium',
        affectedTaskIds: softDeadlineTasks.map(t => t.id)
      });
    }

    return {
      id: this.generateAlertId(),
      userId,
      severity: hardDeadlineTasks.length > 0 ? 'error' : 'warning',
      title: 'Deadline Conflicts Detected',
      message: `${conflictingTasks.length} tasks may not meet their deadlines`,
      recommendations,
      quickActions: [
        {
          id: 'optimize-schedule',
          label: 'Optimize Schedule',
          action: 'optimize_for_deadlines',
          style: 'primary'
        },
        {
          id: 'view-timeline',
          label: 'View Timeline',
          action: 'open_timeline_view',
          style: 'secondary'
        }
      ],
      affectedTasks: conflictingTasks.map(t => t.id),
      createdAt: new Date(),
      isResolved: false,
      metadata: {
        hardDeadlineCount: hardDeadlineTasks.length,
        softDeadlineCount: softDeadlineTasks.length
      }
    };
  }

  /**
   * Generate alert for overallocation
   */
  generateOverallocationAlert(
    userId: string,
    totalHours: number,
    availableHours: number,
    overallocatedTasks: Task[]
  ): SchedulingAlert {
    const overallocation = totalHours - availableHours;
    const overallocationPercentage = Math.round((overallocation / availableHours) * 100);

    return {
      id: this.generateAlertId(),
      userId,
      severity: overallocationPercentage > 50 ? 'error' : 'warning',
      title: 'Schedule Overallocated',
      message: `You have ${totalHours.toFixed(1)} hours of work but only ${availableHours.toFixed(1)} hours available (${overallocationPercentage}% overallocated)`,
      recommendations: [
        {
          id: 'reduce-scope',
          title: 'Reduce Task Scope',
          description: 'Consider reducing the scope or duration of some tasks',
          action: 'reduce_task_scope',
          priority: 'high',
          affectedTaskIds: overallocatedTasks.slice(0, 5).map(t => t.id)
        },
        {
          id: 'delegate-tasks',
          title: 'Delegate Tasks',
          description: 'Consider delegating some tasks to team members',
          action: 'delegate_tasks',
          priority: 'medium',
          affectedTaskIds: overallocatedTasks.filter(t => t.priority === 'low').map(t => t.id)
        },
        {
          id: 'extend-timeline',
          title: 'Extend Project Timeline',
          description: 'Consider extending project deadlines to reduce pressure',
          action: 'extend_project_timeline',
          priority: 'medium',
          affectedTaskIds: []
        }
      ],
      quickActions: [
        {
          id: 'auto-prioritize',
          label: 'Auto-Prioritize',
          action: 'auto_prioritize_tasks',
          style: 'primary'
        },
        {
          id: 'working-hours',
          label: 'Adjust Working Hours',
          action: 'adjust_working_hours',
          style: 'secondary'
        }
      ],
      affectedTasks: overallocatedTasks.map(t => t.id),
      createdAt: new Date(),
      isResolved: false,
      metadata: {
        totalHours,
        availableHours,
        overallocation,
        overallocationPercentage
      }
    };
  }

  /**
   * Private helper methods
   */
  private determineAlertSeverity(
    validationResult: ValidationResult,
    conflictReport: ConflictReport
  ): AlertSeverity {
    const hasErrors = validationResult.violations.some(v => 
      v.includes('hard deadline') || 
      v.includes('Time conflict') ||
      v.includes('firm calendar event')
    );

    const hasCriticalConflicts = conflictReport.conflicts.some(c => 
      c.type === 'deadline_impossible' ||
      (c.type === 'time_overlap' && c.affectedTasks.length > 2)
    );

    if (hasErrors || hasCriticalConflicts) {
      return 'error';
    }

    if (validationResult.violations.length > 0 || conflictReport.conflicts.length > 0) {
      return 'warning';
    }

    return 'info';
  }

  private generateAlertTitle(
    severity: AlertSeverity,
    validationResult: ValidationResult,
    conflictReport: ConflictReport
  ): string {
    const totalIssues = validationResult.violations.length + conflictReport.conflicts.length;

    if (totalIssues === 0) {
      return 'Schedule Validated Successfully';
    }

    switch (severity) {
      case 'error':
        return 'Critical Scheduling Issues Detected';
      case 'warning':
        return 'Scheduling Issues Require Attention';
      default:
        return 'Schedule Review Recommended';
    }
  }

  private generateAlertMessage(
    validationResult: ValidationResult,
    conflictReport: ConflictReport,
    severity: AlertSeverity
  ): string {
    const violationCount = validationResult.violations.length;
    const conflictCount = conflictReport.conflicts.length;

    if (violationCount === 0 && conflictCount === 0) {
      return 'Your schedule is valid and optimized. All tasks are properly scheduled within your constraints.';
    }

    let message = '';

    if (violationCount > 0) {
      message += `Found ${violationCount} scheduling violation${violationCount > 1 ? 's' : ''}`;
    }

    if (conflictCount > 0) {
      if (message) message += ' and ';
      message += `${conflictCount} scheduling conflict${conflictCount > 1 ? 's' : ''}`;
    }

    message += '. ';

    switch (severity) {
      case 'error':
        message += 'Immediate action required to resolve critical issues.';
        break;
      case 'warning':
        message += 'Review recommended to optimize your schedule.';
        break;
      default:
        message += 'Minor adjustments may improve your schedule.';
    }

    return message;
  }

  private generateSpecificRecommendations(
    validationResult: ValidationResult,
    conflictReport: ConflictReport,
    tasks: Task[],
    user: User
  ): AlertRecommendation[] {
    const recommendations: AlertRecommendation[] = [];

    // Add recommendations based on validation violations
    if (validationResult.violations.some(v => v.includes('working hours'))) {
      recommendations.push({
        id: 'adjust-working-hours',
        title: 'Adjust Working Hours',
        description: 'Some tasks are scheduled outside your working hours',
        action: 'adjust_working_hours',
        priority: 'medium',
        affectedTaskIds: []
      });
    }

    if (validationResult.violations.some(v => v.includes('firm calendar event'))) {
      recommendations.push({
        id: 'resolve-calendar-conflicts',
        title: 'Resolve Calendar Conflicts',
        description: 'Tasks conflict with firm calendar events',
        action: 'reschedule_conflicting_tasks',
        priority: 'high',
        affectedTaskIds: []
      });
    }

    // Add recommendations based on conflicts
    const timeOverlapConflicts = conflictReport.conflicts.filter(c => c.type === 'time_overlap');
    if (timeOverlapConflicts.length > 0) {
      recommendations.push({
        id: 'resolve-time-conflicts',
        title: 'Resolve Time Conflicts',
        description: 'Multiple tasks are scheduled at the same time',
        action: 'auto_reschedule',
        priority: 'high',
        affectedTaskIds: timeOverlapConflicts.flatMap(c => c.affectedTasks)
      });
    }

    const deadlineConflicts = conflictReport.conflicts.filter(c => c.type === 'deadline_impossible');
    if (deadlineConflicts.length > 0) {
      recommendations.push({
        id: 'address-deadline-issues',
        title: 'Address Deadline Issues',
        description: 'Some tasks cannot be completed by their deadlines',
        action: 'review_deadlines',
        priority: 'critical',
        affectedTaskIds: deadlineConflicts.flatMap(c => c.affectedTasks)
      });
    }

    return recommendations;
  }

  private generateQuickActions(
    validationResult: ValidationResult,
    conflictReport: ConflictReport,
    tasks: Task[]
  ): QuickAction[] {
    const actions: QuickAction[] = [];

    if (validationResult.violations.length > 0 || conflictReport.conflicts.length > 0) {
      actions.push({
        id: 'auto-fix',
        label: 'Auto-Fix Issues',
        action: 'auto_fix_schedule',
        style: 'primary'
      });

      actions.push({
        id: 'manual-review',
        label: 'Manual Review',
        action: 'open_schedule_review',
        style: 'secondary'
      });
    }

    if (conflictReport.conflicts.some(c => c.type === 'time_overlap')) {
      actions.push({
        id: 'reschedule',
        label: 'Reschedule All',
        action: 'trigger_rescheduling',
        style: 'primary'
      });
    }

    return actions;
  }

  private getAffectedTaskIds(
    validationResult: ValidationResult,
    conflictReport: ConflictReport,
    tasks: Task[]
  ): string[] {
    const affectedIds = new Set<string>();

    // Add task IDs from conflicts
    conflictReport.conflicts.forEach(conflict => {
      conflict.affectedTasks.forEach(taskId => affectedIds.add(taskId));
    });

    // Add task IDs mentioned in violations (basic parsing)
    validationResult.violations.forEach(violation => {
      tasks.forEach(task => {
        if (violation.includes(`"${task.title}"`)) {
          affectedIds.add(task.id);
        }
      });
    });

    return Array.from(affectedIds);
  }

  private generateErrorAlert(userId: string, error: any): SchedulingAlert {
    return {
      id: this.generateAlertId(),
      userId,
      severity: 'error',
      title: 'Schedule Validation Error',
      message: `An error occurred while validating your schedule: ${error instanceof Error ? error.message : 'Unknown error'}`,
      recommendations: [{
        id: 'retry-validation',
        title: 'Retry Validation',
        description: 'Try validating your schedule again',
        action: 'retry_validation',
        priority: 'medium',
        affectedTaskIds: []
      }],
      quickActions: [{
        id: 'retry',
        label: 'Retry',
        action: 'retry_validation',
        style: 'primary'
      }],
      affectedTasks: [],
      createdAt: new Date(),
      isResolved: false,
      metadata: { error: error.message }
    };
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Supporting interfaces
export interface SchedulingAlert {
  id: string;
  userId: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  recommendations: AlertRecommendation[];
  quickActions: QuickAction[];
  affectedTasks: string[];
  createdAt: Date;
  isResolved: boolean;
  metadata: Record<string, any>;
}

export interface AlertRecommendation {
  id: string;
  title: string;
  description: string;
  action: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  affectedTaskIds: string[];
}

export interface QuickAction {
  id: string;
  label: string;
  action: string;
  style: 'primary' | 'secondary' | 'danger';
}

export type AlertSeverity = 'info' | 'warning' | 'error';