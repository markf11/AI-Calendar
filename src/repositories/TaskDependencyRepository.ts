import { Pool } from 'pg';
import { Database } from '@/config/database';

export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  createdAt: Date;
}

export interface DependencyGraph {
  [taskId: string]: string[]; // taskId -> array of dependency task IDs
}

export class TaskDependencyRepository {
  private db: Pool;

  constructor(db?: Pool) {
    this.db = db || Database.getInstance().getPool();
  }

  /**
   * Add a dependency relationship
   */
  async addDependency(taskId: string, dependsOnTaskId: string, userId: string): Promise<TaskDependency> {
    // First verify both tasks belong to the user
    const verifyQuery = `
      SELECT COUNT(*) as count
      FROM tasks
      WHERE id IN ($1, $2) AND user_id = $3
    `;
    
    const verifyResult = await this.db.query(verifyQuery, [taskId, dependsOnTaskId, userId]);
    
    if (parseInt(verifyResult.rows[0].count) !== 2) {
      throw new Error('One or both tasks not found or access denied');
    }

    // Check if dependency already exists
    const existsQuery = `
      SELECT 1 FROM task_dependencies
      WHERE task_id = $1 AND depends_on_task_id = $2
    `;
    
    const existsResult = await this.db.query(existsQuery, [taskId, dependsOnTaskId]);
    
    if (existsResult.rows.length > 0) {
      throw new Error('Dependency already exists');
    }

    // Add the dependency
    const insertQuery = `
      INSERT INTO task_dependencies (task_id, depends_on_task_id)
      VALUES ($1, $2)
      RETURNING id, task_id, depends_on_task_id, created_at
    `;

    const result = await this.db.query(insertQuery, [taskId, dependsOnTaskId]);
    const row = result.rows[0];

    return {
      id: row.id,
      taskId: row.task_id,
      dependsOnTaskId: row.depends_on_task_id,
      createdAt: row.created_at
    };
  }

  /**
   * Remove a dependency relationship
   */
  async removeDependency(taskId: string, dependsOnTaskId: string, userId: string): Promise<boolean> {
    // Verify the task belongs to the user
    const verifyQuery = `
      SELECT 1 FROM tasks WHERE id = $1 AND user_id = $2
    `;
    
    const verifyResult = await this.db.query(verifyQuery, [taskId, userId]);
    
    if (verifyResult.rows.length === 0) {
      throw new Error('Task not found or access denied');
    }

    const query = `
      DELETE FROM task_dependencies
      WHERE task_id = $1 AND depends_on_task_id = $2
    `;

    const result = await this.db.query(query, [taskId, dependsOnTaskId]);
    return result.rowCount! > 0;
  }

  /**
   * Get all dependencies for a task (what this task depends on)
   */
  async getTaskDependencies(taskId: string, userId: string): Promise<string[]> {
    const query = `
      SELECT td.depends_on_task_id
      FROM task_dependencies td
      JOIN tasks t ON td.task_id = t.id
      WHERE td.task_id = $1 AND t.user_id = $2
    `;

    const result = await this.db.query(query, [taskId, userId]);
    return result.rows.map(row => row.depends_on_task_id);
  }

  /**
   * Get all dependents for a task (what tasks depend on this task)
   */
  async getTaskDependents(taskId: string, userId: string): Promise<string[]> {
    const query = `
      SELECT td.task_id
      FROM task_dependencies td
      JOIN tasks t ON td.depends_on_task_id = t.id
      WHERE td.depends_on_task_id = $1 AND t.user_id = $2
    `;

    const result = await this.db.query(query, [taskId, userId]);
    return result.rows.map(row => row.task_id);
  }

  /**
   * Get the complete dependency graph for a user
   */
  async getDependencyGraph(userId: string): Promise<DependencyGraph> {
    const query = `
      SELECT td.task_id, td.depends_on_task_id
      FROM task_dependencies td
      JOIN tasks t1 ON td.task_id = t1.id
      JOIN tasks t2 ON td.depends_on_task_id = t2.id
      WHERE t1.user_id = $1 AND t2.user_id = $1
    `;

    const result = await this.db.query(query, [userId]);
    const graph: DependencyGraph = {};

    for (const row of result.rows) {
      const taskId = row.task_id;
      const dependsOn = row.depends_on_task_id;

      if (!graph[taskId]) {
        graph[taskId] = [];
      }
      graph[taskId].push(dependsOn);
    }

    return graph;
  }

  /**
   * Check if adding a dependency would create a circular dependency
   */
  async wouldCreateCircularDependency(taskId: string, dependsOnTaskId: string, userId: string): Promise<boolean> {
    // Get current dependency graph
    const graph = await this.getDependencyGraph(userId);
    
    // Temporarily add the new dependency to check for cycles
    if (!graph[taskId]) {
      graph[taskId] = [];
    }
    graph[taskId].push(dependsOnTaskId);

    // Check for cycles using DFS
    return this.hasCycle(graph, taskId, new Set(), new Set());
  }

  /**
   * Get all blocked tasks (tasks that have incomplete dependencies)
   */
  async getBlockedTasks(userId: string): Promise<string[]> {
    const query = `
      SELECT DISTINCT td.task_id
      FROM task_dependencies td
      JOIN tasks t1 ON td.task_id = t1.id
      JOIN tasks t2 ON td.depends_on_task_id = t2.id
      WHERE t1.user_id = $1 
        AND t1.status != 'completed'
        AND t2.status != 'completed'
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => row.task_id);
  }

  /**
   * Get tasks that can be unblocked (all dependencies are completed)
   */
  async getUnblockableTasks(userId: string): Promise<string[]> {
    const query = `
      SELECT t.id
      FROM tasks t
      WHERE t.user_id = $1 
        AND t.status = 'blocked'
        AND NOT EXISTS (
          SELECT 1 
          FROM task_dependencies td
          JOIN tasks dep ON td.depends_on_task_id = dep.id
          WHERE td.task_id = t.id 
            AND dep.status != 'completed'
        )
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => row.id);
  }

  /**
   * Get dependency chain for a task (all tasks it transitively depends on)
   */
  async getDependencyChain(taskId: string, userId: string): Promise<string[]> {
    const graph = await this.getDependencyGraph(userId);
    const visited = new Set<string>();
    const chain: string[] = [];

    const dfs = (currentTaskId: string) => {
      if (visited.has(currentTaskId)) {
        return;
      }
      
      visited.add(currentTaskId);
      const dependencies = graph[currentTaskId] || [];
      
      for (const depId of dependencies) {
        dfs(depId);
        if (!chain.includes(depId)) {
          chain.push(depId);
        }
      }
    };

    dfs(taskId);
    return chain;
  }

  /**
   * Remove all dependencies for a task (when task is deleted)
   */
  async removeAllTaskDependencies(taskId: string): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Remove dependencies where this task depends on others
      await client.query(
        'DELETE FROM task_dependencies WHERE task_id = $1',
        [taskId]
      );

      // Remove dependencies where other tasks depend on this task
      await client.query(
        'DELETE FROM task_dependencies WHERE depends_on_task_id = $1',
        [taskId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check for cycles in dependency graph using DFS
   */
  private hasCycle(graph: DependencyGraph, node: string, visited: Set<string>, recursionStack: Set<string>): boolean {
    if (recursionStack.has(node)) {
      return true; // Cycle detected
    }

    if (visited.has(node)) {
      return false; // Already processed
    }

    visited.add(node);
    recursionStack.add(node);

    const dependencies = graph[node] || [];
    for (const dep of dependencies) {
      if (this.hasCycle(graph, dep, visited, recursionStack)) {
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }
}