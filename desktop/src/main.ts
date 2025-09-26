import { app, BrowserWindow, Menu, Tray, globalShortcut, ipcMain, shell, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { NotificationManager } from './services/NotificationManager';
import { OfflineDataManager } from './services/OfflineDataManager';
import { SystemTrayManager } from './services/SystemTrayManager';
import { GlobalShortcutManager } from './services/GlobalShortcutManager';
import { WindowManager } from './services/WindowManager';
import { ConfigManager } from './services/ConfigManager';

class MomentumDesktopApp {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private notificationManager: NotificationManager;
  private offlineDataManager: OfflineDataManager;
  private systemTrayManager: SystemTrayManager;
  private globalShortcutManager: GlobalShortcutManager;
  private windowManager: WindowManager;
  private configManager: ConfigManager;

  constructor() {
    this.configManager = new ConfigManager();
    this.notificationManager = new NotificationManager();
    this.offlineDataManager = new OfflineDataManager();
    this.systemTrayManager = new SystemTrayManager();
    this.globalShortcutManager = new GlobalShortcutManager();
    this.windowManager = new WindowManager();

    this.initializeApp();
  }

  private initializeApp(): void {
    // Handle app ready
    app.whenReady().then(() => {
      this.createMainWindow();
      this.setupSystemTray();
      this.setupGlobalShortcuts();
      this.setupAutoUpdater();
      this.setupIpcHandlers();
      
      // macOS specific: recreate window when dock icon is clicked
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    // Handle all windows closed
    app.on('window-all-closed', () => {
      // On macOS, keep app running even when all windows are closed
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Handle before quit
    app.on('before-quit', () => {
      this.cleanup();
    });

    // Security: prevent new window creation
    app.on('web-contents-created', (_, contents) => {
      contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      });
    });
  }

  private createMainWindow(): void {
    const windowConfig = this.configManager.getWindowConfig();
    
    this.mainWindow = new BrowserWindow({
      width: windowConfig.width,
      height: windowConfig.height,
      x: windowConfig.x,
      y: windowConfig.y,
      minWidth: 1024,
      minHeight: 768,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: true
      },
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      show: false, // Don't show until ready
      icon: this.getAppIcon()
    });

    // Load the web app
    const isDev = process.env.NODE_ENV === 'development';
    const webAppUrl = isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../frontend/dist/index.html')}`;
    
    this.mainWindow.loadURL(webAppUrl);

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      
      if (isDev) {
        this.mainWindow?.webContents.openDevTools();
      }
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Save window state on resize/move
    this.mainWindow.on('resize', () => this.saveWindowState());
    this.mainWindow.on('move', () => this.saveWindowState());

    // Handle minimize to tray
    this.mainWindow.on('minimize', (event) => {
      if (this.configManager.get('minimizeToTray', true)) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });

    // Handle close to tray
    this.mainWindow.on('close', (event) => {
      if (!(app as any).isQuiting && this.configManager.get('closeToTray', true)) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });

    this.windowManager.setMainWindow(this.mainWindow);
  }

  private setupSystemTray(): void {
    this.tray = this.systemTrayManager.createTray();
    
    if (this.tray) {
      this.tray.on('click', () => {
        this.toggleMainWindow();
      });

      this.tray.on('right-click', () => {
        this.systemTrayManager.showContextMenu();
      });
    }
  }

  private setupGlobalShortcuts(): void {
    // Register global shortcuts
    this.globalShortcutManager.registerShortcuts({
      'CommandOrControl+Shift+M': () => this.toggleMainWindow(),
      'CommandOrControl+Shift+N': () => this.showQuickTaskDialog(),
      'CommandOrControl+Shift+T': () => this.showTodaySchedule()
    });
  }

  private setupAutoUpdater(): void {
    if (process.env.NODE_ENV === 'production') {
      autoUpdater.checkForUpdatesAndNotify();
      
      autoUpdater.on('update-available', () => {
        this.notificationManager.showNotification({
          title: 'Update Available',
          body: 'A new version of Momentum Calendar is available. It will be downloaded in the background.',
          actions: []
        });
      });

      autoUpdater.on('update-downloaded', () => {
        dialog.showMessageBox(this.mainWindow!, {
          type: 'info',
          title: 'Update Ready',
          message: 'Update downloaded. The application will restart to apply the update.',
          buttons: ['Restart Now', 'Later']
        }).then((result) => {
          if (result.response === 0) {
            autoUpdater.quitAndInstall();
          }
        });
      });
    }
  }

  private setupIpcHandlers(): void {
    // Handle notification requests from renderer
    ipcMain.handle('show-notification', async (_, notification) => {
      return this.notificationManager.showNotification(notification);
    });

    // Handle offline data operations
    ipcMain.handle('get-offline-data', async (_, key) => {
      return this.offlineDataManager.getData(key);
    });

    ipcMain.handle('set-offline-data', async (_, key, data) => {
      return this.offlineDataManager.setData(key, data);
    });

    ipcMain.handle('clear-offline-data', async () => {
      return this.offlineDataManager.clearData();
    });

    // Handle app configuration
    ipcMain.handle('get-config', async (_, key, defaultValue) => {
      return this.configManager.get(key, defaultValue);
    });

    ipcMain.handle('set-config', async (_, key, value) => {
      return this.configManager.set(key, value);
    });

    // Handle window operations
    ipcMain.handle('minimize-to-tray', async () => {
      this.mainWindow?.hide();
    });

    ipcMain.handle('show-window', async () => {
      this.showMainWindow();
    });

    // Handle system integration
    ipcMain.handle('set-startup', async (_, enabled) => {
      return this.setStartupBehavior(enabled);
    });
  }

  private toggleMainWindow(): void {
    if (this.mainWindow?.isVisible()) {
      this.mainWindow.hide();
    } else {
      this.showMainWindow();
    }
  }

  private showMainWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();
    } else {
      this.createMainWindow();
    }
  }

  private showQuickTaskDialog(): void {
    // Create a small dialog for quick task creation
    const quickTaskWindow = new BrowserWindow({
      width: 400,
      height: 300,
      resizable: false,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    quickTaskWindow.loadURL(`${this.getWebAppUrl()}#/quick-task`);
    quickTaskWindow.show();
  }

  private showTodaySchedule(): void {
    this.showMainWindow();
    // Send message to renderer to show today's schedule
    this.mainWindow?.webContents.send('show-today-schedule');
  }

  private saveWindowState(): void {
    if (this.mainWindow) {
      const bounds = this.mainWindow.getBounds();
      this.configManager.setWindowConfig(bounds);
    }
  }

  private setStartupBehavior(enabled: boolean): boolean {
    try {
      if (enabled) {
        app.setLoginItemSettings({
          openAtLogin: true,
          path: process.execPath,
          args: ['--hidden']
        });
      } else {
        app.setLoginItemSettings({
          openAtLogin: false
        });
      }
      return true;
    } catch (error) {
      console.error('Failed to set startup behavior:', error);
      return false;
    }
  }

  private getAppIcon(): string {
    const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
    return path.join(__dirname, '../assets', iconName);
  }

  private getWebAppUrl(): string {
    const isDev = process.env.NODE_ENV === 'development';
    return isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../frontend/dist/index.html')}`;
  }

  private cleanup(): void {
    // Unregister global shortcuts
    globalShortcut.unregisterAll();
    
    // Clean up services
    this.offlineDataManager.cleanup();
    this.notificationManager.cleanup();
  }
}

// Initialize the app
new MomentumDesktopApp();