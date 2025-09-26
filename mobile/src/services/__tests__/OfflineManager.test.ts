import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {OfflineManager} from '../OfflineManager';
import {DailySchedule, Task, Project} from '@/types';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-native-community/netinfo');
jest.mock('@/store/useAppStore');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

describe('OfflineManager', () => {
  let offlineManager: OfflineManager;

  beforeEach(() => {
    jest.clearAllMocks();
    offlineManager = OfflineManager.getInstance();
  });

  describe('cacheEssentialData', () => {
    const mockSchedule: DailySchedule[] = [
      {
        date: '2024-01-15',
        events: [],
        tasks: [],
        totalScheduledMinutes: 0,
        freeTimeSlots: [],
      },
      {
        date: '2024-01-16',
        events: [],
        tasks: [],
        totalScheduledMinutes: 0,
        freeTimeSlots: [],
      },
    ];

    const mockTasks: Task[] = [
      {
        id: 'task1',
        userId: 'user1',
        title: 'Test Task',
        duration: 60,
        priority: 'high',
        status: 'pending',
        isBlocking: false,
        isHardDeadline: false,
        dependencies: [],
        dependents: [],
        completedMinutes: 0,
        remainingMinutes: 60,
        scheduledSlots: [
          {
            id: 'slot1',
            taskId: 'task1',
            startTime: new Date('2024-01-15T10:00:00'),
            endTime: new Date('2024-01-15T11:00:00'),
            duration: 60,
            isConfirmed: true,
          },
        ],
        completionHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockProjects: Project[] = [
      {
        id: 'project1',
        userId: 'user1',
        name: 'Test Project',
        color: '#3B82F6',
        tasks: ['task1'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should cache essential data successfully', async () => {
      mockAsyncStorage.setItem.mockResolvedValue();

      await offlineManager.cacheEssentialData({
        schedule: mockSchedule,
        tasks: mockTasks,
        projects: mockProjects,
      });

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'offlineData',
        expect.stringContaining('"lastSyncTimestamp"')
      );
    });

    it('should filter out completed tasks', async () => {
      const tasksWithCompleted = [
        ...mockTasks,
        {
          ...mockTasks[0],
          id: 'completed-task',
          status: 'completed' as const,
        },
      ];

      mockAsyncStorage.setItem.mockResolvedValue();

      await offlineManager.cacheEssentialData({
        schedule: mockSchedule,
        tasks: tasksWithCompleted,
        projects: mockProjects,
      });

      const cachedData = JSON.parse(
        (mockAsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );

      expect(cachedData.tasks).toHaveLength(1);
      expect(cachedData.tasks[0].id).toBe('task1');
    });

    it('should handle caching errors gracefully', async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await offlineManager.cacheEssentialData({
        schedule: mockSchedule,
        tasks: mockTasks,
        projects: mockProjects,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to cache essential data:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('loadCachedData', () => {
    it('should load cached data successfully', async () => {
      const mockData = {
        schedule: [],
        tasks: [],
        projects: [],
        lastSyncTimestamp: Date.now(),
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockData));

      const result = await offlineManager.loadCachedData();

      expect(result).toEqual(mockData);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('offlineData');
    });

    it('should return null when no cached data exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await offlineManager.loadCachedData();

      expect(result).toBeNull();
    });

    it('should handle loading errors gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await offlineManager.loadCachedData();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load cached data:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('queueAction', () => {
    it('should queue actions for later sync', async () => {
      mockAsyncStorage.setItem.mockResolvedValue();
      mockNetInfo.fetch.mockResolvedValue({ isConnected: false } as any);

      await offlineManager.queueAction('CREATE_TASK', { title: 'New Task' });

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'syncQueue',
        expect.stringContaining('CREATE_TASK')
      );
    });

    it('should attempt immediate sync when online', async () => {
      mockAsyncStorage.setItem.mockResolvedValue();
      mockAsyncStorage.getItem.mockResolvedValue('[]');
      mockNetInfo.fetch.mockResolvedValue({ isConnected: true } as any);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await offlineManager.queueAction('CREATE_TASK', { title: 'New Task' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processing'),
        expect.stringContaining('queued actions')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('checkNetworkStatus', () => {
    it('should return true when connected', async () => {
      mockNetInfo.fetch.mockResolvedValue({ isConnected: true } as any);

      const result = await OfflineManager.checkNetworkStatus();

      expect(result).toBe(true);
    });

    it('should return false when disconnected', async () => {
      mockNetInfo.fetch.mockResolvedValue({ isConnected: false } as any);

      const result = await OfflineManager.checkNetworkStatus();

      expect(result).toBe(false);
    });

    it('should handle null connection state', async () => {
      mockNetInfo.fetch.mockResolvedValue({ isConnected: null } as any);

      const result = await OfflineManager.checkNetworkStatus();

      expect(result).toBe(false);
    });
  });

  describe('clearCachedData', () => {
    it('should clear all cached data', async () => {
      mockAsyncStorage.removeItem.mockResolvedValue();

      await offlineManager.clearCachedData();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('offlineData');
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('syncQueue');
    });

    it('should handle clearing errors gracefully', async () => {
      mockAsyncStorage.removeItem.mockRejectedValue(new Error('Storage error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await offlineManager.clearCachedData();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to clear cached data:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getCachedDay', () => {
    it('should return cached day data', async () => {
      const mockDayData = {
        date: '2024-01-15',
        events: [],
        tasks: [],
        totalScheduledMinutes: 0,
        freeTimeSlots: [],
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockDayData));

      const result = await offlineManager.getCachedDay('2024-01-15');

      expect(result).toEqual(mockDayData);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('day_2024-01-15');
    });

    it('should return null when day data not cached', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await offlineManager.getCachedDay('2024-01-15');

      expect(result).toBeNull();
    });
  });

  describe('getStorageInfo', () => {
    it('should return storage information', async () => {
      const mockOfflineData = { schedule: [], tasks: [], projects: [], lastSyncTimestamp: 123456 };
      mockAsyncStorage.getItem
        .mockResolvedValueOnce(JSON.stringify(mockOfflineData))
        .mockResolvedValueOnce('[]');

      const result = await offlineManager.getStorageInfo();

      expect(result).toEqual({
        offlineDataSize: expect.any(Number),
        syncQueueSize: 0,
        lastSyncTimestamp: 123456,
      });
    });

    it('should handle missing storage data', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await offlineManager.getStorageInfo();

      expect(result).toEqual({
        offlineDataSize: 0,
        syncQueueSize: 0,
        lastSyncTimestamp: 0,
      });
    });
  });
});