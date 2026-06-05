// @ts-nocheck
import { EventEmitter } from 'events';
import { Task } from '@/models/Task';
import { CalendarEvent } from '@/models/CalendarEvent';
import { User } from '@/models/User';
import { ScheduledSlot, AvailableSlot } from '@/models/types';
import { ConstraintCollection } from '@/models/Constraint';
import { ConstraintSatisfactionSolver, SolverResult } from './ConstraintSatisfactionSolver';
import { ConstraintCollectionService } from './ConstraintCollectionService';
import { TimeSlotGenerationService } from './TimeSlotGenerationService';
import { PriorityScoringService } from './PriorityScoringService';
import { TaskRepository } from '@/repositories/TaskRepository';
import { CalendarEventRepository } from '@/repositories/CalendarEventRepository';
import { UserRepository } from '@/repositories/UserRepository';

/**
 * Manages automatic rescheduling triggers and queue processing
 * Handles event listeners for calendar changes, task updates, and completions
 */
export class ReschedulingTriggerService extends EventEmitter {
  private reschedulingQueue: Map<string, ReschedulingJob> = new Map();
  private processingQueue: Set<string> = new Set();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  
  private readonly DEBOUNCE_DELAY_MS = 1000; // 1 second debounce
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 2000; // 2 seconds

