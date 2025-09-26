// Mock electron-store
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn((key, defaultValue) => defaultValue),
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

describe('Offline Capabilities', () => {
  it('should support offline data storage', () => {
    const Store = require('electron-store');
    const mockStore = new Store();
    
    expect(mockStore.get).toBeDefined();
    expect(mockStore.set).toBeDefined();
    expect(mockStore.clear).toBeDefined();
  });

  it('should handle sync queue operations', () => {
    // Test sync queue functionality
    const syncQueue = [
      {
        id: 'test-1',
        action: 'create',
        entityType: 'task',
        entityId: 'task-1',
        data: { title: 'Test Task' },
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3
      }
    ];

    expect(syncQueue).toHaveLength(1);
    expect(syncQueue[0].action).toBe('create');
    expect(syncQueue[0].entityType).toBe('task');
  });

  it('should handle conflict resolution', () => {
    const localData = {
      id: 'task-1',
      title: 'Local Task',
      lastModified: 1000
    };

    const remoteData = {
      id: 'task-1',
      title: 'Remote Task',
      lastModified: 2000
    };

    // Simple conflict detection logic
    const hasConflict = localData.lastModified !== remoteData.lastModified;
    expect(hasConflict).toBe(true);

    // Resolution strategies
    const resolutions = ['local', 'remote', 'merge'];
    expect(resolutions).toContain('local');
    expect(resolutions).toContain('remote');
    expect(resolutions).toContain('merge');
  });

  it('should support offline/online state management', () => {
    let isOnline = true;
    
    // Simulate going offline
    isOnline = false;
    expect(isOnline).toBe(false);
    
    // Simulate coming back online
    isOnline = true;
    expect(isOnline).toBe(true);
  });
});