import { Request, Response } from 'express';
import { ProjectService } from '@/services/ProjectService';
import { CreateProjectRequest } from '@/models/types';

export class ProjectController {
  private projectService: ProjectService;

  constructor() {
    this.projectService = new ProjectService();
  }

  /**
   * Create a new project
   */
  createProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const projectData: CreateProjectRequest = req.body;
      const project = await this.projectService.createProject(userId, projectData);

      res.status(201).json({
        success: true,
        data: project
      });
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(400).json({
        error: {
          message: error instanceof Error ? error.message : 'Failed to create project'
        }
      });
    }
  };

  /**
   * Get project by ID
   */
  getProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const { withTasks } = req.query;

      let project;
      if (withTasks === 'true') {
        project = await this.projectService.getProjectWithTasks(id, userId);
      } else {
        project = await this.projectService.getProjectById(id, userId);
      }

      if (!project) {
        res.status(404).json({
          error: { message: 'Project not found' }
        });
        return;
      }

      res.json({
        success: true,
        data: project
      });
    } catch (error) {
      console.error('Error getting project:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  };

  /**
   * Get all projects for the authenticated user
   */
  getProjects = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { withTaskCounts, summaryOnly } = req.query;

      let projects;
      if (summaryOnly === 'true') {
        projects = await this.projectService.getProjectSummaries(userId);
      } else if (withTaskCounts === 'true') {
        projects = await this.projectService.getUserProjectsWithTaskCounts(userId);
      } else {
        projects = await this.projectService.getUserProjects(userId);
      }

      res.json({
        success: true,
        data: projects
      });
    } catch (error) {
      console.error('Error getting projects:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  };

  /**
   * Update project
   */
  updateProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const updates = req.body;

      const project = await this.projectService.updateProject(id, userId, updates);

      res.json({
        success: true,
        data: project
      });
    } catch (error) {
      console.error('Error updating project:', error);
      res.status(400).json({
        error: {
          message: error instanceof Error ? error.message : 'Failed to update project'
        }
      });
    }
  };

  /**
   * Delete project
   */
  deleteProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const { force } = req.query;

      if (force === 'true') {
        await this.projectService.forceDeleteProject(id, userId);
      } else {
        await this.projectService.deleteProject(id, userId);
      }

      res.json({
        success: true,
        message: 'Project deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(400).json({
        error: {
          message: error instanceof Error ? error.message : 'Failed to delete project'
        }
      });
    }
  };

  /**
   * Get project progress
   */
  getProjectProgress = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
      const progress = await this.projectService.getProjectProgress(id, userId);

      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      console.error('Error getting project progress:', error);
      res.status(400).json({
        error: {
          message: error instanceof Error ? error.message : 'Failed to get project progress'
        }
      });
    }
  };

  /**
   * Get project statistics
   */
  getProjectStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const statistics = await this.projectService.getProjectStatistics(userId);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Error getting project statistics:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  };

  /**
   * Get projects by completion status
   */
  getProjectsByStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const projectsByStatus = await this.projectService.getProjectsByCompletionStatus(userId);

      res.json({
        success: true,
        data: projectsByStatus
      });
    } catch (error) {
      console.error('Error getting projects by status:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  };

  /**
   * Get most active projects
   */
  getMostActiveProjects = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 5;
      const projects = await this.projectService.getMostActiveProjects(userId, limit);

      res.json({
        success: true,
        data: projects
      });
    } catch (error) {
      console.error('Error getting most active projects:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  };

  /**
   * Get recently updated projects
   */
  getRecentlyUpdatedProjects = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 5;
      const projects = await this.projectService.getRecentlyUpdatedProjects(userId, limit);

      res.json({
        success: true,
        data: projects
      });
    } catch (error) {
      console.error('Error getting recently updated projects:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  };

  /**
   * Get project progress analytics with completion history
   */
  getProjectProgressAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const { id } = req.params;
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

      const analytics = await this.projectService.getProjectProgressAnalytics(id, userId, dateRange);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Error getting project progress analytics:', error);
      res.status(400).json({
        error: {
          message: error instanceof Error ? error.message : 'Failed to get project analytics'
        }
      });
    }
  };

  /**
   * Get all projects progress overview
   */
  getAllProjectsProgressOverview = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
      }

      const overview = await this.projectService.getAllProjectsProgressOverview(userId);

      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      console.error('Error getting projects progress overview:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  };
}