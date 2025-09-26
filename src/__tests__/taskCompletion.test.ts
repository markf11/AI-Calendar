import { TaskService } from '@/services/TaskService';
import { TaskRepository } from '@/repositories/TaskRepository';
import { TaskDependencyService } from '@/services/TaskDependencyService';
import { Task } from '@/models/Task';
import { TaskCompletion, TaskCompletionEntry, CreateTaskRequest } from '@/models/types';

// Mock the dependencies
jest.mock('@/repositories/TaskRepository');
jest.mock('@/services/TaskDependencyService');

describe('TaskService - Task Completion System', () => {
  let taskService: TaskService;
  let mockTaskRepository: jest.Mocked<TaskRepository>;
  let mockDependencyService: jest.Mocked<TaskDependencyService>;

  const mockUserId = 'user-123';
  const mockTaskId = 'task-456';

  const mockTask: Task = {
    id: mockTaskId,
    userId: mockUserId,
    projectId: 'project-789',
    title: 'Test Task',
    description: 'A test task',
    duration: 120, // 2 hours
    priority: 'medium',
    deadline: new Date('2024-12-31'),
    isHardDeadline: false,
    isBlocking: false,
    dependencies: [],
    dependents: [],
    status: 'pending',
    completedMinutes: 0,
    remainingMinutes: 120,
    scheduledSlots: [],
    completionHistory: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    completedAt: undefined
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockTaskRepository = new TaskRepository() as jest.Mocked<TaskRepository>;
    mockDependencyService = new TaskDependencyService() as jest.Mocked<TaskDependencyService>;
    
    taskService = new TaskService();
    (taskService as any).taskRepository = mockTaskRepository;
    (taskService as any).dependencyService = mockDependencyService;
  });

  describe('completeTask', () => {
    it('should complete a task fully', async () => {
      const completion: TaskCompletion = {
        minutesCompleted: 120,
        notes: 'Task completed successfully',
        isFullCompletion: true
      };

      const completedTask: Task = {
        ...mockTask,
        status: 'completed',
        completedMinutes: 120,
        remainingMinutes: 0,
        completedAt: new Date()
      };

      mockTaskRepository.findById.mockResolvedValue(mockTask);
      mockTaskRepository.logCompletion.mockResolvedValue(completedTask);
      mockDependencyService.processTaskCompletion.mockResolvedValue();

      const result = await taskService.completeTask(mockTaskId, mockUserId, completion);

      expect(mockTaskRepository.findById).toHaveBeenCalledWith(mockTaskId, mockUserId);
      expect(mockTaskRepository.logCompletion).toHaveBeenCalledWith(mockTaskId, mockUserId, completion);
      expect(mockDependencyService.processTaskCompletion).toHaveBeenCalledWith(mockTaskId, mockUserId);
      expect(result).toEqual(completedTask);
    });

    it('should log partial completion', async () => {
      const completion: TaskCompletion = {
        minutesCompleted: 60,
        notes: 'Halfway done',
        isFullCompletion: false
      };

      const partiallyCompletedTask: Task = {
        ...mockTask,
        status: 'in_progress',
        completedMinutes: 60,
        remainingMinutes: 60
      };

      mockTaskRepository.findById.mockResolvedValue(mockTask);
      mockTaskRepository.logCompletion.mockResolvedValue(partiallyCompletedTask);

      const result = await taskService.completeTask(mockTaskId, mockUserId, completion);

      expect(mockTaskRepository.logCompletion).toHaveBeenCalledWith(mockTaskId, mockUserId, completion);
      expect(mockDependencyService.processTaskCompletion).not.toHaveBeenCalled();
      expect(result).toEqual(partiallyCompletedTask);
    });

    it('should throw error for invalid minutes completed', async () => {
      const completion: TaskCompletion = {
        minutesCompleted: 0,
        isFullCompletion: false
      };

      await expect(taskService.completeTask(mockTaskId, mockUserId, completion))
        .rejects.toThrow('Minutes completed must be greater than 0');
    });

    it('should throw error for task not found', async () => {
      const completion: TaskCompletion = {
        minutesCompleted: 60,
        isFullCompletion: false
      };

      mockTaskRepository.findById.mockResolvedValue(null);

      await expect(taskService.completeTask(mockTaskId, mockUserId, completion))
        .rejects.toThrow('Task not found or access denied');
    });

    it('should throw error when logging more minutes than remaining', async () => {
      const completion: TaskCompletion = {
        minutesCompleted: 150, // More than remaining 120 minutes
        isFullCompletion: false
      };

      mockTaskRepository.findById.mockResolvedValue(mockTask);

      await expect(taskService.completeTask(mockTaskId, mockUserId, completion))
        .rejects.toThrow('Cannot log more minutes than remaining task duration');
    });

    it('should handle repository failure', async () => {
      const completion: TaskCompletion = {
        minutesCompleted: 60,
        isFullCompletion: false
      };

      mockTaskRepository.findById.mockResolvedValue(mockTask);
      mockTaskRepository.logCompletion.mockResolvedValue(null);

      await expect(taskService.completeTask(mockTaskId, mockUserId, completion))
        .rejects.toThrow('Failed to log task completion');
    });
  });

  describe('markTaskCompleted', () => {
    it('should mark task as completed with remaining minutes', async () => {
      const taskWithProgress: Task = {
        ...mockTask,
        completedMinutes: 60,
        remainingMinutes: 60
      };

      const completedTask: Task = {
        ...taskWithProgress,
        status: 'completed',
        completedMinutes: 120,
        remainingMinutes: 0,
        completedAt: new Date()
      };

      mockTaskRepository.findById.mockResolvedValue(taskWithProgress);
      mockTaskRepository.logCompletion.mockResolvedValue(completedTask);
      mockDependencyService.processTaskCompletion.mockResolvedValue();

      const result = await taskService.markTaskCompleted(mockTaskId, mockUserId, 'Finished early');

      expect(mockTaskRepository.logCompletion).toHaveBeenCalledWith(
        mockTaskId,
        mockUserId,
        {
          minutesCompleted: 60, // Remaining minutes
          notes: 'Finished early',
          isFullCompletion: true
        }
      );
      expect(mockDependencyService.processTaskCompletion).toHaveBeenCalledWith(mockTaskId, mockUserId);
      expect(result).toEqual(completedTask);
    });

    it('should throw error for task not found', async () => {
      mockTaskRepository.findById.mockResolvedValue(null);

      await expect(taskService.markTaskCompleted(mockTaskId, mockUserId))
        .rejects.toThrow('Task not found or access denied');
    });
  });

  describe('unmarkTaskCompleted', () => {
    it('should unmark completed task', async () => {
      const restoredTask: Task = {
        ...mockTask,
        status: 'pending',
        completedMinutes: 0,
        remainingMinutes: 120,
        completedAt: undefined
      };

      mockTaskRepository.unmarkCompleted.mockResolvedValue(restoredTask);

      const result = await taskService.unmarkTaskCompleted(mockTaskId, mockUserId);

      expect(mockTaskRepository.unmarkCompleted).toHaveBeenCalledWith(mockTaskId, mockUserId);
      expect(result).toEqual(restoredTask);
    });

    it('should throw error for task not found', async () => {
      mockTaskRepository.unmarkCompleted.mockResolvedValue(null);

      await expect(taskService.unmarkTaskCompleted(mockTaskId, mockUserId))
        .rejects.toThrow('Task not found or access denied');
    });
  });

  describe('logPartialProgress', () => {
    it('should log partial progress with notes', async () => {
      const partiallyCompletedTask: Task = {
        ...mockTask,
        completedMinutes: 30,
        remainingMinutes: 90
      };

      mockTaskRepository.findById.mockResolvedValue(mockTask);
      mockTaskRepository.logCompletion.mockResolvedValue(partiallyCompletedTask);

      const result = await taskService.logPartialProgress(mockTaskId, mockUserId, 30, 'Made good progress');

      expect(mockTaskRepository.logCompletion).toHaveBeenCalledWith(
        mockTaskId,
        mockUserId,
        {
          minutesCompleted: 30,
          notes: 'Made good progress',
          isFullCompletion: false
        }
      );
      expect(result).toEqual(partiallyCompletedTask);
    });

    it('should throw error for invalid minutes', async () => {
      await expect(taskService.logPartialProgress(mockTaskId, mockUserId, 0))
        .rejects.toThrow('Minutes completed must be greater than 0');

      await expect(taskService.logPartialProgress(mockTaskId, mockUserId, -10))
        .rejects.toThrow('Minutes completed must be greater than 0');
    });
  });

  describe('getTaskWithHistory', () => {
    it('should get task with completion history', async () => {
      const taskWithHistory: Task = {
        ...mockTask,
        completionHistory: [
          {
            timestamp: new Date('2024-01-02'),
            minutesLogged: 30,
            notes: 'First session',
            wasPartialCompletion: true
          },
          {
            timestamp: new Date('2024-01-03'),
            minutesLogged: 90,
            notes: 'Completed',
            wasPartialCompletion: false
          }
        ]
      };

      mockTaskRepository.findByIdWithHistory.mockResolvedValue(taskWithHistory);

      const result = await taskService.getTaskWithHistory(mockTaskId, mockUserId);

      expect(mockTaskRepository.findByIdWithHistory).toHaveBeenCalledWith(mockTaskId, mockUserId);
      expect(result).toEqual(taskWithHistory);
    });

    it('should return null for non-existent task', async () => {
      mockTaskRepository.findByIdWithHistory.mockResolvedValue(null);

      const result = await taskService.getTaskWithHistory(mockTaskId, mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('getTaskCompletionHistory', () => {
    it('should get completion history for existing task', async () => {
      const completionHistory: TaskCompletionEntry[] = [
        {
          timestamp: new Date('2024-01-02'),
          minutesLogged: 30,
          notes: 'First session',
          wasPartialCompletion: true
        },
        {
          timestamp: new Date('2024-01-03'),
          minutesLogged: 90,
          notes: 'Completed',
          wasPartialCompletion: false
        }
      ];

      mockTaskRepository.findById.mockResolvedValue(mockTask);
      mockTaskRepository.getCompletionHistory.mockResolvedValue(completionHistory);

      const result = await taskService.getTaskCompletionHistory(mockTaskId, mockUserId);

      expect(mockTaskRepository.findById).toHaveBeenCalledWith(mockTaskId, mockUserId);
      expect(mockTaskRepository.getCompletionHistory).toHaveBeenCalledWith(mockTaskId, mockUserId);
      expect(result).toEqual(completionHistory);
    });

    it('should throw error for non-existent task', async () => {
      mockTaskRepository.findById.mockResolvedValue(null);

      await expect(taskService.getTaskCompletionHistory(mockTaskId, mockUserId))
        .rejects.toThrow('Task not found or access denied');
    });
  });

  describe('getTaskProgressAnalytics', () => {
    it('should get task progress analytics', async () => {
      const analytics = {
        totalTasks: 10,
        completedTasks: 6,
        totalMinutes: 1200,
        completedMinutes: 720,
        averageCompletionTime: 2.5,
        completionRate: 60,
        dailyProgress: [
          { date: '2024-01-03', tasksCompleted: 2, minutesLogged: 240 },
          { date: '2024-01-02', tasksCompleted: 1, minutesLogged: 120 }
        ]
      };

      mockTaskRepository.getTaskProgressAnalytics.mockResolvedValue(analytics);

      const result = await taskService.getTaskProgressAnalytics(mockUserId);

      expect(mockTaskRepository.getTaskProgressAnalytics).toHaveBeenCalledWith(mockUserId, undefined);
      expect(result).toEqual(analytics);
    });

    it('should get analytics with date range', async () => {
      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      const analytics = {
        totalTasks: 5,
        completedTasks: 3,
        totalMinutes: 600,
        completedMinutes: 360,
        averageCompletionTime: 2.0,
        completionRate: 60,
        dailyProgress: [
          { date: '2024-01-15', tasksCompleted: 1, minutesLogged: 120 }
        ]
      };

      mockTaskRepository.getTaskProgressAnalytics.mockResolvedValue(analytics);

      const result = await taskService.getTaskProgressAnalytics(mockUserId, dateRange);

      expect(mockTaskRepository.getTaskProgressAnalytics).toHaveBeenCalledWith(mockUserId, dateRange);
      expect(result).toEqual(analytics);
    });
  });
});