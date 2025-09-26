const Store = require('electron-store');
import { ipcMain } from 'electron';

export interface OfflineData {
  // Calendar events
  events: CalendarEvent[];
  
  // Tasks
  tasks: Task[];
  
  // Projects
  projects: Project[];
  
  // User preferences
  userPreferences: UserPreferences;
  
  // Sync metadata
  lastSyncTime: number;
  pendingChanges: PendingChange[];
  conflictResolutions: ConflictResolution[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  isFlexible: boolean;
  source: 'momentum' | 'google' | 'microsoft';
  lastModified: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  duration: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: string;
  isHardDeadline: boolean;
  isBlocking: boolean;
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed';
  projectId?: string;
  lastModified: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  lastModified: number;
}

export interface UserPreferences {
  workingHours: any;
  timezone: string;
  notificationSettings: any;
  lastModified: number;
}

export interface PendingChange {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'task' | 'project' | 'event' | 'preferences';
  entityId: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

export interface ConflictResolution {
  id: string;
  entityType: 'task' | 'project' | 'event';
  entityId: string;
  localVersion: any;
  remoteVersion: any;
  resolution: 'local' | 'remote' | 'merge';
  timestamp: number;
}

export interface SyncQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  entityType: 'task' | 'project' | 'event';
  entityId: string;
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export class OfflineDataManager {
  private store: Store<OfflineData>;
  private syncQueue: Store<{ items: SyncQueueItem[] }>;
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private maxRetries: number = 3;
  private retryDelay: number = 5000; // 5 seconds

  constructor() {
    this.store = new Store<OfflineData>({
      name: 'momentum-offline-data',
      defaults: {
        events: [],
        tasks: [],
        projects: [],
        userPreferences: {
          workingHours: {},
          timezone: 'UTC',
          notificationSettings: {},
          lastModified: 0
        },
        lastSyncTime: 0,
        pendingChanges: [],
        conflictResolutions: []
      }
    });

    this.syncQueue = new Store<{ items: SyncQueueItem[] }>({
      name: 'momentum-sync-queue',
      defaults: {
        items: []
      }
    });

    this.setupNetworkMonitoring();
    this.setupIpcHandlers();
    this.startSyncProcessor();
  }

  // Data retrieval methods
  public getData(key: keyof OfflineData): any {
    return this.store.get(key);
  }

  public setData(key: keyof OfflineData, data: any): void {
    this.store.set(key, data);
  }

  public clearData(): void {
    this.store.clear();
    this.syncQueue.set('items', []);
  }

  // Calendar events
  public getEvents(): CalendarEvent[] {
    return this.store.get('events', []);
  }

  public setEvents(events: CalendarEvent[]): void {
    this.store.set('events', events);
    this.store.set('lastSyncTime', Date.now());
  }

  public addEvent(event: CalendarEvent): void {
    const events = this.getEvents();
    const existingIndex = events.findIndex(e => e.id === event.id);
    
    if (existingIndex >= 0) {
      events[existingIndex] = event;
    } else {
      events.push(event);
    }
    
    this.setEvents(events);
    this.queueChange('create', 'event', event.id, event);
  }

  public updateEvent(eventId: string, updates: Partial<CalendarEvent>): void {
    const events = this.getEvents();
    const eventIndex = events.findIndex(e => e.id === eventId);
    
    if (eventIndex >= 0) {
      events[eventIndex] = { ...events[eventIndex], ...updates, lastModified: Date.now() };
      this.setEvents(events);
      this.queueChange('update', 'event', eventId, events[eventIndex]);
    }
  }

  public deleteEvent(eventId: string): void {
    const events = this.getEvents();
    const filteredEvents = events.filter(e => e.id !== eventId);
    this.setEvents(filteredEvents);
    this.queueChange('delete', 'event', eventId, null);
  }

  // Tasks
  public getTasks(): Task[] {
    return this.store.get('tasks', []);
  }

  public setTasks(tasks: Task[]): void {
    this.store.set('tasks', tasks);
    this.store.set('lastSyncTime', Date.now());
  }

  public addTask(task: Task): void {
    const tasks = this.getTasks();
    const existingIndex = tasks.findIndex(t => t.id === task.id);
    
    if (existingIndex >= 0) {
      tasks[existingIndex] = task;
    } else {
      tasks.push(task);
    }
    
    this.setTasks(tasks);
    this.queueChange('create', 'task', task.id, task);
  }

  public updateTask(taskId: string, updates: Partial<Task>): void {
    const tasks = this.getTasks();
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex >= 0) {
      tasks[taskIndex] = { ...tasks[taskIndex], ...updates, lastModified: Date.now() };
      this.setTasks(tasks);
      this.queueChange('update', 'task', taskId, tasks[taskIndex]);
    }
  }

