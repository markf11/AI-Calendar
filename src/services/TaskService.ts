// @ts-nocheck
import { TaskRepository } from '@/repositories/TaskRepository';
import { TaskDependencyService } from '@/services/TaskDependencyService';
import { Task, TaskSummary, TaskWithProject } from '@/models/Task';
import { CreateTaskRequest, TaskCompletion, Priority, TaskStatus, DependencyStatus } from '@/models/types';
import { monitoringService } from './MonitoringService';
import { analyticsService } from './AnalyticsService';

export class TaskService {
  private taskRepository: TaskRepository;
  private dependencyService: TaskDependencyService;

  constructor() {
    this.taskRepository = new TaskRepository();
    this.dependencyService = new TaskDependencyService();
  }

  /**
   * Create a new task
   */
  async createTask(userId: string, taskData: CreateTaskRequest): Promise<Task> {
    const tracker = monitoringService.trackPerformance('task_creation', userId, { 
      duration: taskData.duration, 
      priority: taskData.priority 
    });
    
    try {
      // Validate that duration is positive
      if (taskData.duration <= 0) {
        throw new Error('Task duration must be greater than 0');
      }

      // Validate deadline is in the future if provided
      if (taskData.deadline && new Date(taskData.deadline) <= new Date()) {
        throw new Error('Task deadline must be in the future');
      }

      // If deadline is provided but isHardDeadline is not specified, default to soft deadline
      const taskWithDefaults = {
        ...taskData,
        isHardDeadline: taskData.isHardDeadline ?? false,
        isBlocking: taskData.isBlocking ?? false
      };

      const task = await this.taskRepository.create(userId, taskWithDefaults);
      
      // Track successful task creation
      const duration = tracker.end();
      analyticsService.trackFeatureUsage('task_creation', userId, true, duration, {
        priority: taskData.priority,
        hasDeadline: !!taskData.deadline,
        isBlocking: taskData.isBlocking
      });
      
      return task;
    } catch (error) {
      tracker.end();
      monitoringService.trackError(error as Error, 'task_creation', 'medium', userId);
      analyticsService.trackFeatureUsage('task_creation', userId, false);
      throw error;
    }
  }

  /**
   * Get task by ID
   */
  async getTaskById(id: string, userId: string): Promise<Task | null> {
    return await this.taskRepository.findById(id, userId);
  }

  /**
   * Get all tasks for a user with optional filters
   */
  async getUserTasks(
    userId: string,
    filters?: {
      status?: TaskStatus[];
      priority?: Priority[];
      projectId?: string;
      hasDeadline?: boolean;
      isOverdue?: boolean;
    }
  ): Promise<Task[]> {
    return await this.taskRepository.findByUser(userId, filters);
  }

  /**
   * Get tasks with project information
   */
  async getUserTasksWithProject(userId: string): Promise<TaskWithProject[]> {
    return await this.taskRepository.findByUserWithProject(userId);
  }

  /**
   * Update task
   */
  async updateTask(id: string, userId: string, updates: Partial<CreateTaskRequest>): Promise<Task> {
    // Validate duration if provided
    if (updates.duration !== undefined && updates.duration <= 0) {
      throw new Error('Task duration must be greater than 0');
    }

    // Validate deadline if provided
    if (updates.deadline !== undefined && updates.deadline && new Date(updates.deadline) <= new Date()) {
      throw new Error('Task deadline must be in the future');
    }

    const updatedTask = await this.taskRepository.update(id, userId, updates);
    
    if (!updatedTask) {
      throw new Error('Task not found or access denied');
    }

    return updatedTask;
  }

  /**
   * Update task status
   */
  async updateTaskStatus(id: string, userId: string, status: TaskStatus): Promise<Task> {
    const updatedTask = await this.taskRepository.updateStatus(id, userId, status);
    
    if (!updatedTask) {
      throw new Error('Task not found or access denied');
    }

    return updatedTask;
  }

  /**
   * Unmark task as completed (restore to previous status)
   */
  async unmarkTaskCompleted(id: string, userId: string): Promise<Task> {
    const updatedTask = await this.taskRepository.unmarkCompleted(id, userId);
    
    if (!updatedTask) {
      throw new Error('Task not found or access denied');
    }

    return updatedTask;
  }

  /**
   * Get task summary for dashboard
   */
  async getTaskSummary(userId: string): Promise<TaskSummary[]> {
    return await this.taskRepository.getTaskSummary(userId);
  }

  /**
   * Get tasks by project
   */
  async getTasksByProject(projectId: string, userId: string): Promise<Task[]> {
    return await this.taskRepository.findByProject(projectId, userId);
  }

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(userId: string): Promise<Task[]> {
    return await this.taskRepository.findByUser(userId, { isOverdue: true });
  }

  /**
   * Get tasks by priority
   */
  async getTasksByPriority(userId: string, priority: Priority): Promise<Task[]> {
    return await this.taskRepository.findByUser(userId, { priority: [priority] });
  }

  /**
   * Get pending tasks (not scheduled or completed)
   */
  async getPendingTasks(userId: string): Promise<Task[]> {
    return await this.taskRepository.findByUser(userId, { 
      status: ['pending', 'blocked'] 
    });
  }

