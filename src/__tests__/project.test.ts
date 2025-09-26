import { ProjectService } from '@/services/ProjectService';
import { ProjectRepository } from '@/repositories/ProjectRepository';
import { TaskRepository } from '@/repositories/TaskRepository';
import { CreateProjectRequest } from '@/models/types';
import { Project } from '@/models/Project';

// Mock the repositories
jest.mock('@/repositories/ProjectRepository');
jest.mock('@/repositories/TaskRepository');
const MockedProjectRepository = ProjectRepository as jest.MockedClass<typeof ProjectRepository>;
const MockedTaskRepository = TaskRepository as jest.MockedClass<typeof TaskRepository>;

describe('ProjectService', () => {
  let projectService: ProjectService;
  let mockProjectRepository: jest.Mocked<ProjectRepository>;
  let mockTaskRepository: jest.Mocked<TaskRepository>;

  const mockUserId = 'user-123';
  const mockProjectId = 'project-123';

  const mockProject: Project = {
    id: mockProjectId,
    userId: mockUserId,
    name: 'Test Project',
    description: 'Test Description',
    color: '#FF0000',
    tasks: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockProjectRepository = new MockedProjectRepository() as jest.Mocked<ProjectRepository>;
    mockTaskRepository = new MockedTaskRepository() as jest.Mocked<TaskRepository>;
    projectService = new ProjectService();
    // Replace the repository instances
    (projectService as any).projectRepository = mockProjectRepository;
    (projectService as any).taskRepository = mockTaskRepository;
  });

  describe('createProject', () => {
    const validProjectData: CreateProjectRequest = {
      name: 'New Project',
      description: 'Project description',
      color: '#00FF00'
    };

    it('should create a project successfully', async () => {
      mockProjectRepository.create.mockResolvedValue(mockProject);

      const result = await projectService.createProject(mockUserId, validProjectData);

      expect(mockProjectRepository.create).toHaveBeenCalledWith(mockUserId, validProjectData);
      expect(result).toEqual(mockProject);
    });

    it('should throw error for empty project name', async () => {
      const invalidProjectData = { ...validProjectData, name: '' };

      await expect(projectService.createProject(mockUserId, invalidProjectData))
        .rejects.toThrow('Project name is required');

      expect(mockProjectRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for invalid color format', async () => {
      const invalidProjectData = { ...validProjectData, color: 'invalid-color' };

      await expect(projectService.createProject(mockUserId, invalidProjectData))
        .rejects.toThrow('Valid hex color is required (e.g., #FF0000)');

      expect(mockProjectRepository.create).not.toHaveBeenCalled();
    });

    it('should accept valid hex colors', async () => {
      const validColors = ['#FF0000', '#00ff00', '#0000FF', '#123ABC'];
      
      for (const color of validColors) {
        const projectData = { ...validProjectData, color };
        mockProjectRepository.create.mockResolvedValue({ ...mockProject, color });

        await projectService.createProject(mockUserId, projectData);

        expect(mockProjectRepository.create).toHaveBeenCalledWith(mockUserId, projectData);
      }
    });
  });

  describe('getProjectById', () => {
    it('should return project when found', async () => {
      mockProjectRepository.findById.mockResolvedValue(mockProject);

      const result = await projectService.getProjectById(mockProjectId, mockUserId);

      expect(mockProjectRepository.findById).toHaveBeenCalledWith(mockProjectId, mockUserId);
      expect(result).toEqual(mockProject);
    });

    it('should return null when project not found', async () => {
      mockProjectRepository.findById.mockResolvedValue(null);

      const result = await projectService.getProjectById(mockProjectId, mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('updateProject', () => {
    const updateData = {
      name: 'Updated Project',
      color: '#0000FF'
    };

    it('should update project successfully', async () => {
      const updatedProject = { ...mockProject, ...updateData };
      mockProjectRepository.update.mockResolvedValue(updatedProject);

      const result = await projectService.updateProject(mockProjectId, mockUserId, updateData);

      expect(mockProjectRepository.update).toHaveBeenCalledWith(mockProjectId, mockUserId, updateData);
      expect(result).toEqual(updatedProject);
    });

    it('should throw error when project not found', async () => {
      mockProjectRepository.update.mockResolvedValue(null);

      await expect(projectService.updateProject(mockProjectId, mockUserId, updateData))
        .rejects.toThrow('Project not found or access denied');
    });

    it('should throw error for empty name', async () => {
      const invalidUpdate = { name: '' };

      await expect(projectService.updateProject(mockProjectId, mockUserId, invalidUpdate))
        .rejects.toThrow('Project name cannot be empty');

      expect(mockProjectRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for invalid color', async () => {
      const invalidUpdate = { color: 'invalid' };

      await expect(projectService.updateProject(mockProjectId, mockUserId, invalidUpdate))
        .rejects.toThrow('Valid hex color is required (e.g., #FF0000)');

      expect(mockProjectRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteProject', () => {
    it('should delete project successfully when no tasks exist', async () => {
      mockTaskRepository.findByProject.mockResolvedValue([]);
      mockProjectRepository.delete.mockResolvedValue(true);

      await projectService.deleteProject(mockProjectId, mockUserId);

      expect(mockTaskRepository.findByProject).toHaveBeenCalledWith(mockProjectId, mockUserId);
      expect(mockProjectRepository.delete).toHaveBeenCalledWith(mockProjectId, mockUserId);
    });

    it('should throw error when project has tasks', async () => {
      const mockTasks = [{ id: 'task-1' }, { id: 'task-2' }] as any[];
      mockTaskRepository.findByProject.mockResolvedValue(mockTasks);

      await expect(projectService.deleteProject(mockProjectId, mockUserId))
        .rejects.toThrow('Cannot delete project with existing tasks. Please delete or move tasks first.');

      expect(mockProjectRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw error when project not found', async () => {
      mockTaskRepository.findByProject.mockResolvedValue([]);
      mockProjectRepository.delete.mockResolvedValue(false);

      await expect(projectService.deleteProject(mockProjectId, mockUserId))
        .rejects.toThrow('Project not found or access denied');
    });
  });

  describe('forceDeleteProject', () => {
    it('should delete project and all tasks', async () => {
      const mockTasks = [
        { id: 'task-1', userId: mockUserId },
        { id: 'task-2', userId: mockUserId }
      ] as any[];
      
      mockTaskRepository.findByProject.mockResolvedValue(mockTasks);
      mockTaskRepository.delete.mockResolvedValue(true);
      mockProjectRepository.delete.mockResolvedValue(true);

      await projectService.forceDeleteProject(mockProjectId, mockUserId);

      expect(mockTaskRepository.findByProject).toHaveBeenCalledWith(mockProjectId, mockUserId);
      expect(mockTaskRepository.delete).toHaveBeenCalledTimes(2);
      expect(mockTaskRepository.delete).toHaveBeenCalledWith('task-1', mockUserId);
      expect(mockTaskRepository.delete).toHaveBeenCalledWith('task-2', mockUserId);
      expect(mockProjectRepository.delete).toHaveBeenCalledWith(mockProjectId, mockUserId);
    });

    it('should throw error when project not found', async () => {
      mockTaskRepository.findByProject.mockResolvedValue([]);
      mockProjectRepository.delete.mockResolvedValue(false);

      await expect(projectService.forceDeleteProject(mockProjectId, mockUserId))
        .rejects.toThrow('Project not found or access denied');
    });
  });

  describe('getUserProjects', () => {
    it('should get user projects', async () => {
      const projects = [mockProject];
      mockProjectRepository.findByUser.mockResolvedValue(projects);

      const result = await projectService.getUserProjects(mockUserId);

      expect(mockProjectRepository.findByUser).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(projects);
    });
  });

  describe('getProjectProgress', () => {
    it('should get project progress', async () => {
      const mockProgress = {
        totalTasks: 5,
        completedTasks: 3,
        totalMinutes: 300,
        completedMinutes: 180,
        estimatedCompletion: new Date()
      };
      
      mockProjectRepository.getProjectProgress.mockResolvedValue(mockProgress);

      const result = await projectService.getProjectProgress(mockProjectId, mockUserId);

      expect(mockProjectRepository.getProjectProgress).toHaveBeenCalledWith(mockProjectId, mockUserId);
      expect(result).toEqual(mockProgress);
    });

    it('should throw error when project not found', async () => {
      mockProjectRepository.getProjectProgress.mockResolvedValue(null);

      await expect(projectService.getProjectProgress(mockProjectId, mockUserId))
        .rejects.toThrow('Project not found or access denied');
    });
  });

  describe('getProjectStatistics', () => {
    it('should calculate project statistics correctly', async () => {
      const mockSummaries = [
        {
          id: 'project-1',
          name: 'Project 1',
          color: '#FF0000',
          taskCount: 5,
          completedTasks: 3,
          totalMinutes: 300,
          completedMinutes: 180
        },
        {
          id: 'project-2',
          name: 'Project 2',
          color: '#00FF00',
          taskCount: 3,
          completedTasks: 2,
          totalMinutes: 150,
          completedMinutes: 100
        }
      ];

      mockProjectRepository.getProjectSummaries.mockResolvedValue(mockSummaries);

      const result = await projectService.getProjectStatistics(mockUserId);

      expect(result).toEqual({
        totalProjects: 2,
        totalTasks: 8,
        completedTasks: 5,
        totalMinutes: 450,
        completedMinutes: 280,
        averageCompletionRate: 62.5
      });
    });

    it('should handle empty projects list', async () => {
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

  describe('getProjectsByCompletionStatus', () => {
    it('should categorize projects by completion status', async () => {
      const mockSummaries = [
        {
          id: 'project-1',
          name: 'Completed Project',
          color: '#FF0000',
          taskCount: 3,
          completedTasks: 3,
          totalMinutes: 180,
          completedMinutes: 180
        },
        {
          id: 'project-2',
          name: 'In Progress Project',
          color: '#00FF00',
          taskCount: 5,
          completedTasks: 2,
          totalMinutes: 300,
          completedMinutes: 120
        },
        {
          id: 'project-3',
          name: 'Not Started Project',
          color: '#0000FF',
          taskCount: 0,
          completedTasks: 0,
          totalMinutes: 0,
          completedMinutes: 0
        }
      ];

      mockProjectRepository.getProjectSummaries.mockResolvedValue(mockSummaries);

      const result = await projectService.getProjectsByCompletionStatus(mockUserId);

      expect(result.completed).toHaveLength(1);
      expect(result.completed[0].name).toBe('Completed Project');
      expect(result.inProgress).toHaveLength(1);
      expect(result.inProgress[0].name).toBe('In Progress Project');
      expect(result.notStarted).toHaveLength(1);
      expect(result.notStarted[0].name).toBe('Not Started Project');
    });
  });
});