  public deleteTask(taskId: string): void {
    const tasks = this.getTasks();
    const filteredTasks = tasks.filter(t => t.id !== taskId);
    this.setTasks(filteredTasks);
    this.queueChange('delete', 'task', taskId, null);
  }

  // Projects
  public getProjects(): Project[] {
    return this.store.get('projects', []);
  }

  public setProjects(projects: Project[]): void {
    this.store.set('projects', projects);
    this.store.set('lastSyncTime', Date.now());
  }

  public addProject(project: Project): void {
    const projects = this.getProjects();
    const existingIndex = projects.findIndex(p => p.id === project.id);
    
    if (existingIndex >= 0) {
      projects[existingIndex] = project;
    } else {
      projects.push(project);
    }
    
    this.setProjects(projects);
    this.queueChange('create', 'project', project.id, project);
  }

  public updateProject(projectId: string, updates: Partial<Project>): void {
    const projects = this.getProjects();
    const projectIndex = projects.findIndex(p => p.id === projectId);
    
    if (projectIndex >= 0) {
      projects[projectIndex] = { ...projects[projectIndex], ...updates, lastModified: Date.now() };
      this.setProjects(projects);
      this.queueChange('update', 'project', projectId, projects[projectIndex]);
    }
  }

  public deleteProject(projectId: string): void {
    const projects = this.getProjects();
    const filteredProjects = projects.filter(p => p.id !== projectId);
    this.setProjects(filteredProjects);
    this.queueChange('delete', 'project', projectId, null);
  }

  // Sync queue management
  private queueChange(action: 'create' | 'update' | 'delete', entityType: 'task' | 'project' | 'event', entityId: string, data: any): void {
    if (!this.isOnline) {
      const queueItem: SyncQueueItem = {
        id: `${entityType}-${entityId}-${Date.now()}`,
        action,
        entityType,
        entityId,
        data,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: this.maxRetries
      };

      const queue = this.syncQueue.get('items', []);
      
      // Remove any existing queue items for the same entity
      const filteredQueue = queue.filter(item => 
        !(item.entityType === entityType && item.entityId === entityId)
      );
      
      filteredQueue.push(queueItem);
      this.syncQueue.set('items', filteredQueue);
    }
  }

  public getSyncQueue(): SyncQueueItem[] {
    return this.syncQueue.get('items', []);
  }

  public clearSyncQueue(): void {
    this.syncQueue.set('items', []);
  }

  // Network monitoring
  private setupNetworkMonitoring(): void {
    // Monitor network status - in Electron main process, we need to use different approach
    this.isOnline = true; // Default to online, will be updated by renderer process
    
    // In a real implementation, we would use Electron's net module or
    // get network status updates from the renderer process via IPC
  }