  /**
   * Get scheduled tasks
   */
  async getScheduledTasks(userId: string): Promise<Task[]> {
    return await this.taskRepository.findByUser(userId, { 
      status: ['scheduled', 'in_progress'] 
    });
  }

  /**
   * Get completed tasks
   */
  async getCompletedTasks(userId: string): Promise<Task[]> {
    return await this.taskRepository.findByUser(userId, { 
      status: ['completed'] 
    });
  }

  /**
   * Add task dependency
   */
  async addTaskDependency(taskId: string, dependsOnTaskId: string, userId: string): Promise<void> {
    return await this.dependencyService.addTaskDependency(taskId, dependsOnTaskId, userId);
  }

  /**
   * Remove task dependency
   */
  async removeTaskDependency(taskId: string, dependsOnTaskId: string, userId: string): Promise<void> {
    return await this.dependencyService.removeTaskDependency(taskId, dependsOnTaskId, userId);
  }

  /**
   * Get task dependencies
   */
  async getTaskDependencies(taskId: string, userId: string): Promise<string[]> {
    return await this.dependencyService.getTaskDependencies(taskId, userId);
  }

  /**
   * Get task dependents
   */
  async getTaskDependents(taskId: string, userId: string): Promise<string[]> {
    return await this.dependencyService.getTaskDependents(taskId, userId);
  }

  /**
   * Get dependency status for a task
   */
  async getDependencyStatus(taskId: string, userId: string): Promise<DependencyStatus> {
    return await this.dependencyService.getDependencyStatus(taskId, userId);
  }

  /**
   * Get task with completion history
   */
  async getTaskWithHistory(id: string, userId: string): Promise<Task | null> {
    return await this.taskRepository.findByIdWithHistory(id, userId);
  }

  /**
   * Get completion history for a task
   */
  async getTaskCompletionHistory(taskId: string, userId: string): Promise<TaskCompletionEntry[]> {
    // Verify user has access to this task
    const task = await this.taskRepository.findById(taskId, userId);
    if (!task) {
      throw new Error('Task not found or access denied');
    }

    return await this.taskRepository.getCompletionHistory(taskId, userId);
  }

  /**
   * Log partial completion for a task
   */
  async logPartialProgress(id: string, userId: string, minutesCompleted: number, notes?: string): Promise<Task> {
    if (minutesCompleted <= 0) {
      throw new Error('Minutes completed must be greater than 0');
    }

    const completion: TaskCompletion = {
      minutesCompleted,
      notes,
      isFullCompletion: false
    };

    return await this.completeTask(id, userId, completion);
  }

  /**
   * Get task progress analytics for user
   */
  async getTaskProgressAnalytics(userId: string, dateRange?: { start: Date; end: Date }): Promise<{
    totalTasks: number;
    completedTasks: number;
    totalMinutes: number;
    completedMinutes: number;
    averageCompletionTime: number;
    completionRate: number;
    dailyProgress: Array<{ date: string; tasksCompleted: number; minutesLogged: number }>;
  }> {
    return await this.taskRepository.getTaskProgressAnalytics(userId, dateRange);
  }

  /**
   * Enhanced completeTask to handle dependency unblocking
   */
  async completeTask(id: string, userId: string, completion: TaskCompletion): Promise<Task> {
    // Validate completion data
    if (completion.minutesCompleted <= 0) {
      throw new Error('Minutes completed must be greater than 0');
    }

    // Get current task to validate completion
    const currentTask = await this.taskRepository.findById(id, userId);
    if (!currentTask) {
      throw new Error('Task not found or access denied');
    }

    // Validate that we're not logging more time than remaining
    if (!completion.isFullCompletion) {
      const remainingMinutes = currentTask.duration - currentTask.completedMinutes;
      if (completion.minutesCompleted > remainingMinutes) {
        throw new Error('Cannot log more minutes than remaining task duration');
      }
    }

    const updatedTask = await this.taskRepository.logCompletion(id, userId, completion);
    
    if (!updatedTask) {
      throw new Error('Failed to log task completion');
    }

    // If task is fully completed, process dependency unblocking
    if (updatedTask.status === 'completed') {
      await this.dependencyService.processTaskCompletion(id, userId);
    }

    return updatedTask;
  }

  /**
   * Enhanced markTaskCompleted to handle dependency unblocking
   */
  async markTaskCompleted(id: string, userId: string, notes?: string): Promise<Task> {
    const currentTask = await this.taskRepository.findById(id, userId);
    if (!currentTask) {
      throw new Error('Task not found or access denied');
    }

    const completion: TaskCompletion = {
      minutesCompleted: currentTask.remainingMinutes,
      notes,
      isFullCompletion: true
    };

    const updatedTask = await this.completeTask(id, userId, completion);

    // Process dependency unblocking
    await this.dependencyService.processTaskCompletion(id, userId);

    return updatedTask;
  }

  /**
   * Enhanced deleteTask to handle dependency cleanup
   */
  async deleteTask(id: string, userId: string): Promise<void> {
    // Remove all dependencies first
    await this.dependencyService.removeAllTaskDependencies(id, userId);

    // Then delete the task
    const deleted = await this.taskRepository.delete(id, userId);
    
    if (!deleted) {
      throw new Error('Task not found or access denied');
    }
  }
}