  constructor(
    private constraintSatisfactionSolver: ConstraintSatisfactionSolver,
    private constraintCollectionService: ConstraintCollectionService,
    private timeSlotGenerationService: TimeSlotGenerationService,
    private taskRepository: TaskRepository,
    private calendarEventRepository: CalendarEventRepository,
    private userRepository: UserRepository
  ) {
    super();
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for automatic rescheduling triggers
   */
  private setupEventListeners(): void {
    // Task-related triggers
    this.on('task:created', this.handleTaskCreated.bind(this));
    this.on('task:updated', this.handleTaskUpdated.bind(this));
    this.on('task:completed', this.handleTaskCompleted.bind(this));
    this.on('task:deleted', this.handleTaskDeleted.bind(this));
    this.on('task:dependency:added', this.handleDependencyChanged.bind(this));
    this.on('task:dependency:removed', this.handleDependencyChanged.bind(this));

    // Calendar event triggers
    this.on('calendar:event:created', this.handleCalendarEventCreated.bind(this));
    this.on('calendar:event:updated', this.handleCalendarEventUpdated.bind(this));
    this.on('calendar:event:deleted', this.handleCalendarEventDeleted.bind(this));

    // User preference triggers
    this.on('user:preferences:updated', this.handleUserPreferencesUpdated.bind(this));
    this.on('user:working_hours:updated', this.handleWorkingHoursUpdated.bind(this));

    // Manual rescheduling triggers
    this.on('schedule:manual:trigger', this.handleManualRescheduling.bind(this));
  }

  /**
   * Trigger rescheduling for a user with debouncing
   */
  async triggerRescheduling(
    userId: string,
    trigger: RescheduleTrigger,
    priority: ReschedulingPriority = 'normal'
  ): Promise<void> {
    // Clear existing debounce timer
    const existingTimer = this.debounceTimers.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Create or update rescheduling job
    const job: ReschedulingJob = {
      userId,
      trigger,
      priority,
      createdAt: new Date(),
      retryCount: 0,
      status: 'pending'
    };

    this.reschedulingQueue.set(userId, job);

    // Set debounce timer based on priority
    const debounceDelay = priority === 'high' ? 500 : this.DEBOUNCE_DELAY_MS;
    
    const timer = setTimeout(() => {
      this.processReschedulingJob(userId);
      this.debounceTimers.delete(userId);
    }, debounceDelay);

    this.debounceTimers.set(userId, timer);

    this.emit('rescheduling:queued', { userId, trigger, priority });
  }

  /**
   * Process a rescheduling job
   */
  private async processReschedulingJob(userId: string): Promise<void> {
    const job = this.reschedulingQueue.get(userId);
    if (!job || this.processingQueue.has(userId)) {
      return;
    }

    this.processingQueue.add(userId);
    job.status = 'processing';
    job.startedAt = new Date();

    try {
      this.emit('rescheduling:started', { userId, trigger: job.trigger });

      const result = await this.performRescheduling(userId, job.trigger);

      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;

      this.emit('rescheduling:completed', { 
        userId, 
        trigger: job.trigger, 
        result,
        duration: job.completedAt.getTime() - job.startedAt!.getTime()
      });

      // Remove completed job from queue
      this.reschedulingQueue.delete(userId);

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.retryCount++;

      this.emit('rescheduling:failed', { 
        userId, 
        trigger: job.trigger, 
        error: job.error,
        retryCount: job.retryCount
      });

      // Retry logic
      if (job.retryCount < this.MAX_RETRIES) {
        setTimeout(() => {
          this.processReschedulingJob(userId);
        }, this.RETRY_DELAY_MS * job.retryCount);
      } else {
        this.emit('rescheduling:max_retries_exceeded', { userId, trigger: job.trigger });
        this.reschedulingQueue.delete(userId);
      }
    } finally {
      this.processingQueue.delete(userId);
    }
  }

  /**
   * Perform the actual rescheduling logic
   */
  private async performRescheduling(userId: string, trigger: RescheduleTrigger): Promise<SolverResult> {
    // Get user data
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Get all tasks that need scheduling
    const tasks = await this.taskRepository.findByUser(userId, {
      status: ['pending', 'scheduled', 'in_progress', 'blocked']
    });

    // Get calendar events (firm events)
    const calendarEvents = await this.calendarEventRepository.findByUser(userId);

    // Collect constraints
    const constraints = await this.constraintCollectionService.collectConstraints(
      user,
      calendarEvents,
      tasks
    );

    // Generate available time slots
    const availableSlots = await this.timeSlotGenerationService.generateAvailableSlots(
      user,
      constraints,
      new Date(), // Start from now
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days ahead
    );

    // Solve the scheduling problem
    const solverResult = await this.constraintSatisfactionSolver.solve(
      tasks,
      user,
      constraints,
      availableSlots,
      {
        allowSoftViolations: true,
        optimizeForEarlyCompletion: user.preferences.optimizeForEarlyCompletion,
        minimizeContextSwitching: user.preferences.groupSimilarTasks
      }
    );

    // Update task schedules in database if successful
    if (solverResult.success) {
      await this.updateTaskSchedules(userId, solverResult.scheduledTasks);
    }

    return solverResult;
  }

  /**
   * Update task schedules in the database
   */
  private async updateTaskSchedules(userId: string, scheduledSlots: ScheduledSlot[]): Promise<void> {
    for (const slot of scheduledSlots) {
      await this.taskRepository.updateScheduledSlots(slot.taskId, userId, [slot]);
    }
  }

  /**
   * Event handlers for different trigger types
   */
  private async handleTaskCreated(data: { userId: string; task: Task }): Promise<void> {
    await this.triggerRescheduling(data.userId, {
      type: 'task_created',
      entityId: data.task.id,
      timestamp: new Date(),
      metadata: { taskTitle: data.task.title }
    });
  }

  private async handleTaskUpdated(data: { userId: string; taskId: string; changes: Partial<Task> }): Promise<void> {
    // Determine priority based on what changed
    const priority = this.shouldTriggerHighPriorityRescheduling(data.changes) ? 'high' : 'normal';

    await this.triggerRescheduling(data.userId, {
      type: 'task_updated',
      entityId: data.taskId,
      timestamp: new Date(),
      metadata: { changes: Object.keys(data.changes) }
    }, priority);
  }

  private async handleTaskCompleted(data: { userId: string; taskId: string }): Promise<void> {
    await this.triggerRescheduling(data.userId, {
      type: 'task_completed',
      entityId: data.taskId,
      timestamp: new Date()
    }, 'high'); // High priority for completions to free up time quickly
  }

  private async handleTaskDeleted(data: { userId: string; taskId: string }): Promise<void> {
    await this.triggerRescheduling(data.userId, {
      type: 'task_deleted',
      entityId: data.taskId,
      timestamp: new Date()
    }, 'high');
  }

  private async handleDependencyChanged(data: { userId: string; taskId: string; dependencyId: string }): Promise<void> {
    await this.triggerRescheduling(data.userId, {
      type: 'dependency_changed',
      entityId: data.taskId,
      timestamp: new Date(),
      metadata: { dependencyId: data.dependencyId }
    });
  }

  private async handleCalendarEventCreated(data: { userId: string; event: CalendarEvent }): Promise<void> {
    await this.triggerRescheduling(data.userId, {
      type: 'calendar_event_created',
      entityId: data.event.id,
      timestamp: new Date(),
      metadata: { eventTitle: data.event.title }
    }, 'high'); // High priority for new firm events
  }

  private async handleCalendarEventUpdated(data: { userId: string; eventId: string; changes: Partial<CalendarEvent> }): Promise<void> {
    // High priority if time changed
    const priority = (data.changes.startTime || data.changes.endTime) ? 'high' : 'normal';

    await this.triggerRescheduling(data.userId, {
      type: 'calendar_event_updated',
      entityId: data.eventId,
      timestamp: new Date(),
      metadata: { changes: Object.keys(data.changes) }
    }, priority);
  }

  private async handleCalendarEventDeleted(data: { userId: string; eventId: string }): Promise<void> {
    await this.triggerRescheduling(data.userId, {
      type: 'calendar_event_deleted',
      entityId: data.eventId,
      timestamp: new Date()
    }, 'high');
  }

  private async handleUserPreferencesUpdated(data: { userId: string; changes: any }): Promise<void> {
    await this.triggerRescheduling(data.userId, {
      type: 'user_preferences_updated',
      entityId: data.userId,
      timestamp: new Date(),
      metadata: { changes: Object.keys(data.changes) }
    });
  }

  private async handleWorkingHoursUpdated(data: { userId: string }): Promise<void> {
    await this.triggerRescheduling(data.userId, {
      type: 'working_hours_updated',
      entityId: data.userId,
      timestamp: new Date()
    }, 'high'); // High priority for working hours changes
  }

  private async handleManualRescheduling(data: { userId: string; reason?: string }): Promise<void> {
    await this.triggerRescheduling(data.userId, {
      type: 'manual_trigger',
      entityId: data.userId,
      timestamp: new Date(),
      metadata: { reason: data.reason }
    }, 'high');
  }

  /**
   * Determine if changes should trigger high priority rescheduling
   */
  private shouldTriggerHighPriorityRescheduling(changes: Partial<Task>): boolean {
    const highPriorityFields = ['deadline', 'priority', 'duration', 'isBlocking', 'isHardDeadline'];
    return highPriorityFields.some(field => field in changes);
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): QueueStatus {
    const jobs = Array.from(this.reschedulingQueue.values());
    
    return {
      totalJobs: jobs.length,
      pendingJobs: jobs.filter(job => job.status === 'pending').length,
      processingJobs: jobs.filter(job => job.status === 'processing').length,
      failedJobs: jobs.filter(job => job.status === 'failed').length,
      processingUsers: Array.from(this.processingQueue),
      oldestJob: jobs.length > 0 ? Math.min(...jobs.map(job => job.createdAt.getTime())) : null
    };
  }

  /**
   * Force process all pending jobs (for testing or manual intervention)
   */
  async processAllPendingJobs(): Promise<void> {
    const pendingUserIds = Array.from(this.reschedulingQueue.keys())
      .filter(userId => this.reschedulingQueue.get(userId)?.status === 'pending');

    for (const userId of pendingUserIds) {
      // Clear debounce timer and process immediately
      const timer = this.debounceTimers.get(userId);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(userId);
      }
      
      await this.processReschedulingJob(userId);
    }
  }

