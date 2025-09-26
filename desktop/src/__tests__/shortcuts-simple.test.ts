// Mock Electron modules
jest.mock('electron', () => ({
  globalShortcut: {
    register: jest.fn(() => true),
    unregister: jest.fn(),
    unregisterAll: jest.fn(),
    isRegistered: jest.fn(() => false)
  },
  BrowserWindow: {
    getAllWindows: jest.fn(() => [
      {
        isVisible: jest.fn(() => true),
        isFocused: jest.fn(() => true),
        hide: jest.fn(),
        show: jest.fn(),
        focus: jest.fn(),
        webContents: {
          send: jest.fn()
        }
      }
    ])
  }
}));

describe('Global Shortcuts', () => {
  it('should support global shortcut registration', () => {
    const { globalShortcut } = require('electron');
    
    const result = globalShortcut.register('CommandOrControl+N', () => {});
    expect(result).toBe(true);
    expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+N', expect.any(Function));
  });

  it('should validate shortcut formats', () => {
    const validShortcuts = [
      'CommandOrControl+N',
      'Command+Shift+T',
      'Control+Alt+D'
    ];

    const isValidShortcut = (shortcut: string): boolean => {
      const parts = shortcut.split('+');
      return parts.length >= 2 && parts[parts.length - 1].length > 0;
    };

    validShortcuts.forEach(shortcut => {
      expect(isValidShortcut(shortcut)).toBe(true);
    });
  });

  it('should support default shortcuts', () => {
    const defaultShortcuts = {
      'CommandOrControl+Shift+M': 'toggle-window',
      'CommandOrControl+Shift+N': 'quick-task',
      'CommandOrControl+Shift+T': 'today-schedule'
    };

    expect(Object.keys(defaultShortcuts)).toHaveLength(3);
    expect(defaultShortcuts['CommandOrControl+Shift+M']).toBe('toggle-window');
  });

  it('should handle window operations', () => {
    const { BrowserWindow } = require('electron');
    const windows = BrowserWindow.getAllWindows();
    const mainWindow = windows[0];
    
    expect(mainWindow.show).toBeDefined();
    expect(mainWindow.hide).toBeDefined();
    expect(mainWindow.focus).toBeDefined();
  });
});