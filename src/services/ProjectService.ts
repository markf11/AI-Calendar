// @ts-nocheck
import { ProjectRepository } from '@/repositories/ProjectRepository';
import { TaskRepository } from '@/repositories/TaskRepository';
import { Project, ProjectWithTasks, ProjectSummary } from '@/models/Project';
import { CreateProjectRequest, ProjectProgress } from '@/models/types';

export class ProjectService {
  private projectRepository: ProjectRepository;
  private taskRepository: TaskRepository;

  constructor() {
    this.projectRepository = new ProjectRepository();
    this.taskRepository = new TaskRepository();
  }

  /**
   * Create a new project
   */
  async createProject(userId: string, projectData: CreateProjectRequest): Promise<Project> {
    // Validate project name
    if (!projectData.name || projectData.name.trim().length === 0) {
      throw new Error('Project name is required');
    }

    // Validate color format (hex color)
    if (!projectData.color || !/^#[0-9A-Fa-f]{6}$/.test(projectData.color)) {
      throw new Error('Valid hex color is required (e.g., #FF0000)');
    }

    return await this.projectRepository.create(userId, projectData);
  }

  /**
   * Get project by ID
   */
  async getProjectById(id: string, userId: string): Promise<Project | null> {
    return await this.projectRepository.findById(id, userId);
  }

  /**
   * Get project with tasks and progress
   */
  async getProjectWithTasks(id: string, userId: string): Promise<ProjectWithTasks | null> {
    return await this.projectRepository.findByIdWithTasks(id, userId);
  }

  /**
   * Get all projects for a user
   */
  async getUserProjects(userId: string): Promise<Project[]> {
    return await this.projectRepository.findByUser(userId);
  }

  /**
   * Get projects with task counts
   */
  async getUserProjectsWithTaskCounts(userId: string): Promise<Array<Project & { taskCount: number }>> {
    return await this.projectRepository.findByUserWithTaskCounts(userId);
  }

  /**
   * Update project
   */
  async updateProject(id: string, userId: string, updates: Partial<CreateProjectRequest>): Promise<Project> {
    // Validate project name if provided
    if (updates.name !== undefined && (!updates.name || updates.name.trim().length === 0)) {
      throw new Error('Project name cannot be empty');
    }

    // Validate color format if provided
    if (updates.color !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(updates.color)) {
      throw new Error('Valid hex color is required (e.g., #FF0000)');
    }

    const updatedProject = await this.projectRepository.update(id, userId, updates);
    
    if (!updatedProject) {
      throw new Error('Project not found or access denied');
    }

    return updatedProject;
  }

  /**
   * Delete project
   */
  async deleteProject(id: string, userId: string): Promise<void> {
    // Check if project has tasks
    const tasks = await this.taskRepository.findByProject(id, userId);
    
    if (tasks.length > 0) {
      throw new Error('Cannot delete project with existing tasks. Please delete or move tasks first.');
    }

    const deleted = await this.projectRepository.delete(id, userId);
    
    if (!deleted) {
      throw new Error('Project not found or access denied');
    }
  }

  /**
   * Force delete project (removes all tasks)
   */
  async forceDeleteProject(id: string, userId: string): Promise<void> {
    // Get all tasks in the project
    const tasks = await this.taskRepository.findByProject(id, userId);
    
    // Delete all tasks first
    for (const task of tasks) {
      await this.taskRepository.delete(task.id, userId);
    }

    // Then delete the project
    const deleted = await this.projectRepository.delete(id, userId);
    
    if (!deleted) {
      throw new Error('Project not found or access denied');
    }
  }

  /**
   * Get project summaries for dashboard
   */
  async getProjectSummaries(userId: string): Promise<ProjectSummary[]> {
    return await this.projectRepository.getProjectSummaries(userId);
  }

  /**
   * Get project progress
   */
  async getProjectProgress(id: string, userId: string): Promise<ProjectProgress> {
    const progress = await this.projectRepository.getProjectProgress(id, userId);
    
    if (!progress) {
      throw new Error('Project not found or access denied');
    }

    return progress;
  }

  /**
   * Check if project exists and belongs to user
   */
  async projectExists(id: string, userId: string): Promise<boolean> {
    return await this.projectRepository.exists(id, userId);
  }

  /**
   * Get project statistics
   */
  async getProjectStatistics(userId: string): Promise<{
    totalProjects: number;
    totalTasks: number;
    completedTasks: number;
    totalMinutes: number;
    completedMinutes: number;
    averageCompletionRate: number;
  }> {
    const summaries = await this.projectRepository.getProjectSummaries(userId);
    
    const totalProjects = summaries.length;
    const totalTasks = summaries.reduce((sum, project) => sum + project.taskCount, 0);
    const completedTasks = summaries.reduce((sum, project) => sum + project.completedTasks, 0);
    const totalMinutes = summaries.reduce((sum, project) => sum + project.totalMinutes, 0);
    const completedMinutes = summaries.reduce((sum, project) => sum + project.completedMinutes, 0);
    
    const averageCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return {
      totalProjects,
      totalTasks,
      completedTasks,
      totalMinutes,
      completedMinutes,
      averageCompletionRate: Math.round(averageCompletionRate * 100) / 100 // Round to 2 decimal places
    };
  }