  /**
   * Clear all jobs for a user (useful for cleanup)
   */
  clearUserJobs(userId: string): void {
    const timer = this.debounceTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(userId);
    }
    
    this.reschedulingQueue.delete(userId);
    this.processingQueue.delete(userId);
  }

  /**
   * Get job status for a user
   */
  getUserJobStatus(userId: string): ReschedulingJob | null {
    return this.reschedulingQueue.get(userId) || null;
  }
}

// Supporting interfaces and types
export interface RescheduleTrigger {
  type: RescheduleTriggerType;
  entityId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export type RescheduleTriggerType = 
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'task_deleted'
  | 'dependency_changed'
  | 'calendar_event_created'
  | 'calendar_event_updated'
  | 'calendar_event_deleted'
  | 'user_preferences_updated'
  | 'working_hours_updated'
  | 'manual_trigger';

export type ReschedulingPriority = 'low' | 'normal' | 'high';

export type ReschedulingJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ReschedulingJob {
  userId: string;
  trigger: RescheduleTrigger;
  priority: ReschedulingPriority;
  status: ReschedulingJobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  error?: string;
  result?: SolverResult;
}

export interface QueueStatus {
  totalJobs: number;
  pendingJobs: number;
  processingJobs: number;
  failedJobs: number;
  processingUsers: string[];
  oldestJob: number | null;
}