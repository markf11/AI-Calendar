const Store = require('electron-store');
import { WindowState } from './WindowManager';

export interface AppConfig {
  // Window settings
  windowState?: WindowState;
  minimizeToTray?: boolean;
  closeToTray?: boolean;
  startMinimized?: boolean;
  
  // Startup settings
  openAtLogin?: boolean;
  startHidden?: boolean;
  
  // Notification settings
  enableNotifications?: boolean;
  notificationSound?: boolean;
  taskReminders?: boolean;
  scheduleChangeNotifications?: boolean;
  deadlineAlerts?: boolean;
  
  // Sync settings
  offlineMode?: boolean;
  syncInterval?: number; // minutes
  autoSync?: boolean;
  
  // UI settings
  theme?: 'light' | 'dark' | 'system';
  fontSize?: 'small' | 'medium' | 'large';
  compactMode?: boolean;
  
  // Keyboard shortcuts
  globalShortcuts?: {
    [action: string]: string;
  };
  
  // Advanced settings
  enableHardwareAcceleration?: boolean;
  enableWebSecurity?: boolean;
  debugMode?: boolean;
}

export class ConfigManager {
  private store: Store<AppConfig>;
  private defaultConfig: AppConfig;

  constructor() {
    this.defaultConfig = this.getDefaultConfig();
    
    this.store = new Store<AppConfig>({
      name: 'momentum-config',
      defaults: this.defaultConfig,
      schema: {
        windowState: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
            isMaximized: { type: 'boolean' },
            isFullScreen: { type: 'boolean' }
          }
        },
        minimizeToTray: { type: 'boolean' },
        closeToTray: { type: 'boolean' },
        startMinimized: { type: 'boolean' },
        openAtLogin: { type: 'boolean' },
        startHidden: { type: 'boolean' },
        enableNotifications: { type: 'boolean' },
        notificationSound: { type: 'boolean' },
        taskReminders: { type: 'boolean' },
        scheduleChangeNotifications: { type: 'boolean' },
        deadlineAlerts: { type: 'boolean' },
        offlineMode: { type: 'boolean' },
        syncInterval: { type: 'number' },
        autoSync: { type: 'boolean' },
        theme: { type: 'string', enum: ['light', 'dark', 'system'] },
        fontSize: { type: 'string', enum: ['small', 'medium', 'large'] },
        compactMode: { type: 'boolean' },
        globalShortcuts: { type: 'object' },
        enableHardwareAcceleration: { type: 'boolean' },
        enableWebSecurity: { type: 'boolean' },
        debugMode: { type: 'boolean' }
      }
    });
  }

  public get<K extends keyof AppConfig>(key: K): AppConfig[K];
  public get<K extends keyof AppConfig>(key: K, defaultValue: AppConfig[K]): AppConfig[K];
  public get<K extends keyof AppConfig>(key: K, defaultValue?: AppConfig[K]): AppConfig[K] {
    const value = this.store.get(key);
    return value !== undefined ? value : (defaultValue ?? this.defaultConfig[key]);
  }

  public set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.store.set(key, value);
  }

  public getAll(): AppConfig {
    return this.store.store;
  }

  public setAll(config: Partial<AppConfig>): void {
    Object.entries(config).forEach(([key, value]) => {
      if (value !== undefined) {
        this.store.set(key as keyof AppConfig, value);
      }
    });
  }

  public reset(): void {
    this.store.clear();
  }

  public resetToDefaults(): void {
    this.store.store = { ...this.defaultConfig };
  }

  // Window-specific methods
  public getWindowConfig(): WindowState {
    const windowState = this.get('windowState');
    if (windowState) {
      return windowState;
    }

    // Return default window state
    return {
      x: 100,
      y: 100,
      width: 1200,
      height: 800,
      isMaximized: false,
      isFullScreen: false
    };
  }

  public setWindowConfig(windowState: WindowState): void {
    this.set('windowState', windowState);
  }

  // Notification settings
  public getNotificationSettings(): {
    enabled: boolean;
    sound: boolean;
    taskReminders: boolean;
    scheduleChanges: boolean;
    deadlineAlerts: boolean;
  } {
    return {
      enabled: this.get('enableNotifications', true),
      sound: this.get('notificationSound', true),
      taskReminders: this.get('taskReminders', true),
      scheduleChanges: this.get('scheduleChangeNotifications', true),
      deadlineAlerts: this.get('deadlineAlerts', true)
    };
  }

  public setNotificationSettings(settings: {
    enabled?: boolean;
    sound?: boolean;
    taskReminders?: boolean;
    scheduleChanges?: boolean;
    deadlineAlerts?: boolean;
  }): void {
    if (settings.enabled !== undefined) {
      this.set('enableNotifications', settings.enabled);
    }
    if (settings.sound !== undefined) {
      this.set('notificationSound', settings.sound);
    }
    if (settings.taskReminders !== undefined) {
      this.set('taskReminders', settings.taskReminders);
    }
    if (settings.scheduleChanges !== undefined) {
      this.set('scheduleChangeNotifications', settings.scheduleChanges);
    }
    if (settings.deadlineAlerts !== undefined) {
      this.set('deadlineAlerts', settings.deadlineAlerts);
    }
  }

  // Global shortcuts
  public getGlobalShortcuts(): { [action: string]: string } {
    return this.get('globalShortcuts', {
      'toggle-window': 'CommandOrControl+Shift+M',
      'quick-task': 'CommandOrControl+Shift+N',
      'today-schedule': 'CommandOrControl+Shift+T',
      'focus-mode': 'CommandOrControl+Shift+F',
      'quick-search': 'CommandOrControl+Shift+S'
    });
  }

  public setGlobalShortcut(action: string, shortcut: string): void {
    const shortcuts = this.getGlobalShortcuts();
    shortcuts[action] = shortcut;
    this.set('globalShortcuts', shortcuts);
  }

  public removeGlobalShortcut(action: string): void {
    const shortcuts = this.getGlobalShortcuts();
    delete shortcuts[action];
    this.set('globalShortcuts', shortcuts);
  }

  // Sync settings
  public getSyncSettings(): {
    offlineMode: boolean;
    syncInterval: number;
    autoSync: boolean;
  } {
    return {
      offlineMode: this.get('offlineMode', false),
      syncInterval: this.get('syncInterval', 5),
      autoSync: this.get('autoSync', true)
    };
  }

  public setSyncSettings(settings: {
    offlineMode?: boolean;
    syncInterval?: number;
    autoSync?: boolean;
  }): void {
    if (settings.offlineMode !== undefined) {
      this.set('offlineMode', settings.offlineMode);
    }
    if (settings.syncInterval !== undefined) {
      this.set('syncInterval', settings.syncInterval);
    }
    if (settings.autoSync !== undefined) {
      this.set('autoSync', settings.autoSync);
    }
  }

  // Theme and UI
  public getUISettings(): {
    theme: 'light' | 'dark' | 'system';
    fontSize: 'small' | 'medium' | 'large';
    compactMode: boolean;
  } {
    return {
      theme: this.get('theme', 'system'),
      fontSize: this.get('fontSize', 'medium'),
      compactMode: this.get('compactMode', false)
    };
  }

  public setUISettings(settings: {
    theme?: 'light' | 'dark' | 'system';
    fontSize?: 'small' | 'medium' | 'large';
    compactMode?: boolean;
  }): void {
    if (settings.theme !== undefined) {
      this.set('theme', settings.theme);
    }
    if (settings.fontSize !== undefined) {
      this.set('fontSize', settings.fontSize);
    }
    if (settings.compactMode !== undefined) {
      this.set('compactMode', settings.compactMode);
    }
  }

  // Export/Import configuration
  public exportConfig(): AppConfig {
    return { ...this.store.store };
  }

  public importConfig(config: Partial<AppConfig>): boolean {
    try {
      // Validate the configuration before importing
      const validatedConfig = this.validateConfig(config);
      this.setAll(validatedConfig);
      return true;
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return false;
    }
  }

  private validateConfig(config: Partial<AppConfig>): Partial<AppConfig> {
    const validated: Partial<AppConfig> = {};

    // Validate each field
    if (config.windowState && this.isValidWindowState(config.windowState)) {
      validated.windowState = config.windowState;
    }

    if (typeof config.minimizeToTray === 'boolean') {
      validated.minimizeToTray = config.minimizeToTray;
    }

    if (typeof config.closeToTray === 'boolean') {
      validated.closeToTray = config.closeToTray;
    }

    if (typeof config.enableNotifications === 'boolean') {
      validated.enableNotifications = config.enableNotifications;
    }

    if (config.theme && ['light', 'dark', 'system'].includes(config.theme)) {
      validated.theme = config.theme;
    }

    if (config.fontSize && ['small', 'medium', 'large'].includes(config.fontSize)) {
      validated.fontSize = config.fontSize;
    }

    if (typeof config.syncInterval === 'number' && config.syncInterval > 0) {
      validated.syncInterval = config.syncInterval;
    }

    // Add more validation as needed...

    return validated;
  }

  private isValidWindowState(state: any): state is WindowState {
    return (
      typeof state === 'object' &&
      typeof state.x === 'number' &&
      typeof state.y === 'number' &&
      typeof state.width === 'number' &&
      typeof state.height === 'number' &&
      typeof state.isMaximized === 'boolean' &&
      typeof state.isFullScreen === 'boolean'
    );
  }

  private getDefaultConfig(): AppConfig {
    return {
      // Window settings
      minimizeToTray: true,
      closeToTray: true,
      startMinimized: false,
      
      // Startup settings
      openAtLogin: false,
      startHidden: false,
      
      // Notification settings
      enableNotifications: true,
      notificationSound: true,
      taskReminders: true,
      scheduleChangeNotifications: true,
      deadlineAlerts: true,
      
      // Sync settings
      offlineMode: false,
      syncInterval: 5,
      autoSync: true,
      
      // UI settings
      theme: 'system',
      fontSize: 'medium',
      compactMode: false,
      
      // Keyboard shortcuts
      globalShortcuts: {
        'toggle-window': 'CommandOrControl+Shift+M',
        'quick-task': 'CommandOrControl+Shift+N',
        'today-schedule': 'CommandOrControl+Shift+T',
        'focus-mode': 'CommandOrControl+Shift+F',
        'quick-search': 'CommandOrControl+Shift+S'
      },
      
      // Advanced settings
      enableHardwareAcceleration: true,
      enableWebSecurity: true,
      debugMode: false
    };
  }
}