  /**
   * Get projects by completion status
   */
  async getProjectsByCompletionStatus(userId: string): Promise<{
    completed: ProjectSummary[];
    inProgress: ProjectSummary[];
    notStarted: ProjectSummary[];
  }> {
    const summaries = await this.projectRepository.getProjectSummaries(userId);
    
    const completed = summaries.filter(project => 
      project.taskCount > 0 && project.completedTasks === project.taskCount
    );
    
    const inProgress = summaries.filter(project => 
      project.taskCount > 0 && project.completedTasks > 0 && project.completedTasks < project.taskCount
    );
    
    const notStarted = summaries.filter(project => 
      project.taskCount === 0 || project.completedTasks === 0
    );

    return {
      completed,
      inProgress,
      notStarted
    };
  }

  /**
   * Get most active projects (by task count)
   */
  async getMostActiveProjects(userId: string, limit: number = 5): Promise<ProjectSummary[]> {
    const summaries = await this.projectRepository.getProjectSummaries(userId);
    
    return summaries
      .sort((a, b) => b.taskCount - a.taskCount)
      .slice(0, limit);
  }

  /**
   * Get recently updated projects
   */
  async getRecentlyUpdatedProjects(userId: string, limit: number = 5): Promise<Project[]> {
    const projects = await this.projectRepository.findByUser(userId);
    
    return projects
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  /**
   * Get project progress analytics with completion history
   */
  async getProjectProgressAnalytics(projectId: string, userId: string, dateRange?: { start: Date; end: Date }): Promise<{
    project: Project;
    progress: ProjectProgress;
    completionHistory: Array<{ date: string; tasksCompleted: number; minutesLogged: number }>;
    taskBreakdown: {
      byPriority: Record<string, { count: number; completed: number }>;
      byStatus: Record<string, number>;
    };
  }> {
    // Verify project exists and belongs to user
    const project = await this.projectRepository.findById(projectId, userId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // Get project progress
    const progress = await this.projectRepository.getProjectProgress(projectId, userId);
    if (!progress) {
      throw new Error('Failed to get project progress');
    }

    // Get completion history from task repository
    const completionHistory = await this.projectRepository.getProjectCompletionHistory(projectId, userId, dateRange);

    // Get task breakdown
    const taskBreakdown = await this.projectRepository.getProjectTaskBreakdown(projectId, userId);

    return {
      project,
      progress,
      completionHistory,
      taskBreakdown
    };
  }

  /**
   * Get all projects progress overview
   */
  async getAllProjectsProgressOverview(userId: string): Promise<{
    totalProjects: number;
    completedProjects: number;
    inProgressProjects: number;
    notStartedProjects: number;
    totalTasks: number;
    completedTasks: number;
    totalMinutes: number;
    completedMinutes: number;
    overallCompletionRate: number;
    projectsProgress: Array<{
      id: string;
      name: string;
      color: string;
      completionRate: number;
      totalTasks: number;
      completedTasks: number;
      estimatedCompletion?: Date;
    }>;
  }> {
    const summaries = await this.projectRepository.getProjectSummaries(userId);
    
    const totalProjects = summaries.length;
    const completedProjects = summaries.filter(p => p.taskCount > 0 && p.completedTasks === p.taskCount).length;
    const inProgressProjects = summaries.filter(p => p.taskCount > 0 && p.completedTasks > 0 && p.completedTasks < p.taskCount).length;
    const notStartedProjects = summaries.filter(p => p.taskCount === 0 || p.completedTasks === 0).length;
    
    const totalTasks = summaries.reduce((sum, p) => sum + p.taskCount, 0);
    const completedTasks = summaries.reduce((sum, p) => sum + p.completedTasks, 0);
    const totalMinutes = summaries.reduce((sum, p) => sum + p.totalMinutes, 0);
    const completedMinutes = summaries.reduce((sum, p) => sum + p.completedMinutes, 0);
    
    const overallCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const projectsProgress = summaries.map(summary => ({
      id: summary.id,
      name: summary.name,
      color: summary.color,
      completionRate: summary.taskCount > 0 ? (summary.completedTasks / summary.taskCount) * 100 : 0,
      totalTasks: summary.taskCount,
      completedTasks: summary.completedTasks,
      estimatedCompletion: summary.estimatedCompletion
    }));

    return {
      totalProjects,
      completedProjects,
      inProgressProjects,
      notStartedProjects,
      totalTasks,
      completedTasks,
      totalMinutes,
      completedMinutes,
      overallCompletionRate: Math.round(overallCompletionRate * 100) / 100,
      projectsProgress
    };
  }
}