import { GlobalShortcutManager } from '../services/GlobalShortcutManager';

// Mock Electron modules
jest.mock('electron', () => ({
  globalShortcut: {
    register: jest.fn(),
    unregister: jest.fn(),
    unregisterAll: jest.fn(),
    isRegistered: jest.fn()
  },
  BrowserWindow: {
    getAllWindows: jest.fn(() => [
      {
        isVisible: jest.fn(() => true),
        isFocused: jest.fn(() => true),
        isMinimized: jest.fn(() => false),
        hide: jest.fn(),
        show: jest.fn(),
        focus: jest.fn(),
        restore: jest.fn(),
        webContents: {
          send: jest.fn()
        }
      }
    ])
  },
  screen: {
    getPrimaryDisplay: jest.fn(() => ({
      workAreaSize: { width: 1920, height: 1080 }
    }))
  }
}));

describe('GlobalShortcutManager', () => {
  let shortcutManager: GlobalShortcutManager;
  let mockGlobalShortcut: any;

  beforeEach(() => {
    const { globalShortcut } = require('electron');
    mockGlobalShortcut = globalShortcut;
    
    // Reset mocks
    mockGlobalShortcut.register.mockClear();
    mockGlobalShortcut.unregister.mockClear();
    mockGlobalShortcut.unregisterAll.mockClear();
    mockGlobalShortcut.isRegistered.mockClear();

    shortcutManager = new GlobalShortcutManager();
  });

  afterEach(() => {
    shortcutManager.cleanup();
  });

  describe('registerShortcut', () => {
    it('should register a single shortcut successfully', () => {
      mockGlobalShortcut.register.mockReturnValue(true);
      const handler = jest.fn();

      const result = shortcutManager.registerShortcut('CommandOrControl+N', handler);

      expect(result).toBe(true);
      expect(mockGlobalShortcut.register).toHaveBeenCalledWith('CommandOrControl+N', handler);
    });

    it('should handle registration failure', () => {
      mockGlobalShortcut.register.mockReturnValue(false);
      const handler = jest.fn();

      const result = shortcutManager.registerShortcut('CommandOrControl+N', handler);

      expect(result).toBe(false);
      expect(mockGlobalShortcut.register).toHaveBeenCalledWith('CommandOrControl+N', handler);
    });

    it('should handle registration errors', () => {
      mockGlobalShortcut.register.mockImplementation(() => {
        throw new Error('Registration failed');
      });
      const handler = jest.fn();

      const result = shortcutManager.registerShortcut('CommandOrControl+N', handler);

      expect(result).toBe(false);
    });
  });

  describe('registerShortcuts', () => {
    it('should register multiple shortcuts', () => {
      mockGlobalShortcut.register.mockReturnValue(true);
      const shortcuts = {
        'CommandOrControl+N': jest.fn(),
        'CommandOrControl+T': jest.fn(),
        'CommandOrControl+M': jest.fn()
      };

      shortcutManager.registerShortcuts(shortcuts);

      expect(mockGlobalShortcut.register).toHaveBeenCalledTimes(3);
      Object.entries(shortcuts).forEach(([shortcut, handler]) => {
        expect(mockGlobalShortcut.register).toHaveBeenCalledWith(shortcut, handler);
      });
    });
  });

  describe('unregisterShortcut', () => {
    it('should unregister a registered shortcut', () => {
      mockGlobalShortcut.register.mockReturnValue(true);
      const handler = jest.fn();

      shortcutManager.registerShortcut('CommandOrControl+N', handler);
      shortcutManager.unregisterShortcut('CommandOrControl+N');

      expect(mockGlobalShortcut.unregister).toHaveBeenCalledWith('CommandOrControl+N');
    });

    it('should not unregister an unregistered shortcut', () => {
      shortcutManager.unregisterShortcut('CommandOrControl+N');

      expect(mockGlobalShortcut.unregister).not.toHaveBeenCalled();
    });
  });

  describe('unregisterAll', () => {
    it('should unregister all shortcuts', () => {
      mockGlobalShortcut.register.mockReturnValue(true);
      
      shortcutManager.registerShortcut('CommandOrControl+N', jest.fn());
      shortcutManager.registerShortcut('CommandOrControl+T', jest.fn());
      
      shortcutManager.unregisterAll();

      expect(mockGlobalShortcut.unregisterAll).toHaveBeenCalled();
    });
  });

  describe('isRegistered', () => {
    it('should check if shortcut is registered', () => {
      mockGlobalShortcut.isRegistered.mockReturnValue(true);

      const result = shortcutManager.isRegistered('CommandOrControl+N');

      expect(result).toBe(true);
      expect(mockGlobalShortcut.isRegistered).toHaveBeenCalledWith('CommandOrControl+N');
    });
  });

  describe('getRegisteredShortcuts', () => {
    it('should return list of registered shortcuts', () => {
      mockGlobalShortcut.register.mockReturnValue(true);
      
      shortcutManager.registerShortcut('CommandOrControl+N', jest.fn());
      shortcutManager.registerShortcut('CommandOrControl+T', jest.fn());

      const shortcuts = shortcutManager.getRegisteredShortcuts();

      expect(shortcuts).toContain('CommandOrControl+N');
      expect(shortcuts).toContain('CommandOrControl+T');
      expect(shortcuts).toHaveLength(2);
    });
  });

  describe('getDefaultShortcuts', () => {
    it('should return default shortcut configuration', () => {
      const defaultShortcuts = shortcutManager.getDefaultShortcuts();

      expect(defaultShortcuts).toHaveProperty('CommandOrControl+Shift+M');
      expect(defaultShortcuts).toHaveProperty('CommandOrControl+Shift+N');
      expect(defaultShortcuts).toHaveProperty('CommandOrControl+Shift+T');
      expect(defaultShortcuts).toHaveProperty('CommandOrControl+Shift+F');
      expect(defaultShortcuts).toHaveProperty('CommandOrControl+Shift+S');

      // Check that all values are functions
      Object.values(defaultShortcuts).forEach(handler => {
        expect(typeof handler).toBe('function');
      });
    });
  });

  describe('isValidShortcut', () => {
    it('should validate correct shortcut formats', () => {
      const validShortcuts = [
        'CommandOrControl+N',
        'Command+Shift+T',
        'Control+Alt+D',
        'CommandOrControl+Shift+F1'
      ];

      validShortcuts.forEach(shortcut => {
        expect(shortcutManager.isValidShortcut(shortcut)).toBe(true);
      });
    });

    it('should reject invalid shortcut formats', () => {
      const invalidShortcuts = [
        'N', // No modifier
        'InvalidModifier+N',
        'CommandOrControl+', // No key
        '',
        'CommandOrControl'
      ];

      invalidShortcuts.forEach(shortcut => {
        expect(shortcutManager.isValidShortcut(shortcut)).toBe(false);
      });
    });
  });

  describe('window management shortcuts', () => {
    let mockWindow: any;

    beforeEach(() => {
      const { BrowserWindow } = require('electron');
      mockWindow = BrowserWindow.getAllWindows()[0];
    });

    it('should toggle main window visibility', () => {
      mockGlobalShortcut.register.mockReturnValue(true);
      const defaultShortcuts = shortcutManager.getDefaultShortcuts();
      
      // Test hiding visible window
      mockWindow.isVisible.mockReturnValue(true);
      mockWindow.isFocused.mockReturnValue(true);
      
      defaultShortcuts['CommandOrControl+Shift+M']();
      
      expect(mockWindow.hide).toHaveBeenCalled();
    });

    it('should show hidden window', () => {
      mockGlobalShortcut.register.mockReturnValue(true);
      const defaultShortcuts = shortcutManager.getDefaultShortcuts();
      
      // Test showing hidden window
      mockWindow.isVisible.mockReturnValue(false);
      mockWindow.isMinimized.mockReturnValue(true);
      
      defaultShortcuts['CommandOrControl+Shift+M']();
      
      expect(mockWindow.restore).toHaveBeenCalled();
      expect(mockWindow.show).toHaveBeenCalled();
      expect(mockWindow.focus).toHaveBeenCalled();
    });

    it('should send today schedule message', () => {
      mockGlobalShortcut.register.mockReturnValue(true);
      const defaultShortcuts = shortcutManager.getDefaultShortcuts();
      
      defaultShortcuts['CommandOrControl+Shift+T']();
      
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('show-today-schedule');
    });

    it('should send focus mode toggle message', () => {
      mockGlobalShortcut.register.mockReturnValue(true);
      const defaultShortcuts = shortcutManager.getDefaultShortcuts();
      
      defaultShortcuts['CommandOrControl+Shift+F']();
      
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('toggle-focus-mode');
    });

    it('should send quick search message', () => {
      mockGlobalShortcut.register.mockReturnValue(true);
      const defaultShortcuts = shortcutManager.getDefaultShortcuts();
      
      defaultShortcuts['CommandOrControl+Shift+S']();
      
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('show-quick-search');
    });
  });

  describe('cleanup', () => {
    it('should unregister all shortcuts on cleanup', () => {
      mockGlobalShortcut.register.mockReturnValue(true);
      
      shortcutManager.registerShortcut('CommandOrControl+N', jest.fn());
      shortcutManager.cleanup();

      expect(mockGlobalShortcut.unregisterAll).toHaveBeenCalled();
    });
  });
});