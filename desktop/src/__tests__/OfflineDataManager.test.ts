import { OfflineDataManager, Task, Project, CalendarEvent } from '../services/OfflineDataManager';

// Mock electron-store
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
    store: {}
  }));
});

// Mock electron
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn()
  }
}));

// Mock fetch
global.fetch = jest.fn(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({})
})) as jest.Mock;

// Mock navigator
(global as any).navigator = {
  onLine: true
};

describe('OfflineDataManager', () => {
  let offlineDataManager: OfflineDataManager;
  let mockStore: any;

  beforeEach(() => {
    const Store = require('electron-store');
    mockStore = {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
      store: {}
    };
    Store.mockImplementation(() => mockStore);

    offlineDataManager = new OfflineDataManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    offlineDataManager.cleanup();
  });

  describe('Task Management', () => {
    const mockTask: Task = {
      id: 'task-1',
      title: 'Test Task',
      description: 'A test task',
      duration: 60,
      priority: 'high',
      deadline: '2024-12-31T23:59:59Z',
      isHardDeadline: true,
      isBlocking: false,
      status: 'pending',
      projectId: 'project-1',
      lastModified: Date.now()
    };

    it('should get tasks from store', () => {
      const mockTasks = [mockTask];
      mockStore.get.mockReturnValue(mockTasks);

      const tasks = offlineDataManager.getTasks();

      expect(mockStore.get).toHaveBeenCalledWith('tasks', []);
      expect(tasks).toEqual(mockTasks);
    });

    it('should add a new task', () => {
      mockStore.get.mockReturnValue([]);
      mockStore.set.mockImplementation(() => {});

      offlineDataManager.addTask(mockTask);

      expect(mockStore.set).toHaveBeenCalledWith('tasks', [mockTask]);
      expect(mockStore.set).toHaveBeenCalledWith('lastSyncTime', expect.any(Number));
    });

    it('should update an existing task', () => {
      const existingTasks = [mockTask];
      mockStore.get.mockReturnValue(existingTasks);

      const updates = { title: 'Updated Task Title' };
      offlineDataManager.updateTask(mockTask.id, updates);

      expect(mockStore.set).toHaveBeenCalledWith('tasks', [
        expect.objectContaining({
          ...mockTask,
          ...updates,
          lastModified: expect.any(Number)
        })
      ]);
    });

    it('should delete a task', () => {
      const existingTasks = [mockTask];
      mockStore.get.mockReturnValue(existingTasks);

      offlineDataManager.deleteTask(mockTask.id);

      expect(mockStore.set).toHaveBeenCalledWith('tasks', []);
    });

    it('should not update non-existent task', () => {
      mockStore.get.mockReturnValue([]);

      offlineDataManager.updateTask('non-existent', { title: 'Updated' });

      // Should not call set for tasks since task doesn't exist
      expect(mockStore.set).not.toHaveBeenCalledWith('tasks', expect.anything());
    });
  });

  describe('Project Management', () => {
    const mockProject: Project = {
      id: 'project-1',
      name: 'Test Project',
      description: 'A test project',
      color: '#FF5733',
      lastModified: Date.now()
    };

    it('should get projects from store', () => {
      const mockProjects = [mockProject];
      mockStore.get.mockReturnValue(mockProjects);

      const projects = offlineDataManager.getProjects();

      expect(mockStore.get).toHaveBeenCalledWith('projects', []);
      expect(projects).toEqual(mockProjects);
    });

    it('should add a new project', () => {
      mockStore.get.mockReturnValue([]);

      offlineDataManager.addProject(mockProject);

      expect(mockStore.set).toHaveBeenCalledWith('projects', [mockProject]);
    });

    it('should update an existing project', () => {
      mockStore.get.mockReturnValue([mockProject]);

      const updates = { name: 'Updated Project Name' };
      offlineDataManager.updateProject(mockProject.id, updates);

      expect(mockStore.set).toHaveBeenCalledWith('projects', [
        expect.objectContaining({
          ...mockProject,
          ...updates,
          lastModified: expect.any(Number)
        })
      ]);
    });

    it('should delete a project', () => {
      mockStore.get.mockReturnValue([mockProject]);

      offlineDataManager.deleteProject(mockProject.id);

      expect(mockStore.set).toHaveBeenCalledWith('projects', []);
    });
  });

  describe('Calendar Event Management', () => {
    const mockEvent: CalendarEvent = {
      id: 'event-1',
      title: 'Test Event',
      startTime: '2024-01-01T10:00:00Z',
      endTime: '2024-01-01T11:00:00Z',
      isFlexible: false,
      source: 'momentum',
      lastModified: Date.now()
    };

    it('should get events from store', () => {
      const mockEvents = [mockEvent];
      mockStore.get.mockReturnValue(mockEvents);

      const events = offlineDataManager.getEvents();

      expect(mockStore.get).toHaveBeenCalledWith('events', []);
      expect(events).toEqual(mockEvents);
    });

    it('should add a new event', () => {
      mockStore.get.mockReturnValue([]);

      offlineDataManager.addEvent(mockEvent);

      expect(mockStore.set).toHaveBeenCalledWith('events', [mockEvent]);
    });

    it('should update an existing event', () => {
      mockStore.get.mockReturnValue([mockEvent]);

      const updates = { title: 'Updated Event Title' };
      offlineDataManager.updateEvent(mockEvent.id, updates);

      expect(mockStore.set).toHaveBeenCalledWith('events', [
        expect.objectContaining({
          ...mockEvent,
          ...updates,
          lastModified: expect.any(Number)
        })
      ]);
    });

    it('should delete an event', () => {
      mockStore.get.mockReturnValue([mockEvent]);

      offlineDataManager.deleteEvent(mockEvent.id);

      expect(mockStore.set).toHaveBeenCalledWith('events', []);
    });
  });

  describe('Sync Queue Management', () => {
    it('should get sync queue items', () => {
      const mockQueueItems = [
        {
          id: 'queue-1',
          action: 'create' as const,
          entityType: 'task' as const,
          entityId: 'task-1',
          data: { title: 'Test Task' },
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3
        }
      ];

      // Mock the sync queue store
      const syncQueueStore = {
        get: jest.fn().mockReturnValue(mockQueueItems),
        set: jest.fn()
      };

      // We need to mock the second Store instance (sync queue)
      const Store = require('electron-store');
      Store.mockImplementationOnce(() => mockStore) // First call for main store
           .mockImplementationOnce(() => syncQueueStore); // Second call for sync queue

      const newManager = new OfflineDataManager();
      const queueItems = newManager.getSyncQueue();

      expect(syncQueueStore.get).toHaveBeenCalledWith('items', []);
      expect(queueItems).toEqual(mockQueueItems);

      newManager.cleanup();
    });

    it('should clear sync queue', () => {
      const syncQueueStore = {
        get: jest.fn(),
        set: jest.fn()
      };

      const Store = require('electron-store');
      Store.mockImplementationOnce(() => mockStore)
           .mockImplementationOnce(() => syncQueueStore);

      const newManager = new OfflineDataManager();
      newManager.clearSyncQueue();

      expect(syncQueueStore.set).toHaveBeenCalledWith('items', []);

      newManager.cleanup();
    });
  });

  describe('Conflict Detection', () => {
    it('should detect conflicts between local and remote data', () => {
      const localTask = {
        id: 'task-1',
        title: 'Local Task',
        lastModified: 1000
      };

      const remoteData = {
        tasks: [
          {
            id: 'task-1',
            title: 'Remote Task',
            lastModified: 2000
          }
        ]
      };

      mockStore.get.mockReturnValue([localTask]);

      const conflicts = offlineDataManager.detectConflicts(remoteData);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({
        entityType: 'task',
        entityId: 'task-1',
        localVersion: localTask,
        remoteVersion: remoteData.tasks[0],
        resolution: 'local'
      });
    });

    it('should not detect conflicts when data is in sync', () => {
      const task = {
        id: 'task-1',
        title: 'Synced Task',
        lastModified: 1000
      };

      const remoteData = {
        tasks: [task]
      };

      mockStore.get.mockReturnValue([task]);

      const conflicts = offlineDataManager.detectConflicts(remoteData);

      expect(conflicts).toHaveLength(0);
    });
  });

  describe('Data Operations', () => {
    it('should get data by key', () => {
      const mockData = { test: 'value' };
      mockStore.get.mockReturnValue(mockData);

      const result = offlineDataManager.getData('tasks');

      expect(mockStore.get).toHaveBeenCalledWith('tasks');
      expect(result).toEqual(mockData);
    });

    it('should set data by key', () => {
      const testData = { test: 'value' };

      offlineDataManager.setData('tasks', testData);

      expect(mockStore.set).toHaveBeenCalledWith('tasks', testData);
    });

    it('should clear all data', () => {
      const syncQueueStore = {
        get: jest.fn(),
        set: jest.fn()
      };

      const Store = require('electron-store');
      Store.mockImplementationOnce(() => mockStore)
           .mockImplementationOnce(() => syncQueueStore);

      const newManager = new OfflineDataManager();
      newManager.clearData();

      expect(mockStore.clear).toHaveBeenCalled();
      expect(syncQueueStore.set).toHaveBeenCalledWith('items', []);

      newManager.cleanup();
    });
  });
});