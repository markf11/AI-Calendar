import { Request, Response } from 'express';
import { TaskService } from '@/services/TaskService';
import { CreateTaskRequest, TaskCompletion, Priority, TaskStatus } from '@/models/types';

export class TaskController {
  private taskService: TaskService;

  constructor() {
    this.taskService = new TaskService();
  }

  /**
   * Create a new task
   */
  createTask = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const taskData: CreateTaskRequest = req.body;
      const task = await this.taskService.createTask(userId, taskData);

      res.status(201).json({
        success: true,
        data: task
      });
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(400).json({
        error: {
          message: error instanceof Error ? error.message : 'Failed to create task'
        }
      });
    }
  };

  /**
   * Get task by ID
   */
  getTask = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const task = await this.taskService.getTaskById(id, userId);

      if (!task) {
        res.status(404).json({
          error: { message: 'Task not found' }
        });
        return;
      }

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      console.error('Error getting task:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  }; 
 /**
   * Get all tasks for the authenticated user
   */
  getTasks = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { status, priority, projectId, hasDeadline, isOverdue, withProject } = req.query;

      // Parse filters
      const filters: any = {};
      if (status) {
        filters.status = Array.isArray(status) ? status : [status];
      }
      if (priority) {
        filters.priority = Array.isArray(priority) ? priority : [priority];
      }
      if (projectId) {
        filters.projectId = projectId as string;
      }
      if (hasDeadline !== undefined) {
        filters.hasDeadline = hasDeadline === 'true';
      }
      if (isOverdue !== undefined) {
        filters.isOverdue = isOverdue === 'true';
      }

      let tasks;
      if (withProject === 'true') {
        tasks = await this.taskService.getUserTasksWithProject(userId);
      } else {
        tasks = await this.taskService.getUserTasks(userId, filters);
      }

      res.json({
        success: true,
        data: tasks
      });
    } catch (error) {
      console.error('Error getting tasks:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  };

  /**
   * Update task
   */
  updateTask = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const updates = req.body;

      const task = await this.taskService.updateTask(id, userId, updates);

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      console.error('Error updating task:', error);
      res.status(400).json({
        error: {
          message: error instanceof Error ? error.message : 'Failed to update task'
        }
      });
    }
  };

  /**
   * Delete task
   */
  deleteTask = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      await this.taskService.deleteTask(id, userId);

      res.json({
        success: true,
        message: 'Task deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      res.status(400).json({
        error: {
          message: error instanceof Error ? error.message : 'Failed to delete task'
        }
      });
    }
  };

  /**
   * Complete task (full or partial)
   */
  completeTask = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const completion: TaskCompletion = req.body;

      const task = await this.taskService.completeTask(id, userId, completion);

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      console.error('Error completing task:', error);
      res.status(400).json({
        error: {
          message: error instanceof Error ? error.message : 'Failed to complete task'
        }
      });
    }
  };

  /**
   * Mark task as completed
   */
  markCompleted = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const { notes } = req.body;

      const task = await this.taskService.markTaskCompleted(id, userId, notes);

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      console.error('Error marking task completed:', error);
      res.status(400).json({
        error: {
          message: error instanceof Error ? error.message : 'Failed to mark task completed'
        }
      });
    }
  };

  /**
   * Unmark task as completed
   */
  unmarkCompleted = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const task = await this.taskService.unmarkTaskCompleted(id, userId);

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      console.error('Error unmarking task completed:', error);
      res.status(400).json({
        error: {
          message: error instanceof Error ? error.message : 'Failed to unmark task completed'
        }
      });
    }
  };

  /**
   * Update task status
   */
  updateStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const { status } = req.body;

      const task = await this.taskService.updateTaskStatus(id, userId, status);

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      console.error('Error updating task status:', error);
      res.status(400).json({
        error: {
          message: error instanceof Error ? error.message : 'Failed to update task status'
        }
      });
    }
  };

  /**
   * Get task summary
   */
  getTaskSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const summary = await this.taskService.getTaskSummary(userId);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Error getting task summary:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  };

  /**
   * Get overdue tasks
   */
  getOverdueTasks = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const tasks = await this.taskService.getOverdueTasks(userId);

      res.json({
        success: true,
        data: tasks
      });
    } catch (error) {
      console.error('Error getting overdue tasks:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  };

  /**
   * Get pending tasks
   */
  getPendingTasks = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const tasks = await this.taskService.getPendingTasks(userId);

      res.json({
        success: true,
        data: tasks
      });
    } catch (error) {
      console.error('Error getting pending tasks:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  };

  /**
   * Add task dependency
   */
  addDependency = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const { dependsOnTaskId } = req.body;

      await this.taskService.addTaskDependency(id, dependsOnTaskId, userId);

      res.json({
        success: true,
        message: 'Dependency added successfully'
      });
    } catch (error) {
      console.error('Error adding task dependency:', error);
      res.status(400).json({
        error: {
          message: error instanceof Error ? error.message : 'Failed to add dependency'
        }
      });
    }
  };

  /**
   * Remove task dependency
   */
  removeDependency = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const { dependsOnTaskId } = req.body;

      await this.taskService.removeTaskDependency(id, dependsOnTaskId, userId);

      res.json({
        success: true,
        message: 'Dependency removed successfully'
      });
    } catch (error) {
      console.error('Error removing task dependency:', error);
      res.status(400).json({
        error: {
          message: error instanceof Error ? error.message : 'Failed to remove dependency'
        }
      });
    }
  };

  /**
   * Get task dependencies
   */
  getDependencies = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const dependencies = await this.taskService.getTaskDependencies(id, userId);

      res.json({
        success: true,
        data: dependencies
      });
    } catch (error) {
      console.error('Error getting task dependencies:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  };

  /**
   * Get task dependents
   */
  getDependents = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const dependents = await this.taskService.getTaskDependents(id, userId);

      res.json({
        success: true,
        data: dependents
      });
    } catch (error) {
      console.error('Error getting task dependents:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  };

  /**
   * Get dependency status
   */
  getDependencyStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const status = await this.taskService.getDependencyStatus(id, userId);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Error getting dependency status:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  };

  /**
   * Get task with completion history
   */
  getTaskWithHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const task = await this.taskService.getTaskWithHistory(id, userId);

      if (!task) {
        res.status(404).json({
          error: { message: 'Task not found' }
        });
        return;
      }

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      console.error('Error getting task with history:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  };

  /**
   * Get completion history for a task
   */
  getCompletionHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const history = await this.taskService.getTaskCompletionHistory(id, userId);

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Error getting completion history:', error);
      res.status(400).json({
        error: {
          message: error instanceof Error ? error.message : 'Failed to get completion history'
        }
      });
    }
  };

  /**
   * Log partial progress for a task
   */
  logPartialProgress = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const { minutesCompleted, notes } = req.body;

      if (!minutesCompleted || minutesCompleted <= 0) {
        res.status(400).json({
          error: { message: 'Minutes completed must be greater than 0' }
        });
        return;
      }

      const task = await this.taskService.logPartialProgress(id, userId, minutesCompleted, notes);

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      console.error('Error logging partial progress:', error);
      res.status(400).json({
        error: {
          message: error instanceof Error ? error.message : 'Failed to log partial progress'
        }
      });
    }
  };

  /**
   * Get task progress analytics
   */
  getProgressAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { startDate, endDate } = req.query;
      let dateRange: { start: Date; end: Date } | undefined;

      if (startDate && endDate) {
        dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };

        // Validate date range
        if (isNaN(dateRange.start.getTime()) || isNaN(dateRange.end.getTime())) {
          res.status(400).json({
            error: { message: 'Invalid date format' }
          });
          return;
        }

        if (dateRange.start >= dateRange.end) {
          res.status(400).json({
            error: { message: 'Start date must be before end date' }
          });
          return;
        }
      }

      const analytics = await this.taskService.getTaskProgressAnalytics(userId, dateRange);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Error getting progress analytics:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  };
}