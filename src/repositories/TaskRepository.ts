import { Pool } from 'pg';
import { Database } from '@/config/database';
import { Task, TaskSummary, TaskWithProject } from '@/models/Task';
import { CreateTaskRequest, TaskCompletion, Priority, TaskStatus } from '@/models/types';

export class TaskRepository {
  private db: Pool;

  constructor() {
    this.db = Database.getInstance().getPool();
  }

  /**
   * Create a new task
   */
  async create(userId: string, taskData: CreateTaskRequest): Promise<Task> {
    const query = `
      INSERT INTO tasks (
        user_id, project_id, title, description, duration, priority, 
        deadline, is_hard_deadline, is_blocking
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, user_id, project_id, title, description, duration, priority,
                deadline, is_hard_deadline, is_blocking, status, completed_minutes,
                remaining_minutes, created_at, updated_at, completed_at
    `;

    const values = [
      userId,
      taskData.projectId || null,
      taskData.title,
      taskData.description || null,
      taskData.duration,
      taskData.priority,
      taskData.deadline || null,
      taskData.isHardDeadline,
      taskData.isBlocking
    ];

    const result = await this.db.query(query, values);
    const row = result.rows[0];

    return this.mapRowToTask(row);
  }

  /**
   * Find task by ID
   */
  async findById(id: string, userId: string): Promise<Task | null> {
    const query = `
      SELECT id, user_id, project_id, title, description, duration, priority,
             deadline, is_hard_deadline, is_blocking, status, completed_minutes,
             remaining_minutes, created_at, updated_at, completed_at
      FROM tasks
      WHERE id = $1 AND user_id = $2
    `;

    const result = await this.db.query(query, [id, userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTask(result.rows[0]);
  }

  /**
   * Find all tasks for a user with optional filters
   */
  async findByUser(
    userId: string,
    filters?: {
      status?: TaskStatus[];
      priority?: Priority[];
      projectId?: string;
      hasDeadline?: boolean;
      isOverdue?: boolean;
    }
  ): Promise<Task[]> {
    let query = `
      SELECT id, user_id, project_id, title, description, duration, priority,
             deadline, is_hard_deadline, is_blocking, status, completed_minutes,
             remaining_minutes, created_at, updated_at, completed_at
      FROM tasks
      WHERE user_id = $1
    `;

    const values: any[] = [userId];
    let paramIndex = 2;

    if (filters?.status && filters.status.length > 0) {
      query += ` AND status = ANY($${paramIndex})`;
      values.push(filters.status);
      paramIndex++;
    }

    if (filters?.priority && filters.priority.length > 0) {
      query += ` AND priority = ANY($${paramIndex})`;
      values.push(filters.priority);
      paramIndex++;
    }

    if (filters?.projectId) {
      query += ` AND project_id = $${paramIndex}`;
      values.push(filters.projectId);
      paramIndex++;
    }

    if (filters?.hasDeadline !== undefined) {
      if (filters.hasDeadline) {
        query += ` AND deadline IS NOT NULL`;
      } else {
        query += ` AND deadline IS NULL`;
      }
    }

    if (filters?.isOverdue) {
      query += ` AND deadline < NOW() AND status != 'completed'`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.db.query(query, values);
    return result.rows.map(row => this.mapRowToTask(row));
  }

  /**
   * Find tasks with project information
   */
  async findByUserWithProject(userId: string): Promise<TaskWithProject[]> {
    const query = `
      SELECT t.id, t.user_id, t.project_id, t.title, t.description, t.duration, 
             t.priority, t.deadline, t.is_hard_deadline, t.is_blocking, t.status, 
             t.completed_minutes, t.remaining_minutes, t.created_at, t.updated_at, 
             t.completed_at, p.name as project_name, p.color as project_color
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => this.mapRowToTaskWithProject(row));
  }

  /**
   * Update task
   */
  async update(id: string, userId: string, updates: Partial<CreateTaskRequest>): Promise<Task | null> {
    const setParts: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      setParts.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }

    if (updates.description !== undefined) {
      setParts.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }

    if (updates.duration !== undefined) {
      setParts.push(`duration = $${paramIndex++}`);
      values.push(updates.duration);
    }

    if (updates.priority !== undefined) {
      setParts.push(`priority = $${paramIndex++}`);
      values.push(updates.priority);
    }

    if (updates.deadline !== undefined) {
      setParts.push(`deadline = $${paramIndex++}`);
      values.push(updates.deadline);
    }

    if (updates.isHardDeadline !== undefined) {
      setParts.push(`is_hard_deadline = $${paramIndex++}`);
      values.push(updates.isHardDeadline);
    }

    if (updates.isBlocking !== undefined) {
      setParts.push(`is_blocking = $${paramIndex++}`);
      values.push(updates.isBlocking);
    }

    if (updates.projectId !== undefined) {
      setParts.push(`project_id = $${paramIndex++}`);
      values.push(updates.projectId);
    }

    if (setParts.length === 0) {
      return this.findById(id, userId);
    }

    values.push(id, userId);
    const query = `
      UPDATE tasks
      SET ${setParts.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING id, user_id, project_id, title, description, duration, priority,
                deadline, is_hard_deadline, is_blocking, status, completed_minutes,
                remaining_minutes, created_at, updated_at, completed_at
    `;

    const result = await this.db.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTask(result.rows[0]);
  }

  /**
   * Update task status
   */
  async updateStatus(id: string, userId: string, status: TaskStatus): Promise<Task | null> {
    const query = `
      UPDATE tasks
      SET status = $1, 
          updated_at = NOW(),
          completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
      WHERE id = $2 AND user_id = $3
      RETURNING id, user_id, project_id, title, description, duration, priority,
                deadline, is_hard_deadline, is_blocking, status, completed_minutes,
                remaining_minutes, created_at, updated_at, completed_at
    `;

    const result = await this.db.query(query, [status, id, userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTask(result.rows[0]);
  }

  /**
   * Delete task
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const query = 'DELETE FROM tasks WHERE id = $1 AND user_id = $2';
    const result = await this.db.query(query, [id, userId]);
    return result.rowCount > 0;
  }

  /**
   * Get task summary for dashboard/overview
   */
  async getTaskSummary(userId: string): Promise<TaskSummary[]> {
    const query = `
      SELECT t.id, t.title, t.duration, t.priority, t.status, t.deadline,
             p.name as project_name, p.color as project_color
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.user_id = $1 AND t.status != 'completed'
      ORDER BY 
        CASE t.priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END,
        t.deadline ASC NULLS LAST,
        t.created_at ASC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      duration: row.duration,
      priority: row.priority,
      status: row.status,
      deadline: row.deadline,
      projectName: row.project_name,
      projectColor: row.project_color
    }));
  }

  /**
   * Log task completion progress
   */
  async logCompletion(id: string, userId: string, completion: TaskCompletion): Promise<Task | null> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Insert completion history record
      const historyQuery = `
        INSERT INTO task_completion_history (task_id, minutes_logged, notes, was_partial_completion)
        VALUES ($1, $2, $3, $4)
      `;
      
      await client.query(historyQuery, [
        id,
        completion.minutesCompleted,
        completion.notes || null,
        !completion.isFullCompletion
      ]);

      // Update task completed minutes and status
      const updateQuery = `
        UPDATE tasks
        SET completed_minutes = CASE 
              WHEN $3 = true THEN duration 
              ELSE LEAST(completed_minutes + $2, duration)
            END,
            status = CASE 
              WHEN $3 = true THEN 'completed'
              WHEN completed_minutes + $2 >= duration THEN 'completed'
              ELSE status
            END,
            updated_at = NOW(),
            completed_at = CASE 
              WHEN $3 = true OR completed_minutes + $2 >= duration THEN NOW()
              ELSE completed_at
            END
        WHERE id = $1 AND user_id = $4
        RETURNING id, user_id, project_id, title, description, duration, priority,
                  deadline, is_hard_deadline, is_blocking, status, completed_minutes,
                  remaining_minutes, created_at, updated_at, completed_at
      `;

      const result = await client.query(updateQuery, [
        id,
        completion.minutesCompleted,
        completion.isFullCompletion,
        userId
      ]);

      await client.query('COMMIT');

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToTask(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get completion history for a task
   */
  async getCompletionHistory(taskId: string, userId: string): Promise<TaskCompletionEntry[]> {
    const query = `
      SELECT tch.timestamp, tch.minutes_logged, tch.notes, tch.was_partial_completion
      FROM task_completion_history tch
      JOIN tasks t ON tch.task_id = t.id
      WHERE tch.task_id = $1 AND t.user_id = $2
      ORDER BY tch.timestamp DESC
    `;

    const result = await this.db.query(query, [taskId, userId]);
    return result.rows.map(row => ({
      timestamp: row.timestamp,
      minutesLogged: row.minutes_logged,
      notes: row.notes,
      wasPartialCompletion: row.was_partial_completion
    }));
  }

  /**
   * Unmark task as completed (restore to previous status)
   */
  async unmarkCompleted(id: string, userId: string): Promise<Task | null> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Get the task to verify it's completed
      const taskQuery = `
        SELECT id, status, duration, completed_minutes
        FROM tasks
        WHERE id = $1 AND user_id = $2
      `;
      const taskResult = await client.query(taskQuery, [id, userId]);
      
      if (taskResult.rows.length === 0) {
        return null;
      }

      const task = taskResult.rows[0];
      if (task.status !== 'completed') {
        throw new Error('Task is not marked as completed');
      }

      // Remove the completion history entries that made this task complete
      // We'll remove entries that brought the total to >= duration
      const historyQuery = `
        DELETE FROM task_completion_history 
        WHERE task_id = $1 
        AND id IN (
          SELECT id FROM task_completion_history 
          WHERE task_id = $1 
          ORDER BY timestamp DESC 
          LIMIT 1
        )
      `;
      await client.query(historyQuery, [id]);

      // Recalculate completed minutes from remaining history
      const recalcQuery = `
        UPDATE tasks
        SET completed_minutes = COALESCE((
          SELECT SUM(minutes_logged) 
          FROM task_completion_history 
          WHERE task_id = $1
        ), 0),
        status = 'pending',
        completed_at = NULL,
        updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, project_id, title, description, duration, priority,
                  deadline, is_hard_deadline, is_blocking, status, completed_minutes,
                  remaining_minutes, created_at, updated_at, completed_at
      `;

      const result = await client.query(recalcQuery, [id, userId]);

      await client.query('COMMIT');

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToTask(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get task progress analytics for a user
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
    let dateFilter = '';
    const values: any[] = [userId];
    
    if (dateRange) {
      dateFilter = 'AND t.created_at >= $2 AND t.created_at <= $3';
      values.push(dateRange.start, dateRange.end);
    }

    // Get overall statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        SUM(duration) as total_minutes,
        SUM(completed_minutes) as completed_minutes,
        AVG(CASE WHEN status = 'completed' AND completed_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (completed_at - created_at))/3600 
            END) as avg_completion_hours
      FROM tasks t
      WHERE user_id = $1 ${dateFilter}
    `;

    const statsResult = await this.db.query(statsQuery, values);
    const stats = statsResult.rows[0];

    // Get daily progress
    const dailyQuery = `
      SELECT 
        DATE(tch.timestamp) as date,
        COUNT(DISTINCT t.id) as tasks_completed,
        SUM(tch.minutes_logged) as minutes_logged
      FROM task_completion_history tch
      JOIN tasks t ON tch.task_id = t.id
      WHERE t.user_id = $1 ${dateFilter.replace('t.created_at', 'tch.timestamp')}
      GROUP BY DATE(tch.timestamp)
      ORDER BY date DESC
      LIMIT 30
    `;

    const dailyResult = await this.db.query(dailyQuery, values);

    return {
      totalTasks: parseInt(stats.total_tasks) || 0,
      completedTasks: parseInt(stats.completed_tasks) || 0,
      totalMinutes: parseInt(stats.total_minutes) || 0,
      completedMinutes: parseInt(stats.completed_minutes) || 0,
      averageCompletionTime: parseFloat(stats.avg_completion_hours) || 0,
      completionRate: stats.total_tasks > 0 ? (stats.completed_tasks / stats.total_tasks) * 100 : 0,
      dailyProgress: dailyResult.rows.map(row => ({
        date: row.date,
        tasksCompleted: parseInt(row.tasks_completed),
        minutesLogged: parseInt(row.minutes_logged)
      }))
    };
  }

  /**
   * Get tasks by project
   */
  async findByProject(projectId: string, userId: string): Promise<Task[]> {
    const query = `
      SELECT id, user_id, project_id, title, description, duration, priority,
             deadline, is_hard_deadline, is_blocking, status, completed_minutes,
             remaining_minutes, created_at, updated_at, completed_at
      FROM tasks
      WHERE project_id = $1 AND user_id = $2
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [projectId, userId]);
    return result.rows.map(row => this.mapRowToTask(row));
  }

