import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAppStore} from '@/store/useAppStore';
import {OfflineData, Task, Project, DailySchedule, CalendarEvent} from '@/types';
import {format, addDays, subDays} from 'date-fns';

export class OfflineManager {
  private static instance: OfflineManager;
  private syncQueue: Array<{action: string; data: any; timestamp: number}> = [];
  private isInitialized = false;

  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  static initialize(): void {
    const manager = OfflineManager.getInstance();
    if (!manager.isInitialized) {
      manager.setupNetworkListener();
      manager.loadSyncQueue();
      manager.isInitialized = true;
    }
  }

  static async checkNetworkStatus(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  }

  private setupNetworkListener(): void {
    NetInfo.addEventListener(state => {
      const isConnected = state.isConnected ?? false;
      const {setOffline} = useAppStore.getState();
      
      setOffline(!isConnected);
      
      if (isConnected && this.syncQueue.length > 0) {
        this.processSyncQueue();
      }
    });
  }

  async cacheEssentialData(data: {
    schedule: DailySchedule[];
    tasks: Task[];
    projects: Project[];
    events?: CalendarEvent[];
  }): Promise<void> {
    try {
      // Cache data for the next 7 days to ensure offline availability
      const today = new Date();
      const essentialSchedule = this.getEssentialScheduleData(data.schedule, today, 7);
      const essentialTasks = this.getEssentialTasks(data.tasks);
      
      const offlineData: OfflineData = {
        schedule: essentialSchedule,
        tasks: essentialTasks,
        projects: data.projects,
        lastSyncTimestamp: Date.now(),
      };

      await AsyncStorage.setItem('offlineData', JSON.stringify(offlineData));
      
      // Also cache individual day data for faster access
      await this.cacheIndividualDays(essentialSchedule);
      
      console.log('Essential data cached successfully');
    } catch (error) {
      console.error('Failed to cache essential data:', error);
    }
  }

  private getEssentialScheduleData(
    schedule: DailySchedule[],
    fromDate: Date,
    days: number
  ): DailySchedule[] {
    const essentialDates = [];
    
    // Include past 2 days, today, and next 7 days
    for (let i = -2; i < days; i++) {
      const date = addDays(fromDate, i);
      essentialDates.push(format(date, 'yyyy-MM-dd'));
    }
    
    return schedule.filter(day => essentialDates.includes(day.date));
  }

  private getEssentialTasks(tasks: Task[]): Task[] {
    // Only cache tasks that are:
    // 1. Not completed
    // 2. Have upcoming scheduled slots
    // 3. Have deadlines within the next 14 days
    const twoWeeksFromNow = addDays(new Date(), 14);
    
    return tasks.filter(task => {
      if (task.status === 'completed') return false;
      
      // Include if has upcoming scheduled slots
      const hasUpcomingSlots = task.scheduledSlots.some(
        slot => new Date(slot.startTime) > new Date()
      );
      
      // Include if has deadline within 2 weeks
      const hasNearDeadline = task.deadline && 
        new Date(task.deadline) <= twoWeeksFromNow;
      
      // Include if it's a high priority or critical task
      const isHighPriority = ['high', 'critical'].includes(task.priority);
      
      return hasUpcomingSlots || hasNearDeadline || isHighPriority;
    });
  }

  private async cacheIndividualDays(schedule: DailySchedule[]): Promise<void> {
    const cachePromises = schedule.map(async (day) => {
      try {
        await AsyncStorage.setItem(`day_${day.date}`, JSON.stringify(day));
      } catch (error) {
        console.error(`Failed to cache day ${day.date}:`, error);
      }
    });
    
    await Promise.all(cachePromises);
  }

  async getCachedDay(date: string): Promise<DailySchedule | null> {
    try {
      const data = await AsyncStorage.getItem(`day_${date}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Failed to get cached day ${date}:`, error);
      return null;
    }
  }

  async loadCachedData(): Promise<OfflineData | null> {
    try {
      const data = await AsyncStorage.getItem('offlineData');
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('Failed to load cached data:', error);
      return null;
    }
  }

  async clearCachedData(): Promise<void> {
    try {
      await AsyncStorage.removeItem('offlineData');
      await AsyncStorage.removeItem('syncQueue');
      this.syncQueue = [];
      console.log('Cached data cleared successfully');
    } catch (error) {
      console.error('Failed to clear cached data:', error);
    }
  }

  async queueAction(action: string, data: any): Promise<void> {
    const queueItem = {
      action,
      data,
      timestamp: Date.now(),
    };

    this.syncQueue.push(queueItem);
    await this.saveSyncQueue();

    // Try to sync immediately if online
    const isOnline = await OfflineManager.checkNetworkStatus();
    if (isOnline) {
      this.processSyncQueue();
    }
  }

  private async saveSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  private async loadSyncQueue(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem('syncQueue');
      if (data) {
        this.syncQueue = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) return;

    console.log(`Processing ${this.syncQueue.length} queued actions`);

    const processedItems: number[] = [];

    for (let i = 0; i < this.syncQueue.length; i++) {
      const item = this.syncQueue[i];
      
      try {
        await this.syncAction(item);
        processedItems.push(i);
      } catch (error) {
        console.error(`Failed to sync action ${item.action}:`, error);
        // Keep failed items in queue for retry
      }
    }

    // Remove successfully processed items
    this.syncQueue = this.syncQueue.filter((_, index) => !processedItems.includes(index));
    await this.saveSyncQueue();

    if (processedItems.length > 0) {
      const {updateLastSync} = useAppStore.getState();
      updateLastSync();
    }
  }

  private async syncAction(item: {action: string; data: any; timestamp: number}): Promise<void> {
    // In a real app, this would make API calls to sync with the backend
    switch (item.action) {
      case 'CREATE_TASK':
        console.log('Syncing task creation:', item.data.title);
        // await api.createTask(item.data);
        break;
      
      case 'UPDATE_TASK':
        console.log('Syncing task update:', item.data.id);
        // await api.updateTask(item.data.id, item.data);
        break;
      
      case 'COMPLETE_TASK':
        console.log('Syncing task completion:', item.data.taskId);
        // await api.completeTask(item.data.taskId, item.data.completionData);
        break;
      
      case 'CREATE_PROJECT':
        console.log('Syncing project creation:', item.data.name);
        // await api.createProject(item.data);
        break;
      
      case 'UPDATE_PROJECT':
        console.log('Syncing project update:', item.data.id);
        // await api.updateProject(item.data.id, item.data);
        break;
      
      default:
        console.warn('Unknown sync action:', item.action);
    }
  }

  async getStorageInfo(): Promise<{
    offlineDataSize: number;
    syncQueueSize: number;
    lastSyncTimestamp: number;
  }> {
    try {
      const offlineData = await AsyncStorage.getItem('offlineData');
      const syncQueue = await AsyncStorage.getItem('syncQueue');
      
      const offlineDataSize = offlineData ? JSON.stringify(offlineData).length : 0;
      const syncQueueSize = this.syncQueue.length;
      
      const cachedData = offlineData ? JSON.parse(offlineData) : null;
      const lastSyncTimestamp = cachedData?.lastSyncTimestamp || 0;

      return {
        offlineDataSize,
        syncQueueSize,
        lastSyncTimestamp,
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return {
        offlineDataSize: 0,
        syncQueueSize: 0,
        lastSyncTimestamp: 0,
      };
    }
  }
}