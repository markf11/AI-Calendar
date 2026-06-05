import { Pool } from 'pg';
import { Database } from '@/config/database';
import { Project, ProjectWithTasks, ProjectSummary } from '@/models/Project';
import { CreateProjectRequest, ProjectProgress } from '@/models/types';

export class ProjectRepository {
  private db: Pool;

  constructor(db?: Pool) {
    this.db = db || Database.getInstance().getPool();
  }

  /**
   * Create a new project
   */
  async create(userId: string, projectData: CreateProjectRequest): Promise<Project> {
    const query = `
      INSERT INTO projects (user_id, name, description, color)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, name, description, color, created_at, updated_at
    `;

    const values = [
      userId,
      projectData.name,
      projectData.description || null,
      projectData.color
    ];

    const result = await this.db.query(query, values);
    const row = result.rows[0];

    return this.mapRowToProject(row);
  }

  /**
   * Find project by ID
   */
  async findById(id: string, userId: string): Promise<Project | null> {
    const query = `
      SELECT id, user_id, name, description, color, created_at, updated_at
      FROM projects
      WHERE id = $1 AND user_id = $2
    `;

    const result = await this.db.query(query, [id, userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToProject(result.rows[0]);
  }

  /**
   * Find all projects for a user
   */
  async findByUser(userId: string): Promise<Project[]> {
    const query = `
      SELECT id, user_id, name, description, color, created_at, updated_at
      FROM projects
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => this.mapRowToProject(row));
  }

  /**
   * Find project with tasks and progress
   */
  async findByIdWithTasks(id: string, userId: string): Promise<ProjectWithTasks | null> {
    const projectQuery = `
      SELECT id, user_id, name, description, color, created_at, updated_at
      FROM projects
      WHERE id = $1 AND user_id = $2
    `;

    const tasksQuery = `
      SELECT id, title, status, duration, completed_minutes
      FROM tasks
      WHERE project_id = $1 AND user_id = $2
      ORDER BY created_at ASC
    `;

    const projectResult = await this.db.query(projectQuery, [id, userId]);
    
    if (projectResult.rows.length === 0) {
      return null;
    }

    const project = this.mapRowToProject(projectResult.rows[0]);
    const tasksResult = await this.db.query(tasksQuery, [id, userId]);
    
    const taskDetails = tasksResult.rows.map(row => ({
      id: row.id,
      title: row.title,
      status: row.status,
      duration: row.duration,
      completedMinutes: row.completed_minutes
    }));

    const progress = this.calculateProgress(taskDetails);

    return {
      ...project,
      taskDetails,
      progress
    };
  }

  /**
   * Update project
   */
  async update(id: string, userId: string, updates: Partial<CreateProjectRequest>): Promise<Project | null> {
    const setParts: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setParts.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      setParts.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }

    if (updates.color !== undefined) {
      setParts.push(`color = $${paramIndex++}`);
      values.push(updates.color);
    }

    if (setParts.length === 0) {
      return this.findById(id, userId);
    }

    values.push(id, userId);
    const query = `
      UPDATE projects
      SET ${setParts.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING id, user_id, name, description, color, created_at, updated_at
    `;

    const result = await this.db.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToProject(result.rows[0]);
  }

  /**
   * Delete project
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const query = 'DELETE FROM projects WHERE id = $1 AND user_id = $2';
    const result = await this.db.query(query, [id, userId]);
    return result.rowCount! > 0;
  }

  /**
   * Get project summaries for dashboard
   */
  async getProjectSummaries(userId: string): Promise<ProjectSummary[]> {
    const query = `
      SELECT 
        p.id,
        p.name,
        p.color,
        COUNT(t.id) as task_count,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
        COALESCE(SUM(t.duration), 0) as total_minutes,
        COALESCE(SUM(t.completed_minutes), 0) as completed_minutes
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
      WHERE p.user_id = $1
      GROUP BY p.id, p.name, p.color
      ORDER BY p.created_at DESC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      color: row.color,
      taskCount: parseInt(row.task_count),
      completedTasks: parseInt(row.completed_tasks),
      totalMinutes: parseInt(row.total_minutes),
      completedMinutes: parseInt(row.completed_minutes)
    }));
  }

