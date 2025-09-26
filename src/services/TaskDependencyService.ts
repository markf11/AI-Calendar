import { TaskDependencyRepository, TaskDependency, DependencyGraph } from '@/repositories/TaskDependencyRepository';
import { TaskRepository } from '@/repositories/TaskRepository';
import { DependencyStatus } from '@/models/types';

export class TaskDependencyService {
  private dependencyRepository: TaskDependencyRepository;
  private taskRepository: TaskRepository;

  constructor() {
    this.dependencyRepository = new TaskDependencyRepository();
    this.taskRepository = new TaskRepository();
  }

  /**
   * Add a dependency relationship between tasks
   */
  async addTaskDependency(taskId: string, dependsOnTaskId: string, userId: string): Promise<TaskDependency> {
    // Validate that tasks are different
    if (taskId === dependsOnTaskId) {
      throw new Error('A task cannot depend on itself');
    }

    // Check if this would create a circular dependency
    const wouldCreateCycle = await this.dependencyRepository.wouldCreateCircularDependency(
      taskId, 
      dependsOnTaskId, 
      userId
    );

    if (wouldCreateCycle) {
      throw new Error('Adding this dependency would create a circular dependency');
    }

    // Add the dependency
    const dependency = await this.dependencyRepository.addDependency(taskId, dependsOnTaskId, userId);

    // Update task status to blocked if the dependency is not completed
    await this.updateTaskBlockedStatus(taskId, userId);

    return dependency;
  }

  /**
   * Remove a dependency relationship
   */
  async removeTaskDependency(taskId: string, dependsOnTaskId: string, userId: string): Promise<void> {
    const removed = await this.dependencyRepository.removeDependency(taskId, dependsOnTaskId, userId);
    
    if (!removed) {
      throw new Error('Dependency not found');
    }

    // Check if task can be unblocked
    await this.updateTaskBlockedStatus(taskId, userId);
  }

  /**
   * Get all dependencies for a task
   */
  async getTaskDependencies(taskId: string, userId: string): Promise<string[]> {
    return await this.dependencyRepository.getTaskDependencies(taskId, userId);
  }

  /**
   * Get all dependents for a task
   */
  async getTaskDependents(taskId: string, userId: string): Promise<string[]> {
    return await this.dependencyRepository.getTaskDependents(taskId, userId);
  }

  /**
   * Get dependency status for a task
   */
  async getDependencyStatus(taskId: string, userId: string): Promise<DependencyStatus> {
    const dependencies = await this.dependencyRepository.getTaskDependencies(taskId, userId);
    
    if (dependencies.length === 0) {
      return {
        isBlocked: false,
        blockingTasks: [],
        canBeScheduled: true
      };
    }

    // Check which dependencies are not completed
    const blockingTasks: string[] = [];
    
    for (const depId of dependencies) {
      const depTask = await this.taskRepository.findById(depId, userId);
      if (depTask && depTask.status !== 'completed') {
        blockingTasks.push(depId);
      }
    }

    return {
      isBlocked: blockingTasks.length > 0,
      blockingTasks,
      canBeScheduled: blockingTasks.length === 0
    };
  }

  /**
   * Get the complete dependency graph for a user
   */
  async getDependencyGraph(userId: string): Promise<DependencyGraph> {
    return await this.dependencyRepository.getDependencyGraph(userId);
  }

  /**
   * Process task completion and unblock dependent tasks
   */
  async processTaskCompletion(completedTaskId: string, userId: string): Promise<string[]> {
    // Get all tasks that depend on the completed task
    const dependentTasks = await this.dependencyRepository.getTaskDependents(completedTaskId, userId);
    const unblockedTasks: string[] = [];

    // Check each dependent task to see if it can be unblocked
    for (const taskId of dependentTasks) {
      const dependencyStatus = await this.getDependencyStatus(taskId, userId);
      
      if (dependencyStatus.canBeScheduled) {
        // Update task status from blocked to pending
        const task = await this.taskRepository.findById(taskId, userId);
        if (task && task.status === 'blocked') {
          await this.taskRepository.updateStatus(taskId, userId, 'pending');
          unblockedTasks.push(taskId);
        }
      }
    }

    return unblockedTasks;
  }

  /**
   * Get all blocked tasks for a user
   */
  async getBlockedTasks(userId: string): Promise<string[]> {
    return await this.dependencyRepository.getBlockedTasks(userId);
  }