  // Sync processing
  private startSyncProcessor(): void {
    // Process sync queue every 30 seconds when online
    setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.processSyncQueue();
      }
    }, 30000);
  }

  private async processSyncQueue(): Promise<void> {
    if (this.syncInProgress) return;

    const queue = this.getSyncQueue();
    if (queue.length === 0) return;

    this.syncInProgress = true;
    console.log(`Processing ${queue.length} items in sync queue`);

    const processedItems: string[] = [];
    const failedItems: SyncQueueItem[] = [];

    for (const item of queue) {
      try {
        const success = await this.syncItem(item);
        
        if (success) {
          processedItems.push(item.id);
        } else {
          item.retryCount++;
          if (item.retryCount < item.maxRetries) {
            failedItems.push(item);
          } else {
            console.error(`Max retries exceeded for sync item: ${item.id}`);
            // Could store in a failed items log for manual review
          }
        }
      } catch (error) {
        console.error(`Error syncing item ${item.id}:`, error);
        item.retryCount++;
        if (item.retryCount < item.maxRetries) {
          failedItems.push(item);
        }
      }
    }

    // Update sync queue - remove processed items, keep failed items for retry
    this.syncQueue.set('items', failedItems);
    
    this.syncInProgress = false;
    
    if (processedItems.length > 0) {
      console.log(`Successfully synced ${processedItems.length} items`);
    }
    
    if (failedItems.length > 0) {
      console.log(`${failedItems.length} items failed to sync and will be retried`);
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<boolean> {
    try {
      // This would make actual API calls to sync with the server
      // For now, we'll simulate the sync process
      
      const apiUrl = this.getApiUrl();
      const endpoint = this.getEndpointForEntity(item.entityType);
      
      let response: Response;
      
      switch (item.action) {
        case 'create':
          response = await fetch(`${apiUrl}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data)
          });
          break;
          
        case 'update':
          response = await fetch(`${apiUrl}${endpoint}/${item.entityId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data)
          });
          break;
          
        case 'delete':
          response = await fetch(`${apiUrl}${endpoint}/${item.entityId}`, {
            method: 'DELETE'
          });
          break;
          
        default:
          return false;
      }
      
      return response.ok;
    } catch (error) {
      console.error('Sync item error:', error);
      return false;
    }
  }

  // Conflict resolution
  public detectConflicts(remoteData: any): ConflictResolution[] {
    const conflicts: ConflictResolution[] = [];
    
    // Compare local and remote data to detect conflicts
    // This is a simplified implementation
    
    const localTasks = this.getTasks();
    const remoteTasks = remoteData.tasks || [];
    
    for (const remoteTask of remoteTasks) {
      const localTask = localTasks.find(t => t.id === remoteTask.id);
      
      if (localTask && localTask.lastModified !== remoteTask.lastModified) {
        conflicts.push({
          id: `task-${remoteTask.id}-${Date.now()}`,
          entityType: 'task',
          entityId: remoteTask.id,
          localVersion: localTask,
          remoteVersion: remoteTask,
          resolution: 'local', // Default to local, user can change
          timestamp: Date.now()
        });
      }
    }
    
    return conflicts;
  }

  public resolveConflict(conflictId: string, resolution: 'local' | 'remote' | 'merge'): void {
    const conflicts = this.store.get('conflictResolutions', []);
    const conflictIndex = conflicts.findIndex(c => c.id === conflictId);
    
    if (conflictIndex >= 0) {
      conflicts[conflictIndex].resolution = resolution;
      this.store.set('conflictResolutions', conflicts);
      
      // Apply the resolution
      this.applyConflictResolution(conflicts[conflictIndex]);
    }
  }

  private applyConflictResolution(conflict: ConflictResolution): void {
    switch (conflict.resolution) {
      case 'local':
        // Keep local version, queue for sync
        this.queueChange('update', conflict.entityType, conflict.entityId, conflict.localVersion);
        break;
        
      case 'remote':
        // Accept remote version
        if (conflict.entityType === 'task') {
          this.updateTask(conflict.entityId, conflict.remoteVersion);
        }
        // Add other entity types as needed
        break;
        
      case 'merge':
        // Implement merge logic based on entity type
        const mergedData = this.mergeConflictData(conflict.localVersion, conflict.remoteVersion);
        if (conflict.entityType === 'task') {
          this.updateTask(conflict.entityId, mergedData);
        }
        break;
    }
  }

  private mergeConflictData(localData: any, remoteData: any): any {
    // Simple merge strategy - take the most recent non-null values
    const merged = { ...localData };
    
    Object.keys(remoteData).forEach(key => {
      if (remoteData[key] !== null && remoteData[key] !== undefined) {
        if (key === 'lastModified') {
          merged[key] = Math.max(localData[key] || 0, remoteData[key] || 0);
        } else if (localData[key] === null || localData[key] === undefined) {
          merged[key] = remoteData[key];
        }
        // For other fields, keep local version unless it's empty
      }
    });
    
    return merged;
  }

  // Utility methods
  private getApiUrl(): string {
    return process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000/api'
      : 'https://api.momentum-calendar.com';
  }

  private getEndpointForEntity(entityType: string): string {
    switch (entityType) {
      case 'task': return '/tasks';
      case 'project': return '/projects';
      case 'event': return '/events';
      default: return '';
    }
  }

  // IPC handlers
  private setupIpcHandlers(): void {
    ipcMain.handle('offline-get-data', async (_, key: keyof OfflineData) => {
      return this.getData(key);
    });

    ipcMain.handle('offline-set-data', async (_, key: keyof OfflineData, data: any) => {
      this.setData(key, data);
      return true;
    });

    ipcMain.handle('offline-get-sync-queue', async () => {
      return this.getSyncQueue();
    });

    ipcMain.handle('offline-clear-sync-queue', async () => {
      this.clearSyncQueue();
      return true;
    });

    ipcMain.handle('offline-force-sync', async () => {
      if (this.isOnline) {
        await this.processSyncQueue();
        return true;
      }
      return false;
    });

    ipcMain.handle('offline-get-conflicts', async () => {
      return this.store.get('conflictResolutions', []);
    });

    ipcMain.handle('offline-resolve-conflict', async (_, conflictId: string, resolution: 'local' | 'remote' | 'merge') => {
      this.resolveConflict(conflictId, resolution);
      return true;
    });
  }

  public cleanup(): void {
    // Clean up any resources
    console.log('OfflineDataManager cleanup completed');
  }
}