  /**
   * Get project progress
   */
  async getProjectProgress(id: string, userId: string): Promise<ProjectProgress | null> {
    const query = `
      SELECT 
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
        COALESCE(SUM(t.duration), 0) as total_minutes,
        COALESCE(SUM(t.completed_minutes), 0) as completed_minutes
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
      WHERE p.id = $1 AND p.user_id = $2
      GROUP BY p.id
    `;

    const result = await this.db.query(query, [id, userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const totalTasks = parseInt(row.total_tasks);
    const completedTasks = parseInt(row.completed_tasks);
    const totalMinutes = parseInt(row.total_minutes);
    const completedMinutes = parseInt(row.completed_minutes);

    // Calculate estimated completion date based on current progress
    let estimatedCompletion = new Date();
    if (totalTasks > 0 && completedTasks < totalTasks) {
      const remainingMinutes = totalMinutes - completedMinutes;
      const avgMinutesPerDay = 480; // 8 hours per day
      const daysToComplete = Math.ceil(remainingMinutes / avgMinutesPerDay);
      estimatedCompletion = new Date(Date.now() + daysToComplete * 24 * 60 * 60 * 1000);
    }

    return {
      totalTasks,
      completedTasks,
      totalMinutes,
      completedMinutes,
      estimatedCompletion
    };
  }

  /**
   * Check if project exists and belongs to user
   */
  async exists(id: string, userId: string): Promise<boolean> {
    const query = 'SELECT 1 FROM projects WHERE id = $1 AND user_id = $2';
    const result = await this.db.query(query, [id, userId]);
    return result.rows.length > 0;
  }

  /**
   * Get projects with task counts
   */
  async findByUserWithTaskCounts(userId: string): Promise<Array<Project & { taskCount: number }>> {
    const query = `
      SELECT 
        p.id, p.user_id, p.name, p.description, p.color, p.created_at, p.updated_at,
        COUNT(t.id) as task_count
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
      WHERE p.user_id = $1
      GROUP BY p.id, p.user_id, p.name, p.description, p.color, p.created_at, p.updated_at
      ORDER BY p.created_at DESC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => ({
      ...this.mapRowToProject(row),
      taskCount: parseInt(row.task_count)
    }));
  }

  /**
   * Map database row to Project object
   */
  private mapRowToProject(row: any): Project {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      color: row.color,
      tasks: [], // Will be loaded separately if needed
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Get project completion history
   */
  async getProjectCompletionHistory(projectId: string, userId: string, dateRange?: { start: Date; end: Date }): Promise<Array<{ date: string; tasksCompleted: number; minutesLogged: number }>> {
    let dateFilter = '';
    const values: any[] = [projectId, userId];
    
    if (dateRange) {
      dateFilter = 'AND tch.timestamp >= $3 AND tch.timestamp <= $4';
      values.push(dateRange.start, dateRange.end);
    }

    const query = `
      SELECT 
        DATE(tch.timestamp) as date,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' AND tch.was_partial_completion = false THEN t.id END) as tasks_completed,
        SUM(tch.minutes_logged) as minutes_logged
      FROM task_completion_history tch
      JOIN tasks t ON tch.task_id = t.id
      WHERE t.project_id = $1 AND t.user_id = $2 ${dateFilter}
      GROUP BY DATE(tch.timestamp)
      ORDER BY date DESC
      LIMIT 30
    `;

    const result = await this.db.query(query, values);
    return result.rows.map(row => ({
      date: row.date,
      tasksCompleted: parseInt(row.tasks_completed) || 0,
      minutesLogged: parseInt(row.minutes_logged) || 0
    }));
  }

  /**
   * Get project task breakdown by priority and status
   */
  async getProjectTaskBreakdown(projectId: string, userId: string): Promise<{
    byPriority: Record<string, { count: number; completed: number }>;
    byStatus: Record<string, number>;
  }> {
    const query = `
      SELECT 
        priority,
        status,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
      FROM tasks
      WHERE project_id = $1 AND user_id = $2
      GROUP BY priority, status
    `;

    const result = await this.db.query(query, [projectId, userId]);
    
    const byPriority: Record<string, { count: number; completed: number }> = {};
    const byStatus: Record<string, number> = {};

    // Initialize priority breakdown
    ['low', 'medium', 'high', 'critical'].forEach(priority => {
      byPriority[priority] = { count: 0, completed: 0 };
    });

    // Initialize status breakdown
    ['pending', 'scheduled', 'in_progress', 'completed', 'blocked'].forEach(status => {
      byStatus[status] = 0;
    });

    // Populate from query results
    result.rows.forEach(row => {
      const priority = row.priority;
      const status = row.status;
      const count = parseInt(row.count);
      const completed = parseInt(row.completed);

      if (!byPriority[priority]) {
        byPriority[priority] = { count: 0, completed: 0 };
      }
      byPriority[priority].count += count;
      byPriority[priority].completed += completed;

      byStatus[status] = (byStatus[status] || 0) + count;
    });

    return {
      byPriority,
      byStatus
    };
  }

  /**
   * Calculate project progress from task details
   */
  private calculateProgress(taskDetails: Array<{ status: string; duration: number; completedMinutes: number }>): ProjectProgress {
    const totalTasks = taskDetails.length;
    const completedTasks = taskDetails.filter(task => task.status === 'completed').length;
    const totalMinutes = taskDetails.reduce((sum, task) => sum + task.duration, 0);
    const completedMinutes = taskDetails.reduce((sum, task) => sum + task.completedMinutes, 0);

    // Calculate estimated completion date
    let estimatedCompletion = new Date();
    if (totalTasks > 0 && completedTasks < totalTasks) {
      const remainingMinutes = totalMinutes - completedMinutes;
      const avgMinutesPerDay = 480; // 8 hours per day
      const daysToComplete = Math.ceil(remainingMinutes / avgMinutesPerDay);
      estimatedCompletion = new Date(Date.now() + daysToComplete * 24 * 60 * 60 * 1000);
    }

    return {
      totalTasks,
      completedTasks,
      totalMinutes,
      completedMinutes,
      estimatedCompletion
    };
  }
}