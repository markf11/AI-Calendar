import { Tray, Menu, MenuItem, BrowserWindow, app } from 'electron';
import * as path from 'path';

export class SystemTrayManager {
  private tray: Tray | null = null;
  private contextMenu: Menu | null = null;

  public createTray(): Tray | null {
    try {
      const iconPath = this.getTrayIconPath();
      this.tray = new Tray(iconPath);
      
      this.tray.setToolTip('Momentum Calendar');
      this.setupContextMenu();
      
      return this.tray;
    } catch (error) {
      console.error('Failed to create system tray:', error);
      return null;
    }
  }

  public updateTrayIcon(hasNotifications: boolean = false): void {
    if (!this.tray) return;

    const iconPath = hasNotifications 
      ? this.getTrayIconPath('notification')
      : this.getTrayIconPath();
    
    this.tray.setImage(iconPath);
  }

  public showContextMenu(): void {
    if (this.tray && this.contextMenu) {
      this.tray.popUpContextMenu(this.contextMenu);
    }
  }

  public updateScheduleStatus(status: {
    upcomingTasks: number;
    overdueTasks: number;
    todayProgress: number;
  }): void {
    if (!this.tray) return;

    let tooltip = 'Momentum Calendar';
    
    if (status.overdueTasks > 0) {
      tooltip += `\n⚠️ ${status.overdueTasks} overdue task${status.overdueTasks > 1 ? 's' : ''}`;
    }
    
    if (status.upcomingTasks > 0) {
      tooltip += `\n📅 ${status.upcomingTasks} upcoming task${status.upcomingTasks > 1 ? 's' : ''}`;
    }
    
    tooltip += `\n📊 Today: ${Math.round(status.todayProgress)}% complete`;

    this.tray.setToolTip(tooltip);
    this.setupContextMenu(status);
  }

  private setupContextMenu(status?: {
    upcomingTasks: number;
    overdueTasks: number;
    todayProgress: number;
  }): void {
    const menuItems: MenuItem[] = [];

    // Status section
    if (status) {
      menuItems.push(
        new MenuItem({
          label: `Today: ${Math.round(status.todayProgress)}% complete`,
          enabled: false
        }),
        new MenuItem({ type: 'separator' })
      );

      if (status.upcomingTasks > 0) {
        menuItems.push(
          new MenuItem({
            label: `${status.upcomingTasks} upcoming task${status.upcomingTasks > 1 ? 's' : ''}`,
            click: () => this.showMainWindow()
          })
        );
      }

      if (status.overdueTasks > 0) {
        menuItems.push(
          new MenuItem({
            label: `⚠️ ${status.overdueTasks} overdue task${status.overdueTasks > 1 ? 's' : ''}`,
            click: () => this.showOverdueTasks()
          })
        );
      }

      if (status.upcomingTasks > 0 || status.overdueTasks > 0) {
        menuItems.push(new MenuItem({ type: 'separator' }));
      }
    }

    // Quick actions
    menuItems.push(
      new MenuItem({
        label: 'Show Momentum',
        click: () => this.showMainWindow()
      }),
      new MenuItem({
        label: 'Quick Add Task',
        accelerator: 'CommandOrControl+Shift+N',
        click: () => this.showQuickTaskDialog()
      }),
      new MenuItem({
        label: 'Today\'s Schedule',
        accelerator: 'CommandOrControl+Shift+T',
        click: () => this.showTodaySchedule()
      }),
      new MenuItem({ type: 'separator' }),
      
      // Settings and info
      new MenuItem({
        label: 'Preferences',
        click: () => this.showPreferences()
      }),
      new MenuItem({
        label: 'About Momentum',
        click: () => this.showAbout()
      }),
      new MenuItem({ type: 'separator' }),
      
      // Quit
      new MenuItem({
        label: 'Quit Momentum',
        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
        click: () => {
          (app as any).isQuiting = true;
          app.quit();
        }
      })
    );

    this.contextMenu = Menu.buildFromTemplate(menuItems);
  }

  private showMainWindow(): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
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
        preload: path.join(__dirname, '../preload.js')
      }
    });

    const isDev = process.env.NODE_ENV === 'development';
    const webAppUrl = isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../../frontend/dist/index.html')}`;
    
    quickTaskWindow.loadURL(`${webAppUrl}#/quick-task`);
    quickTaskWindow.show();
  }

  private showTodaySchedule(): void {
    this.showMainWindow();
    
    // Send message to renderer to show today's schedule
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('show-today-schedule');
    }
  }

  private showOverdueTasks(): void {
    this.showMainWindow();
    
    // Send message to renderer to show overdue tasks
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('show-overdue-tasks');
    }
  }

  private showPreferences(): void {
    this.showMainWindow();
    
    // Send message to renderer to show preferences
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('show-preferences');
    }
  }

  private showAbout(): void {
    const { dialog } = require('electron');
    const mainWindow = BrowserWindow.getAllWindows()[0];
    
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'About Momentum Calendar',
      message: 'Momentum Calendar',
      detail: `Version: ${app.getVersion()}\n\nAI-powered calendar and task management system that eliminates the cognitive load of manual planning.\n\n© 2024 Momentum Team`,
      buttons: ['OK']
    });
  }

  private getTrayIconPath(variant: 'default' | 'notification' = 'default'): string {
    const platform = process.platform;
    let iconName = '';

    if (platform === 'darwin') {
      // macOS uses template images for proper dark/light mode support
      iconName = variant === 'notification' ? 'tray-icon-notification-Template.png' : 'tray-icon-Template.png';
    } else if (platform === 'win32') {
      iconName = variant === 'notification' ? 'tray-icon-notification.ico' : 'tray-icon.ico';
    } else {
      // Linux
      iconName = variant === 'notification' ? 'tray-icon-notification.png' : 'tray-icon.png';
    }

    return path.join(__dirname, '../../assets/tray', iconName);
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}