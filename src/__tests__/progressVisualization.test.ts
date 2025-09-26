import { TaskRepository } from '@/repositories/TaskRepository';
import { ProjectRepository } from '@/repositories/ProjectRepository';
import { TaskCompletionEntry } from '@/models/types';

// Mock the database
jest.mock('@/config/database');

describe('Progress Visualization and History', () => {
  let taskRepository: TaskRepository;
  let projectRepository: ProjectRepository;

  const mockUserId = 'user-123';
  const mockTaskId = 'task-456';
  const mockProjectId = 'project-789';

  beforeEach(() => {
    jest.clearAllMocks();
    taskRepository = new TaskRepository();
    projectRepository = new ProjectRepository();
  });

  describe('TaskRepository - Completion History', () => {
    it('should get completion history for a task', async () => {
      const mockHistory: TaskCompletionEntry[] = [
        {
          timestamp: new Date('2024-01-03T10:00:00Z'),
          minutesLogged: 90,
          notes: 'Completed the task',
          wasPartialCompletion: false
        },
        {
          timestamp: new Date('2024-01-02T14:30:00Z'),
          minutesLogged: 30,
          notes: 'Made good progress',
          wasPartialCompletion: true
        }
      ];

      const mockQuery = jest.fn().mockResolvedValue({
        rows: [
          {
            timestamp: new Date('2024-01-03T10:00:00Z'),
            minutes_logged: 90,
            notes: 'Completed the task',
            was_partial_completion: false
          },
          {
            timestamp: new Date('2024-01-02T14:30:00Z'),
            minutes_logged: 30,
            notes: 'Made good progress',
            was_partial_completion: true
          }
        ]
      });

      (taskRepository as any).db = { query: mockQuery };

      const result = await taskRepository.getCompletionHistory(mockTaskId, mockUserId);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT tch.timestamp, tch.minutes_logged, tch.notes, tch.was_partial_completion'),
        [mockTaskId, mockUserId]
      );
      expect(result).toEqual(mockHistory);
    });

    it('should get task progress analytics', async () => {
      const mockAnalytics = {
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

      const mockStatsQuery = jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            total_tasks: '10',
            completed_tasks: '6',
            total_minutes: '1200',
            completed_minutes: '720',
            avg_completion_hours: '2.5'
          }]
        })
        .mockResolvedValueOnce({
          rows: [
            { date: '2024-01-03', tasks_completed: '2', minutes_logged: '240' },
            { date: '2024-01-02', tasks_completed: '1', minutes_logged: '120' }
          ]
        });

      (taskRepository as any).db = { query: mockStatsQuery };

      const result = await taskRepository.getTaskProgressAnalytics(mockUserId);

      expect(result).toEqual(mockAnalytics);
      expect(mockStatsQuery).toHaveBeenCalledTimes(2);
    });

    it('should get analytics with date range filter', async () => {
      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      const mockQuery = jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            total_tasks: '5',
            completed_tasks: '3',
            total_minutes: '600',
            completed_minutes: '360',
            avg_completion_hours: '2.0'
          }]
        })
        .mockResolvedValueOnce({
          rows: [
            { date: '2024-01-15', tasks_completed: '1', minutes_logged: '120' }
          ]
        });

      (taskRepository as any).db = { query: mockQuery };

      const result = await taskRepository.getTaskProgressAnalytics(mockUserId, dateRange);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND t.created_at >= $2 AND t.created_at <= $3'),
        [mockUserId, dateRange.start, dateRange.end]
      );
      expect(result.totalTasks).toBe(5);
      expect(result.completedTasks).toBe(3);
    });
  });

  describe('ProjectRepository - Progress Analytics', () => {
    it('should get project completion history', async () => {
      const mockHistory = [
        { date: '2024-01-03', tasksCompleted: 2, minutesLogged: 240 },
        { date: '2024-01-02', tasksCompleted: 1, minutesLogged: 120 }
      ];

      const mockQuery = jest.fn().mockResolvedValue({
        rows: [
          { date: '2024-01-03', tasks_completed: '2', minutes_logged: '240' },
          { date: '2024-01-02', tasks_completed: '1', minutes_logged: '120' }
        ]
      });

      (projectRepository as any).db = { query: mockQuery };

      const result = await projectRepository.getProjectCompletionHistory(mockProjectId, mockUserId);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DATE(tch.timestamp) as date'),
        [mockProjectId, mockUserId]
      );
      expect(result).toEqual(mockHistory);
    });

    it('should get project completion history with date range', async () => {
      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      const mockQuery = jest.fn().mockResolvedValue({
        rows: [
          { date: '2024-01-15', tasks_completed: '1', minutes_logged: '120' }
        ]
      });

      (projectRepository as any).db = { query: mockQuery };

      const result = await projectRepository.getProjectCompletionHistory(mockProjectId, mockUserId, dateRange);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND tch.timestamp >= $3 AND tch.timestamp <= $4'),
        [mockProjectId, mockUserId, dateRange.start, dateRange.end]
      );
      expect(result).toHaveLength(1);
    });

    it('should get project task breakdown', async () => {
      const mockBreakdown = {
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

      const mockQuery = jest.fn().mockResolvedValue({
        rows: [
          { priority: 'critical', status: 'completed', count: '2', completed: '2' },
          { priority: 'high', status: 'completed', count: '2', completed: '2' },
          { priority: 'high', status: 'pending', count: '1', completed: '0' },
          { priority: 'medium', status: 'completed', count: '2', completed: '2' },
          { priority: 'medium', status: 'scheduled', count: '1', completed: '0' },
          { priority: 'medium', status: 'in_progress', count: '1', completed: '0' },
          { priority: 'low', status: 'pending', count: '1', completed: '0' }
        ]
      });

      (projectRepository as any).db = { query: mockQuery };

      const result = await projectRepository.getProjectTaskBreakdown(mockProjectId, mockUserId);

      expect(result.byPriority.critical).toEqual({ count: 2, completed: 2 });
      expect(result.byPriority.high).toEqual({ count: 3, completed: 2 });
      expect(result.byStatus.completed).toBe(6);
      expect(result.byStatus.pending).toBe(2);
    });

    it('should initialize empty breakdown for projects with no tasks', async () => {
      const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
      (projectRepository as any).db = { query: mockQuery };

      const result = await projectRepository.getProjectTaskBreakdown(mockProjectId, mockUserId);

      expect(result.byPriority.low).toEqual({ count: 0, completed: 0 });
      expect(result.byPriority.medium).toEqual({ count: 0, completed: 0 });
      expect(result.byPriority.high).toEqual({ count: 0, completed: 0 });
      expect(result.byPriority.critical).toEqual({ count: 0, completed: 0 });
      
      expect(result.byStatus.pending).toBe(0);
      expect(result.byStatus.scheduled).toBe(0);
      expect(result.byStatus.in_progress).toBe(0);
      expect(result.byStatus.completed).toBe(0);
      expect(result.byStatus.blocked).toBe(0);
    });
  });

  describe('Task Unmarking Functionality', () => {
    it('should properly unmark completed task and recalculate progress', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ // Get task
            rows: [{
              id: mockTaskId,
              status: 'completed',
              duration: 120,
              completed_minutes: 120
            }]
          })
          .mockResolvedValueOnce(undefined) // Delete completion history
          .mockResolvedValueOnce({ // Update task
            rows: [{
              id: mockTaskId,
              user_id: mockUserId,
              project_id: null,
              title: 'Test Task',
              description: null,
              duration: 120,
              priority: 'medium',
              deadline: null,
              is_hard_deadline: false,
              is_blocking: false,
              status: 'pending',
              completed_minutes: 0,
              remaining_minutes: 120,
              created_at: new Date(),
              updated_at: new Date(),
              completed_at: null
            }]
          })
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn()
      };

      const mockConnect = jest.fn().mockResolvedValue(mockClient);
      (taskRepository as any).db = { connect: mockConnect };

      const result = await taskRepository.unmarkCompleted(mockTaskId, mockUserId);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(result?.status).toBe('pending');
      expect(result?.completedMinutes).toBe(0);
      expect(result?.completedAt).toBeUndefined();
    });

    it('should throw error when trying to unmark non-completed task', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ // Get task
            rows: [{
              id: mockTaskId,
              status: 'pending',
              duration: 120,
              completed_minutes: 0
            }]
          })
          .mockResolvedValueOnce(undefined), // ROLLBACK
        release: jest.fn()
      };

      const mockConnect = jest.fn().mockResolvedValue(mockClient);
      (taskRepository as any).db = { connect: mockConnect };

      await expect(taskRepository.unmarkCompleted(mockTaskId, mockUserId))
        .rejects.toThrow('Task is not marked as completed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('Progress Calculation Edge Cases', () => {
    it('should handle tasks with zero duration', async () => {
      const mockQuery = jest.fn().mockResolvedValue({
        rows: [{
          total_tasks: '1',
          completed_tasks: '1',
          total_minutes: '0',
          completed_minutes: '0',
          avg_completion_hours: null
        }]
      }).mockResolvedValueOnce({
        rows: []
      });

      (taskRepository as any).db = { query: mockQuery };

      const result = await taskRepository.getTaskProgressAnalytics(mockUserId);

      expect(result.totalMinutes).toBe(0);
      expect(result.completedMinutes).toBe(0);
      expect(result.averageCompletionTime).toBe(0);
      expect(result.completionRate).toBe(100); // 1/1 * 100
    });

    it('should handle user with no tasks', async () => {
      const mockQuery = jest.fn().mockResolvedValue({
        rows: [{
          total_tasks: '0',
          completed_tasks: '0',
          total_minutes: null,
          completed_minutes: null,
          avg_completion_hours: null
        }]
      }).mockResolvedValueOnce({
        rows: []
      });

      (taskRepository as any).db = { query: mockQuery };

      const result = await taskRepository.getTaskProgressAnalytics(mockUserId);

      expect(result.totalTasks).toBe(0);
      expect(result.completedTasks).toBe(0);
      expect(result.totalMinutes).toBe(0);
      expect(result.completedMinutes).toBe(0);
      expect(result.averageCompletionTime).toBe(0);
      expect(result.completionRate).toBe(0);
      expect(result.dailyProgress).toEqual([]);
    });
  });
});