import { ProjectService } from '@/services/ProjectService';
import { ProjectRepository } from '@/repositories/ProjectRepository';
import { TaskRepository } from '@/repositories/TaskRepository';
import { Project } from '@/models/Project';
import { ProjectProgress } from '@/models/types';

// Mock the dependencies
jest.mock('@/repositories/ProjectRepository');
jest.mock('@/repositories/TaskRepository');

describe('ProjectService - Progress Tracking', () => {
  let projectService: ProjectService;
  let mockProjectRepository: jest.Mocked<ProjectRepository>;
  let mockTaskRepository: jest.Mocked<TaskRepository>;

  const mockUserId = 'user-123';
  const mockProjectId = 'project-456';

  const mockProject: Project = {
    id: mockProjectId,
    userId: mockUserId,
    name: 'Test Project',
    description: 'A test project',
    color: '#3B82F6',
    tasks: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  };

  const mockProgress: ProjectProgress = {
    totalTasks: 10,
    completedTasks: 6,
    totalMinutes: 1200,
    completedMinutes: 720,
    estimatedCompletion: new Date('2024-02-15')
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockProjectRepository = new ProjectRepository() as jest.Mocked<ProjectRepository>;
    mockTaskRepository = new TaskRepository() as jest.Mocked<TaskRepository>;
    
    projectService = new ProjectService();
    (projectService as any).projectRepository = mockProjectRepository;
    (projectService as any).taskRepository = mockTaskRepository;
  });

  describe('getProjectProgressAnalytics', () => {
    it('should get comprehensive project analytics', async () => {
      const completionHistory = [
        { date: '2024-01-03', tasksCompleted: 2, minutesLogged: 240 },
        { date: '2024-01-02', tasksCompleted: 1, minutesLogged: 120 }
      ];

      const taskBreakdown = {
        byPriority: {
          critical: { count: 2, completed: 2 },
          high: { count: 3, completed: 2 },
          medium: { count: 4, completed: 2 },
          low: { count: 1, completed: 0 }
        },
        byStatus: {
          pending: 2,
          scheduled: 1,
          in_progress: 1,
          completed: 6,
          blocked: 0
        }
      };

      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockProjectRepository.getProjectProgress.mockResolvedValue(mockProgress);
      mockProjectRepository.getProjectCompletionHistory.mockResolvedValue(completionHistory);
      mockProjectRepository.getProjectTaskBreakdown.mockResolvedValue(taskBreakdown);

      const result = await projectService.getProjectProgressAnalytics(mockProjectId, mockUserId);

      expect(mockProjectRepository.findById).toHaveBeenCalledWith(mockProjectId, mockUserId);
      expect(mockProjectRepository.getProjectProgress).toHaveBeenCalledWith(mockProjectId, mockUserId);
      expect(mockProjectRepository.getProjectCompletionHistory).toHaveBeenCalledWith(mockProjectId, mockUserId, undefined);
      expect(mockProjectRepository.getProjectTaskBreakdown).toHaveBeenCalledWith(mockProjectId, mockUserId);

      expect(result).toEqual({
        project: mockProject,
        progress: mockProgress,
        completionHistory,
        taskBreakdown
      });
    });

    it('should get analytics with date range', async () => {
      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      const completionHistory = [
        { date: '2024-01-15', tasksCompleted: 1, minutesLogged: 120 }
      ];

      const taskBreakdown = {
        byPriority: {
          critical: { count: 1, completed: 1 },
          high: { count: 2, completed: 1 },
          medium: { count: 2, completed: 1 },
          low: { count: 0, completed: 0 }
        },
        byStatus: {
          pending: 1,
          scheduled: 1,
          in_progress: 0,
          completed: 3,
          blocked: 0
        }
      };

      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockProjectRepository.getProjectProgress.mockResolvedValue(mockProgress);
      mockProjectRepository.getProjectCompletionHistory.mockResolvedValue(completionHistory);
      mockProjectRepository.getProjectTaskBreakdown.mockResolvedValue(taskBreakdown);

      const result = await projectService.getProjectProgressAnalytics(mockProjectId, mockUserId, dateRange);

      expect(mockProjectRepository.getProjectCompletionHistory).toHaveBeenCalledWith(mockProjectId, mockUserId, dateRange);
      expect(result.completionHistory).toEqual(completionHistory);
    });

    it('should throw error for non-existent project', async () => {
      mockProjectRepository.findById.mockResolvedValue(null);

      await expect(projectService.getProjectProgressAnalytics(mockProjectId, mockUserId))
        .rejects.toThrow('Project not found or access denied');
    });

    it('should throw error when progress retrieval fails', async () => {
      mockProjectRepository.findById.mockResolvedValue(mockProject);
      mockProjectRepository.getProjectProgress.mockResolvedValue(null);

      await expect(projectService.getProjectProgressAnalytics(mockProjectId, mockUserId))
        .rejects.toThrow('Failed to get project progress');
    });
  });

  describe('getAllProjectsProgressOverview', () => {
    it('should get comprehensive overview of all projects', async () => {
      const projectSummaries = [
        {
          id: 'project-1',
          name: 'Project 1',
          color: '#3B82F6',
          taskCount: 5,
          completedTasks: 5,
          totalMinutes: 600,
          completedMinutes: 600,
          estimatedCompletion: new Date('2024-01-15')
        },
        {
          id: 'project-2',
          name: 'Project 2',
          color: '#EF4444',
          taskCount: 8,
          completedTasks: 4,
          totalMinutes: 960,
          completedMinutes: 480,
          estimatedCompletion: new Date('2024-02-20')
        },
        {
          id: 'project-3',
          name: 'Project 3',
          color: '#10B981',
          taskCount: 0,
          completedTasks: 0,
          totalMinutes: 0,
          completedMinutes: 0,
          estimatedCompletion: new Date('2024-03-01')
        }
      ];

      mockProjectRepository.getProjectSummaries.mockResolvedValue(projectSummaries);

      const result = await projectService.getAllProjectsProgressOverview(mockUserId);

      expect(mockProjectRepository.getProjectSummaries).toHaveBeenCalledWith(mockUserId);

      expect(result).toEqual({
        totalProjects: 3,
        completedProjects: 1, // Project 1 is fully completed
        inProgressProjects: 1, // Project 2 has partial completion
        notStartedProjects: 1, // Project 3 has no tasks or completion
        totalTasks: 13,
        completedTasks: 9,
        totalMinutes: 1560,
        completedMinutes: 1080,
        overallCompletionRate: 69.23, // (9/13) * 100, rounded to 2 decimals
        projectsProgress: [
          {
            id: 'project-1',
            name: 'Project 1',
            color: '#3B82F6',
            completionRate: 100,
            totalTasks: 5,
            completedTasks: 5,
            estimatedCompletion: new Date('2024-01-15')
          },
          {
            id: 'project-2',
            name: 'Project 2',
            color: '#EF4444',
            completionRate: 50,
            totalTasks: 8,
            completedTasks: 4,
            estimatedCompletion: new Date('2024-02-20')
          },
          {
            id: 'project-3',
            name: 'Project 3',
            color: '#10B981',
            completionRate: 0,
            totalTasks: 0,
            completedTasks: 0,
            estimatedCompletion: new Date('2024-03-01')
          }
        ]
      });
    });

    it('should handle empty project list', async () => {
      mockProjectRepository.getProjectSummaries.mockResolvedValue([]);

      const result = await projectService.getAllProjectsProgressOverview(mockUserId);

      expect(result).toEqual({
        totalProjects: 0,
        completedProjects: 0,
        inProgressProjects: 0,
        notStartedProjects: 0,
        totalTasks: 0,
        completedTasks: 0,
        totalMinutes: 0,
        completedMinutes: 0,
        overallCompletionRate: 0,
        projectsProgress: []
      });
    });
  });

  describe('getProjectsByCompletionStatus', () => {
    it('should categorize projects by completion status', async () => {
      const projectSummaries = [
        {
          id: 'project-1',
          name: 'Completed Project',
          color: '#10B981',
          taskCount: 5,
          completedTasks: 5,
          totalMinutes: 600,
          completedMinutes: 600
        },
        {
          id: 'project-2',
          name: 'In Progress Project',
          color: '#F59E0B',
          taskCount: 8,
          completedTasks: 4,
          totalMinutes: 960,
          completedMinutes: 480
        },
        {
          id: 'project-3',
          name: 'Not Started Project',
          color: '#6B7280',
          taskCount: 3,
          completedTasks: 0,
          totalMinutes: 360,
          completedMinutes: 0
        },
        {
          id: 'project-4',
          name: 'Empty Project',
          color: '#9CA3AF',
          taskCount: 0,
          completedTasks: 0,
          totalMinutes: 0,
          completedMinutes: 0
        }
      ];

      mockProjectRepository.getProjectSummaries.mockResolvedValue(projectSummaries);

      const result = await projectService.getProjectsByCompletionStatus(mockUserId);

      expect(result.completed).toHaveLength(1);
      expect(result.completed[0].name).toBe('Completed Project');

      expect(result.inProgress).toHaveLength(1);
      expect(result.inProgress[0].name).toBe('In Progress Project');

      expect(result.notStarted).toHaveLength(2);
      expect(result.notStarted.map(p => p.name)).toContain('Not Started Project');
      expect(result.notStarted.map(p => p.name)).toContain('Empty Project');
    });
  });

  describe('getProjectStatistics', () => {
    it('should calculate comprehensive project statistics', async () => {
      const projectSummaries = [
        {
          id: 'project-1',
          name: 'Project 1',
          color: '#3B82F6',
          taskCount: 5,
          completedTasks: 4,
          totalMinutes: 600,
          completedMinutes: 480
        },
        {
          id: 'project-2',
          name: 'Project 2',
          color: '#EF4444',
          taskCount: 8,
          completedTasks: 6,
          totalMinutes: 960,
          completedMinutes: 720
        }
      ];

      mockProjectRepository.getProjectSummaries.mockResolvedValue(projectSummaries);

      const result = await projectService.getProjectStatistics(mockUserId);

      expect(result).toEqual({
        totalProjects: 2,
        totalTasks: 13,
        completedTasks: 10,
        totalMinutes: 1560,
        completedMinutes: 1200,
        averageCompletionRate: 76.92 // (10/13) * 100, rounded to 2 decimals
      });
    });

    it('should handle zero tasks gracefully', async () => {
      mockProjectRepository.getProjectSummaries.mockResolvedValue([]);

      const result = await projectService.getProjectStatistics(mockUserId);

      expect(result).toEqual({
        totalProjects: 0,
        totalTasks: 0,
        completedTasks: 0,
        totalMinutes: 0,
        completedMinutes: 0,
        averageCompletionRate: 0
      });
    });
  });

  describe('getMostActiveProjects', () => {
    it('should return projects sorted by task count', async () => {
      const projectSummaries = [
        {
          id: 'project-1',
          name: 'Small Project',
          color: '#3B82F6',
          taskCount: 2,
          completedTasks: 1,
          totalMinutes: 240,
          completedMinutes: 120
        },
        {
          id: 'project-2',
          name: 'Large Project',
          color: '#EF4444',
          taskCount: 10,
          completedTasks: 5,
          totalMinutes: 1200,
          completedMinutes: 600
        },
        {
          id: 'project-3',
          name: 'Medium Project',
          color: '#10B981',
          taskCount: 5,
          completedTasks: 3,
          totalMinutes: 600,
          completedMinutes: 360
        }
      ];

      mockProjectRepository.getProjectSummaries.mockResolvedValue(projectSummaries);

      const result = await projectService.getMostActiveProjects(mockUserId, 2);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Large Project');
      expect(result[1].name).toBe('Medium Project');
    });
  });
});