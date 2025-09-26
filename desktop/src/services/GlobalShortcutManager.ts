import { globalShortcut, BrowserWindow } from 'electron';

export interface ShortcutHandlers {
  [shortcut: string]: () => void;
}

export class GlobalShortcutManager {
  private registeredShortcuts: Set<string> = new Set();

  public registerShortcuts(shortcuts: ShortcutHandlers): void {
    Object.entries(shortcuts).forEach(([shortcut, handler]) => {
      this.registerShortcut(shortcut, handler);
    });
  }

  public registerShortcut(shortcut: string, handler: () => void): boolean {
    try {
      const success = globalShortcut.register(shortcut, handler);
      
      if (success) {
        this.registeredShortcuts.add(shortcut);
        console.log(`Registered global shortcut: ${shortcut}`);
      } else {
        console.warn(`Failed to register global shortcut: ${shortcut}`);
      }
      
      return success;
    } catch (error) {
      console.error(`Error registering shortcut ${shortcut}:`, error);
      return false;
    }
  }

  public unregisterShortcut(shortcut: string): void {
    if (this.registeredShortcuts.has(shortcut)) {
      globalShortcut.unregister(shortcut);
      this.registeredShortcuts.delete(shortcut);
      console.log(`Unregistered global shortcut: ${shortcut}`);
    }
  }

  public unregisterAll(): void {
    globalShortcut.unregisterAll();
    this.registeredShortcuts.clear();
    console.log('Unregistered all global shortcuts');
  }

  public isRegistered(shortcut: string): boolean {
    return globalShortcut.isRegistered(shortcut);
  }

  public getRegisteredShortcuts(): string[] {
    return Array.from(this.registeredShortcuts);
  }

  // Predefined shortcut handlers
  public getDefaultShortcuts(): ShortcutHandlers {
    return {
      // Toggle main window
      'CommandOrControl+Shift+M': () => {
        this.toggleMainWindow();
      },

      // Quick task creation
      'CommandOrControl+Shift+N': () => {
        this.showQuickTaskDialog();
      },

      // Show today's schedule
      'CommandOrControl+Shift+T': () => {
        this.showTodaySchedule();
      },

      // Focus mode toggle
      'CommandOrControl+Shift+F': () => {
        this.toggleFocusMode();
      },

      // Quick search
      'CommandOrControl+Shift+S': () => {
        this.showQuickSearch();
      }
    };
  }

  private toggleMainWindow(): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    
    if (mainWindow) {
      if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
      }
    }
  }

  private showQuickTaskDialog(): void {
    // First, ensure main window exists and is ready
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) return;

    // Create quick task dialog
    const quickTaskWindow = new BrowserWindow({
      width: 450,
      height: 350,
      resizable: false,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      parent: mainWindow,
      modal: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: require('path').join(__dirname, '../preload.js')
      },
      titleBarStyle: 'hiddenInset',
      frame: false
    });

    // Position the window in the center of the screen
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    
    quickTaskWindow.setPosition(
      Math.round((width - 450) / 2),
      Math.round((height - 350) / 2)
    );

    const isDev = process.env.NODE_ENV === 'development';
    const webAppUrl = isDev ? 'http://localhost:5173' : `file://${require('path').join(__dirname, '../../frontend/dist/index.html')}`;
    
    quickTaskWindow.loadURL(`${webAppUrl}#/quick-task`);
    quickTaskWindow.show();

    // Auto-close after 30 seconds of inactivity
    const autoCloseTimer = setTimeout(() => {
      if (!quickTaskWindow.isDestroyed()) {
        quickTaskWindow.close();
      }
    }, 30000);

    quickTaskWindow.on('closed', () => {
      clearTimeout(autoCloseTimer);
    });

    // Close when clicking outside (lose focus)
    quickTaskWindow.on('blur', () => {
      setTimeout(() => {
        if (!quickTaskWindow.isDestroyed() && !quickTaskWindow.isFocused()) {
          quickTaskWindow.close();
        }
      }, 200); // Small delay to prevent immediate closing
    });
  }

  private showTodaySchedule(): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
      
      // Send message to renderer to show today's schedule
      mainWindow.webContents.send('show-today-schedule');
    }
  }

  private toggleFocusMode(): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    
    if (mainWindow) {
      mainWindow.webContents.send('toggle-focus-mode');
    }
  }

  private showQuickSearch(): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
      
      // Send message to renderer to show search
      mainWindow.webContents.send('show-quick-search');
    }
  }

  // Utility method to validate shortcut format
  public isValidShortcut(shortcut: string): boolean {
    const validModifiers = ['CommandOrControl', 'Command', 'Control', 'Alt', 'Option', 'Shift', 'Super'];
    const parts = shortcut.split('+');
    
    if (parts.length < 2) return false;
    
    const modifiers = parts.slice(0, -1);
    const key = parts[parts.length - 1];
    
    // Check if all modifiers are valid
    const hasValidModifiers = modifiers.every(modifier => 
      validModifiers.includes(modifier)
    );
    
    // Check if key is not empty
    const hasValidKey = key && key.length > 0;
    
    return hasValidModifiers && hasValidKey;
  }

  public cleanup(): void {
    this.unregisterAll();
  }
}