  /**
   * Get tasks that can be unblocked
   */
  async getUnblockableTasks(userId: string): Promise<string[]> {
    return await this.dependencyRepository.getUnblockableTasks(userId);
  }

  /**
   * Get dependency chain for a task
   */
  async getDependencyChain(taskId: string, userId: string): Promise<string[]> {
    return await this.dependencyRepository.getDependencyChain(taskId, userId);
  }

  /**
   * Validate dependency graph for circular dependencies
   */
  async validateDependencyGraph(userId: string): Promise<{
    isValid: boolean;
    circularDependencies: string[][];
  }> {
    const graph = await this.dependencyRepository.getDependencyGraph(userId);
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circularDependencies: string[][] = [];

    const findCycles = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        const cycle = path.slice(cycleStart).concat([node]);
        circularDependencies.push(cycle);
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const dependencies = graph[node] || [];
      for (const dep of dependencies) {
        findCycles(dep, [...path]);
      }

      recursionStack.delete(node);
      path.pop();
    };

    // Check all nodes in the graph
    const allNodes = new Set([
      ...Object.keys(graph),
      ...Object.values(graph).flat()
    ]);

    for (const node of allNodes) {
      if (!visited.has(node)) {
        findCycles(node, []);
      }
    }

    return {
      isValid: circularDependencies.length === 0,
      circularDependencies
    };
  }

  /**
   * Get topological sort of tasks (dependency-aware ordering)
   */
  async getTopologicalSort(userId: string): Promise<string[]> {
    const graph = await this.dependencyRepository.getDependencyGraph(userId);
    const visited = new Set<string>();
    const result: string[] = [];

    const dfs = (node: string): void => {
      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      const dependencies = graph[node] || [];
      
      // Visit all dependencies first
      for (const dep of dependencies) {
        dfs(dep);
      }

      result.push(node);
    };

    // Get all tasks for the user
    const allTasks = await this.taskRepository.findByUser(userId);
    
    // Process all tasks
    for (const task of allTasks) {
      if (!visited.has(task.id)) {
        dfs(task.id);
      }
    }

    return result;
  }

  /**
   * Remove all dependencies for a task (when task is deleted)
   */
  async removeAllTaskDependencies(taskId: string, userId: string): Promise<void> {
    // Get dependent tasks before removing dependencies
    const dependentTasks = await this.dependencyRepository.getTaskDependents(taskId, userId);
    
    // Remove all dependencies
    await this.dependencyRepository.removeAllTaskDependencies(taskId);

    // Update status of dependent tasks
    for (const depTaskId of dependentTasks) {
      await this.updateTaskBlockedStatus(depTaskId, userId);
    }
  }

  /**
   * Update task blocked status based on dependencies
   */
  private async updateTaskBlockedStatus(taskId: string, userId: string): Promise<void> {
    const task = await this.taskRepository.findById(taskId, userId);
    if (!task) {
      return;
    }

    const dependencyStatus = await this.getDependencyStatus(taskId, userId);
    
    // Update task status based on dependency status
    if (dependencyStatus.isBlocked && task.status !== 'blocked' && task.status !== 'completed') {
      await this.taskRepository.updateStatus(taskId, userId, 'blocked');
    } else if (!dependencyStatus.isBlocked && task.status === 'blocked') {
      await this.taskRepository.updateStatus(taskId, userId, 'pending');
    }
  }

  /**
   * Get dependency statistics for a user
   */
  async getDependencyStatistics(userId: string): Promise<{
    totalDependencies: number;
    blockedTasks: number;
    unblockableTasks: number;
    circularDependencies: number;
    averageDependenciesPerTask: number;
  }> {
    const graph = await this.dependencyRepository.getDependencyGraph(userId);
    const blockedTasks = await this.dependencyRepository.getBlockedTasks(userId);
    const unblockableTasks = await this.dependencyRepository.getUnblockableTasks(userId);
    const validation = await this.validateDependencyGraph(userId);
    
    const totalDependencies = Object.values(graph).reduce((sum, deps) => sum + deps.length, 0);
    const tasksWithDependencies = Object.keys(graph).length;
    const averageDependenciesPerTask = tasksWithDependencies > 0 ? totalDependencies / tasksWithDependencies : 0;

    return {
      totalDependencies,
      blockedTasks: blockedTasks.length,
      unblockableTasks: unblockableTasks.length,
      circularDependencies: validation.circularDependencies.length,
      averageDependenciesPerTask: Math.round(averageDependenciesPerTask * 100) / 100
    };
  }
}