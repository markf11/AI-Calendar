// @ts-nocheck
import { TaskService } from '@/services/TaskService';
import { TaskRepository } from '@/repositories/TaskRepository';
import { CreateTaskRequest, TaskCompletion } from '@/models/types';
import { Task } from '@/models/Task';

// Mock the TaskRepository
jest.mock('@/repositories/TaskRepository');
const MockedTaskRepository = TaskRepository as jest.MockedClass<typeof TaskRepository>;

describe('TaskService', () => {
  let taskService: TaskService;
  let mockTaskRepository: jest.Mocked<TaskRepository>;

  const mockUserId = 'user-123';
  const mockTaskId = 'task-123';
  const mockProjectId = 'project-123';

  const mockTask: Task = {
    id: mockTaskId,
    userId: mockUserId,
    projectId: mockProjectId,
    title: 'Test Task',
    description: 'Test Description',
    duration: 60,
    priority: 'high',
    deadline: new Date('2025-12-31'),
    isHardDeadline: false,
    isBlocking: false,
    dependencies: [],
    dependents: [],
    status: 'pending',
    completedMinutes: 0,
    remainingMinutes: 60,
    scheduledSlots: [],
    completionHistory: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTaskRepository = new MockedTaskRepository() as jest.Mocked<TaskRepository>;
    taskService = new TaskService();
    // Replace the repository instance
    (taskService as any).taskRepository = mockTaskRepository;
  });

  describe('createTask', () => {
    const validTaskData: CreateTaskRequest = {
      title: 'New Task',
      description: 'Task description',
      duration: 120,
      priority: 'medium',
      deadline: new Date('2025-12-31'),
      isHardDeadline: false,
      isBlocking: true,
      projectId: mockProjectId
    };

    it('should create a task successfully', async () => {
      mockTaskRepository.create.mockResolvedValue(mockTask);

      const result = await taskService.createTask(mockUserId, validTaskData);

      expect(mockTaskRepository.create).toHaveBeenCalledWith(mockUserId, validTaskData);
      expect(result).toEqual(mockTask);
    });

    it('should throw error for invalid duration', async () => {
      const invalidTaskData = { ...validTaskData, duration: 0 };

      await expect(taskService.createTask(mockUserId, invalidTaskData))
        .rejects.toThrow('Task duration must be greater than 0');

      expect(mockTaskRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for past deadline', async () => {
      const invalidTaskData = { ...validTaskData, deadline: new Date('2020-01-01') };

      await expect(taskService.createTask(mockUserId, invalidTaskData))
        .rejects.toThrow('Task deadline must be in the future');

      expect(mockTaskRepository.create).not.toHaveBeenCalled();
    });

    it('should set default values for optional fields', async () => {
      const minimalTaskData: CreateTaskRequest = {
        title: 'Minimal Task',
        duration: 60,
        priority: 'low'
      };

      mockTaskRepository.create.mockResolvedValue(mockTask);

      await taskService.createTask(mockUserId, minimalTaskData);

      expect(mockTaskRepository.create).toHaveBeenCalledWith(mockUserId, {
        ...minimalTaskData,
        isHardDeadline: false,
        isBlocking: false
      });
    });
  });

  describe('getTaskById', () => {
    it('should return task when found', async () => {
      mockTaskRepository.findById.mockResolvedValue(mockTask);

      const result = await taskService.getTaskById(mockTaskId, mockUserId);

      expect(mockTaskRepository.findById).toHaveBeenCalledWith(mockTaskId, mockUserId);
      expect(result).toEqual(mockTask);
    });

    it('should return null when task not found', async () => {
      mockTaskRepository.findById.mockResolvedValue(null);

      const result = await taskService.getTaskById(mockTaskId, mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('updateTask', () => {
    const updateData = {
      title: 'Updated Task',
      duration: 90,
      priority: 'critical' as const
    };

    it('should update task successfully', async () => {
      const updatedTask = { ...mockTask, ...updateData };
      mockTaskRepository.update.mockResolvedValue(updatedTask);

      const result = await taskService.updateTask(mockTaskId, mockUserId, updateData);

      expect(mockTaskRepository.update).toHaveBeenCalledWith(mockTaskId, mockUserId, updateData);
      expect(result).toEqual(updatedTask);
    });

    it('should throw error when task not found', async () => {
      mockTaskRepository.update.mockResolvedValue(null);

      await expect(taskService.updateTask(mockTaskId, mockUserId, updateData))
        .rejects.toThrow('Task not found or access denied');
    });

    it('should throw error for invalid duration', async () => {
      const invalidUpdate = { duration: -10 };

      await expect(taskService.updateTask(mockTaskId, mockUserId, invalidUpdate))
        .rejects.toThrow('Task duration must be greater than 0');

      expect(mockTaskRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error for past deadline', async () => {
      const invalidUpdate = { deadline: new Date('2020-01-01') };

      await expect(taskService.updateTask(mockTaskId, mockUserId, invalidUpdate))
        .rejects.toThrow('Task deadline must be in the future');

      expect(mockTaskRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteTask', () => {
    it('should delete task successfully', async () => {
      mockTaskRepository.delete.mockResolvedValue(true);

      await taskService.deleteTask(mockTaskId, mockUserId);

      expect(mockTaskRepository.delete).toHaveBeenCalledWith(mockTaskId, mockUserId);
    });

    it('should throw error when task not found', async () => {
      mockTaskRepository.delete.mockResolvedValue(false);

      await expect(taskService.deleteTask(mockTaskId, mockUserId))
        .rejects.toThrow('Task not found or access denied');
    });
  });

  describe('completeTask', () => {
    const completion: TaskCompletion = {
      minutesCompleted: 30,
      notes: 'Partial completion',
      isFullCompletion: false
    };

    it('should complete task successfully', async () => {
      mockTaskRepository.findById.mockResolvedValue(mockTask);
      const completedTask = { ...mockTask, completedMinutes: 30, remainingMinutes: 30 };
      mockTaskRepository.logCompletion.mockResolvedValue(completedTask);

      const result = await taskService.completeTask(mockTaskId, mockUserId, completion);

      expect(mockTaskRepository.findById).toHaveBeenCalledWith(mockTaskId, mockUserId);
      expect(mockTaskRepository.logCompletion).toHaveBeenCalledWith(mockTaskId, mockUserId, completion);
      expect(result).toEqual(completedTask);
    });

    it('should throw error for invalid minutes', async () => {
      const invalidCompletion = { ...completion, minutesCompleted: 0 };

      await expect(taskService.completeTask(mockTaskId, mockUserId, invalidCompletion))
        .rejects.toThrow('Minutes completed must be greater than 0');

      expect(mockTaskRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw error when task not found', async () => {
      mockTaskRepository.findById.mockResolvedValue(null);

      await expect(taskService.completeTask(mockTaskId, mockUserId, completion))
        .rejects.toThrow('Task not found or access denied');

      expect(mockTaskRepository.logCompletion).not.toHaveBeenCalled();
    });

    it('should throw error when logging more minutes than remaining', async () => {
      const taskWithProgress = { ...mockTask, completedMinutes: 50, remainingMinutes: 10 };
      mockTaskRepository.findById.mockResolvedValue(taskWithProgress);

      const excessiveCompletion = { ...completion, minutesCompleted: 20 };

      await expect(taskService.completeTask(mockTaskId, mockUserId, excessiveCompletion))
        .rejects.toThrow('Cannot log more minutes than remaining task duration');

      expect(mockTaskRepository.logCompletion).not.toHaveBeenCalled();
    });
  });

  describe('markTaskCompleted', () => {
    it('should mark task as completed', async () => {
      mockTaskRepository.findById.mockResolvedValue(mockTask);
      const completedTask = { ...mockTask, status: 'completed' as const, completedMinutes: 60, remainingMinutes: 0 };
      mockTaskRepository.logCompletion.mockResolvedValue(completedTask);

      const result = await taskService.markTaskCompleted(mockTaskId, mockUserId, 'Task finished');

      expect(mockTaskRepository.findById).toHaveBeenCalledWith(mockTaskId, mockUserId);
      expect(mockTaskRepository.logCompletion).toHaveBeenCalledWith(mockTaskId, mockUserId, {
        minutesCompleted: 60,
        notes: 'Task finished',
        isFullCompletion: true
      });
      expect(result).toEqual(completedTask);
    });

    it('should throw error when task not found', async () => {
      mockTaskRepository.findById.mockResolvedValue(null);

      await expect(taskService.markTaskCompleted(mockTaskId, mockUserId))
        .rejects.toThrow('Task not found or access denied');
    });
  });

  describe('unmarkTaskCompleted', () => {
    it('should unmark completed task', async () => {
      const completedTask = { ...mockTask, status: 'completed' as const };
      mockTaskRepository.findById.mockResolvedValue(completedTask);
      const restoredTask = { ...mockTask, status: 'pending' as const };
      mockTaskRepository.updateStatus.mockResolvedValue(restoredTask);

      const result = await taskService.unmarkTaskCompleted(mockTaskId, mockUserId);

      expect(mockTaskRepository.findById).toHaveBeenCalledWith(mockTaskId, mockUserId);
      expect(mockTaskRepository.updateStatus).toHaveBeenCalledWith(mockTaskId, mockUserId, 'pending');
      expect(result).toEqual(restoredTask);
    });

    it('should throw error when task is not completed', async () => {
      mockTaskRepository.findById.mockResolvedValue(mockTask);

      await expect(taskService.unmarkTaskCompleted(mockTaskId, mockUserId))
        .rejects.toThrow('Task is not marked as completed');

      expect(mockTaskRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw error when task not found', async () => {
      mockTaskRepository.findById.mockResolvedValue(null);

      await expect(taskService.unmarkTaskCompleted(mockTaskId, mockUserId))
        .rejects.toThrow('Task not found or access denied');
    });
  });

  describe('getUserTasks', () => {
    it('should get user tasks with filters', async () => {
      const tasks = [mockTask];
      const filters = { status: ['pending' as const], priority: ['high' as const] };
      mockTaskRepository.findByUser.mockResolvedValue(tasks);

      const result = await taskService.getUserTasks(mockUserId, filters);

      expect(mockTaskRepository.findByUser).toHaveBeenCalledWith(mockUserId, filters);
      expect(result).toEqual(tasks);
    });

    it('should get user tasks without filters', async () => {
      const tasks = [mockTask];
      mockTaskRepository.findByUser.mockResolvedValue(tasks);

      const result = await taskService.getUserTasks(mockUserId);

      expect(mockTaskRepository.findByUser).toHaveBeenCalledWith(mockUserId, undefined);
      expect(result).toEqual(tasks);
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status successfully', async () => {
      const updatedTask = { ...mockTask, status: 'in_progress' as const };
      mockTaskRepository.updateStatus.mockResolvedValue(updatedTask);

      const result = await taskService.updateTaskStatus(mockTaskId, mockUserId, 'in_progress');

      expect(mockTaskRepository.updateStatus).toHaveBeenCalledWith(mockTaskId, mockUserId, 'in_progress');
      expect(result).toEqual(updatedTask);
    });

    it('should throw error when task not found', async () => {
      mockTaskRepository.updateStatus.mockResolvedValue(null);

      await expect(taskService.updateTaskStatus(mockTaskId, mockUserId, 'in_progress'))
        .rejects.toThrow('Task not found or access denied');
    });
  });
});