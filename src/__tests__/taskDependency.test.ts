import { TaskDependencyService } from '@/services/TaskDependencyService';
import { TaskDependencyRepository } from '@/repositories/TaskDependencyRepository';
import { TaskRepository } from '@/repositories/TaskRepository';

// Mock the repositories
jest.mock('@/repositories/TaskDependencyRepository');
jest.mock('@/repositories/TaskRepository');
const MockedTaskDependencyRepository = TaskDependencyRepository as jest.MockedClass<typeof TaskDependencyRepository>;
const MockedTaskRepository = TaskRepository as jest.MockedClass<typeof TaskRepository>;

describe('TaskDependencyService', () => {
  let dependencyService: TaskDependencyService;
  let mockDependencyRepository: jest.Mocked<TaskDependencyRepository>;
  let mockTaskRepository: jest.Mocked<TaskRepository>;

  const mockUserId = 'user-123';
  const mockTaskId = 'task-123';
  const mockDependencyTaskId = 'task-456';

  const mockTask = {
    id: mockTaskId,
    userId: mockUserId,
    status: 'pending' as const,
    title: 'Test Task',
    duration: 60,
    completedMinutes: 0,
    remainingMinutes: 60
  };

  const mockDependencyTask = {
    id: mockDependencyTaskId,
    userId: mockUserId,
    status: 'completed' as const,
    title: 'Dependency Task',
    duration: 30,
    completedMinutes: 30,
    remainingMinutes: 0
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDependencyRepository = new MockedTaskDependencyRepository() as jest.Mocked<TaskDependencyRepository>;
    mockTaskRepository = new MockedTaskRepository() as jest.Mocked<TaskRepository>;
    dependencyService = new TaskDependencyService();
    // Replace the repository instances
    (dependencyService as any).dependencyRepository = mockDependencyRepository;
    (dependencyService as any).taskRepository = mockTaskRepository;
  });

  describe('addTaskDependency', () => {
    it('should add dependency successfully', async () => {
      const mockDependency = {
        id: 'dep-123',
        taskId: mockTaskId,
        dependsOnTaskId: mockDependencyTaskId,
        createdAt: new Date()
      };

      mockDependencyRepository.wouldCreateCircularDependency.mockResolvedValue(false);
      mockDependencyRepository.addDependency.mockResolvedValue(mockDependency);
      mockTaskRepository.findById.mockResolvedValue(mockTask as any);

      const result = await dependencyService.addTaskDependency(mockTaskId, mockDependencyTaskId, mockUserId);

      expect(mockDependencyRepository.wouldCreateCircularDependency).toHaveBeenCalledWith(
        mockTaskId, mockDependencyTaskId, mockUserId
      );
      expect(mockDependencyRepository.addDependency).toHaveBeenCalledWith(
        mockTaskId, mockDependencyTaskId, mockUserId
      );
      expect(result).toEqual(mockDependency);
    });

    it('should throw error for self-dependency', async () => {
      await expect(dependencyService.addTaskDependency(mockTaskId, mockTaskId, mockUserId))
        .rejects.toThrow('A task cannot depend on itself');

      expect(mockDependencyRepository.wouldCreateCircularDependency).not.toHaveBeenCalled();
    });

    it('should throw error for circular dependency', async () => {
      mockDependencyRepository.wouldCreateCircularDependency.mockResolvedValue(true);

      await expect(dependencyService.addTaskDependency(mockTaskId, mockDependencyTaskId, mockUserId))
        .rejects.toThrow('Adding this dependency would create a circular dependency');

      expect(mockDependencyRepository.addDependency).not.toHaveBeenCalled();
    });
  });

  describe('removeTaskDependency', () => {
    it('should remove dependency successfully', async () => {
      mockDependencyRepository.removeDependency.mockResolvedValue(true);
      mockTaskRepository.findById.mockResolvedValue(mockTask as any);

      await dependencyService.removeTaskDependency(mockTaskId, mockDependencyTaskId, mockUserId);

      expect(mockDependencyRepository.removeDependency).toHaveBeenCalledWith(
        mockTaskId, mockDependencyTaskId, mockUserId
      );
    });

    it('should throw error when dependency not found', async () => {
      mockDependencyRepository.removeDependency.mockResolvedValue(false);

      await expect(dependencyService.removeTaskDependency(mockTaskId, mockDependencyTaskId, mockUserId))
        .rejects.toThrow('Dependency not found');
    });
  });

  describe('getDependencyStatus', () => {
    it('should return not blocked when no dependencies', async () => {
      mockDependencyRepository.getTaskDependencies.mockResolvedValue([]);

      const result = await dependencyService.getDependencyStatus(mockTaskId, mockUserId);

      expect(result).toEqual({
        isBlocked: false,
        blockingTasks: [],
        canBeScheduled: true
      });
    });

    it('should return blocked when dependencies are incomplete', async () => {
      const incompleteDependency = { ...mockDependencyTask, status: 'pending' as const };
      
      mockDependencyRepository.getTaskDependencies.mockResolvedValue([mockDependencyTaskId]);
      mockTaskRepository.findById.mockResolvedValue(incompleteDependency as any);

      const result = await dependencyService.getDependencyStatus(mockTaskId, mockUserId);

      expect(result).toEqual({
        isBlocked: true,
        blockingTasks: [mockDependencyTaskId],
        canBeScheduled: false
      });
    });

    it('should return not blocked when all dependencies are completed', async () => {
      mockDependencyRepository.getTaskDependencies.mockResolvedValue([mockDependencyTaskId]);
      mockTaskRepository.findById.mockResolvedValue(mockDependencyTask as any);

      const result = await dependencyService.getDependencyStatus(mockTaskId, mockUserId);

      expect(result).toEqual({
        isBlocked: false,
        blockingTasks: [],
        canBeScheduled: true
      });
    });
  });

  describe('processTaskCompletion', () => {
    it('should unblock dependent tasks when task is completed', async () => {
      const dependentTaskId = 'dependent-123';
      const blockedTask = { ...mockTask, id: dependentTaskId, status: 'blocked' as const };

      mockDependencyRepository.getTaskDependents.mockResolvedValue([dependentTaskId]);
      mockDependencyRepository.getTaskDependencies.mockResolvedValue([mockTaskId]);
      mockTaskRepository.findById
        .mockResolvedValueOnce(blockedTask as any) // First call for dependency status
        .mockResolvedValueOnce(mockDependencyTask as any) // Second call for completed dependency
        .mockResolvedValueOnce(blockedTask as any); // Third call for status update check
      mockTaskRepository.updateStatus.mockResolvedValue(blockedTask as any);

      const result = await dependencyService.processTaskCompletion(mockTaskId, mockUserId);

      expect(mockDependencyRepository.getTaskDependents).toHaveBeenCalledWith(mockTaskId, mockUserId);
      expect(mockTaskRepository.updateStatus).toHaveBeenCalledWith(dependentTaskId, mockUserId, 'pending');
      expect(result).toEqual([dependentTaskId]);
    });

    it('should not unblock tasks that still have incomplete dependencies', async () => {
      const dependentTaskId = 'dependent-123';
      const blockedTask = { ...mockTask, id: dependentTaskId, status: 'blocked' as const };
      const incompleteDependency = { ...mockDependencyTask, status: 'pending' as const };

      mockDependencyRepository.getTaskDependents.mockResolvedValue([dependentTaskId]);
      mockDependencyRepository.getTaskDependencies.mockResolvedValue([mockTaskId, 'other-task']);
      mockTaskRepository.findById
        .mockResolvedValueOnce(blockedTask as any) // First call for dependency status
        .mockResolvedValueOnce(mockDependencyTask as any) // Completed dependency
        .mockResolvedValueOnce(incompleteDependency as any); // Incomplete dependency

      const result = await dependencyService.processTaskCompletion(mockTaskId, mockUserId);

      expect(mockTaskRepository.updateStatus).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('validateDependencyGraph', () => {
    it('should return valid for acyclic graph', async () => {
      const graph = {
        'task-1': ['task-2'],
        'task-2': ['task-3'],
        'task-3': []
      };

      mockDependencyRepository.getDependencyGraph.mockResolvedValue(graph);

      const result = await dependencyService.validateDependencyGraph(mockUserId);

      expect(result.isValid).toBe(true);
      expect(result.circularDependencies).toHaveLength(0);
    });

    it('should detect circular dependencies', async () => {
      const graph = {
        'task-1': ['task-2'],
        'task-2': ['task-3'],
        'task-3': ['task-1'] // Creates a cycle
      };

      mockDependencyRepository.getDependencyGraph.mockResolvedValue(graph);

      const result = await dependencyService.validateDependencyGraph(mockUserId);

      expect(result.isValid).toBe(false);
      expect(result.circularDependencies.length).toBeGreaterThan(0);
    });
  });

  describe('getTopologicalSort', () => {
    it('should return tasks in dependency order', async () => {
      const graph = {
        'task-1': ['task-2'],
        'task-2': ['task-3']
      };

      const mockTasks = [
        { id: 'task-1', title: 'Task 1' },
        { id: 'task-2', title: 'Task 2' },
        { id: 'task-3', title: 'Task 3' }
      ];

      mockDependencyRepository.getDependencyGraph.mockResolvedValue(graph);
      mockTaskRepository.findByUser.mockResolvedValue(mockTasks as any);

      const result = await dependencyService.getTopologicalSort(mockUserId);

      // task-3 should come before task-2, and task-2 should come before task-1
      const task3Index = result.indexOf('task-3');
      const task2Index = result.indexOf('task-2');
      const task1Index = result.indexOf('task-1');

      expect(task3Index).toBeLessThan(task2Index);
      expect(task2Index).toBeLessThan(task1Index);
    });
  });

  describe('removeAllTaskDependencies', () => {
    it('should remove all dependencies and update dependent tasks', async () => {
      const dependentTaskId = 'dependent-123';
      const dependentTask = { ...mockTask, id: dependentTaskId, status: 'blocked' as const };

      mockDependencyRepository.getTaskDependents.mockResolvedValue([dependentTaskId]);
      mockDependencyRepository.removeAllTaskDependencies.mockResolvedValue();
      mockDependencyRepository.getTaskDependencies.mockResolvedValue([]);
      mockTaskRepository.findById.mockResolvedValue(dependentTask as any);
      mockTaskRepository.updateStatus.mockResolvedValue(dependentTask as any);

      await dependencyService.removeAllTaskDependencies(mockTaskId, mockUserId);

      expect(mockDependencyRepository.getTaskDependents).toHaveBeenCalledWith(mockTaskId, mockUserId);
      expect(mockDependencyRepository.removeAllTaskDependencies).toHaveBeenCalledWith(mockTaskId);
      expect(mockTaskRepository.updateStatus).toHaveBeenCalledWith(dependentTaskId, mockUserId, 'pending');
    });
  });
});