  /**
   * Map database row to Task object
   */
  private mapRowToTask(row: any): Task {
    return {
      id: row.id,
      userId: row.user_id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      duration: row.duration,
      priority: row.priority,
      deadline: row.deadline,
      isHardDeadline: row.is_hard_deadline,
      isBlocking: row.is_blocking,
      dependencies: [], // Will be loaded separately
      dependents: [], // Will be loaded separately
      status: row.status,
      completedMinutes: row.completed_minutes,
      remainingMinutes: row.remaining_minutes,
      scheduledSlots: [], // Will be loaded separately
      completionHistory: [], // Will be loaded separately
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at
    };
  }

  /**
   * Get task with full completion history
   */
  async findByIdWithHistory(id: string, userId: string): Promise<Task | null> {
    const task = await this.findById(id, userId);
    if (!task) {
      return null;
    }

    const completionHistory = await this.getCompletionHistory(id, userId);
    return {
      ...task,
      completionHistory
    };
  }

  /**
   * Update scheduled slots for a task
   */
  async updateScheduledSlots(taskId: string, userId: string, slots: any[]): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Delete existing scheduled slots for this task
      await client.query(
        'DELETE FROM scheduled_slots WHERE task_id = $1',
        [taskId]
      );

      // Insert new scheduled slots
      if (slots.length > 0) {
        const insertQuery = `
          INSERT INTO scheduled_slots (id, task_id, start_time, end_time, duration, is_confirmed)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;

        for (const slot of slots) {
          await client.query(insertQuery, [
            slot.id,
            taskId,
            slot.startTime,
            slot.endTime,
            slot.duration,
            slot.isConfirmed || false
          ]);
        }
      }

      // Update task status to scheduled if it has slots
      if (slots.length > 0) {
        await client.query(
          'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 AND status = $4',
          ['scheduled', taskId, userId, 'pending']
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find scheduled tasks by user ID and date range
   */
  async findScheduledByUserIdAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Task[]> {
    const query = `
      SELECT DISTINCT t.id, t.user_id, t.project_id, t.title, t.description, 
             t.duration, t.priority, t.deadline, t.is_hard_deadline, t.is_blocking, 
             t.status, t.completed_minutes, t.remaining_minutes, t.created_at, 
             t.updated_at, t.completed_at
      FROM tasks t
      JOIN scheduled_slots ss ON t.id = ss.task_id
      WHERE t.user_id = $1 
        AND ss.start_time >= $2 
        AND ss.end_time <= $3
        AND t.status IN ('scheduled', 'in_progress')
      ORDER BY t.created_at DESC
    `;

    const result = await this.db.query(query, [userId, startDate, endDate]);
    const tasks = result.rows.map(row => this.mapRowToTask(row));

    // Load scheduled slots for each task
    for (const task of tasks) {
      const slotsQuery = `
        SELECT id, start_time, end_time, duration, is_confirmed
        FROM scheduled_slots
        WHERE task_id = $1
          AND start_time >= $2 
          AND end_time <= $3
        ORDER BY start_time ASC
      `;

      const slotsResult = await this.db.query(slotsQuery, [task.id, startDate, endDate]);
      task.scheduledSlots = slotsResult.rows.map(slotRow => ({
        id: slotRow.id,
        taskId: task.id,
        startTime: slotRow.start_time,
        endTime: slotRow.end_time,
        duration: slotRow.duration,
        isConfirmed: slotRow.is_confirmed
      }));
    }

    return tasks;
  }

  /**
   * Map database row to TaskWithProject object
   */
  private mapRowToTaskWithProject(row: any): TaskWithProject {
    const task = this.mapRowToTask(row);
    return {
      ...task,
      project: row.project_name ? {
        id: row.project_id,
        name: row.project_name,
        color: row.project_color
      } : null
    };
  }
}