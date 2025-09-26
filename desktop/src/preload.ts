import { contextBridge, ipcRenderer } from 'electron';

// Define the API that will be exposed to the renderer process
const electronAPI = {
  // Notification API
  showNotification: (notification: {
    title: string;
    body: string;
    actions?: Array<{ type: string; text: string }>;
  }) => ipcRenderer.invoke('show-notification', notification),

  // Offline data API
  getOfflineData: (key: string) => ipcRenderer.invoke('get-offline-data', key),
  setOfflineData: (key: string, data: any) => ipcRenderer.invoke('set-offline-data', key, data),
  clearOfflineData: () => ipcRenderer.invoke('clear-offline-data'),

  // Configuration API
  getConfig: (key: string, defaultValue?: any) => ipcRenderer.invoke('get-config', key, defaultValue),
  setConfig: (key: string, value: any) => ipcRenderer.invoke('set-config', key, value),

  // Window management API
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  showWindow: () => ipcRenderer.invoke('show-window'),

  // System integration API
  setStartup: (enabled: boolean) => ipcRenderer.invoke('set-startup', enabled),

  // Event listeners
  onShowTodaySchedule: (callback: () => void) => {
    ipcRenderer.on('show-today-schedule', callback);
    return () => ipcRenderer.removeListener('show-today-schedule', callback);
  },

  onScheduleChange: (callback: (data: any) => void) => {
    ipcRenderer.on('schedule-change', (_, data) => callback(data));
    return () => ipcRenderer.removeListener('schedule-change', callback);
  },

  onTaskReminder: (callback: (data: any) => void) => {
    ipcRenderer.on('task-reminder', (_, data) => callback(data));
    return () => ipcRenderer.removeListener('task-reminder', callback);
  },

  // Platform info
  platform: process.platform,
  isElectron: true
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type definitions for TypeScript
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}