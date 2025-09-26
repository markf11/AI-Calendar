import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  Task,
  Project,
  CalendarEvent,
  DailySchedule,
  OfflineData,
} from '@/types';

interface AppState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  
  // Schedule state
  currentDate: string;
  dailySchedules: Record<string, DailySchedule>;
  selectedTask: Task | null;
  
  // Tasks and projects
  tasks: Task[];
  projects: Project[];
  
  // UI state
  isLoading: boolean;
  isOffline: boolean;
  lastSyncTimestamp: number;
  
  // Voice input state
  isListening: boolean;
  voiceText: string;
  
  // Actions
  setUser: (user: User | null) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setCurrentDate: (date: string) => void;
  setDailySchedule: (date: string, schedule: DailySchedule) => void;
  setSelectedTask: (task: Task | null) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  completeTask: (taskId: string, completedMinutes?: number) => void;
  addProject: (project: Project) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  deleteProject: (projectId: string) => void;
  setLoading: (loading: boolean) => void;
  setOffline: (offline: boolean) => void;
  updateLastSync: () => void;
  setVoiceListening: (listening: boolean) => void;
  setVoiceText: (text: string) => void;
  clearVoiceText: () => void;
  
  // Offline data management
  saveOfflineData: () => void;
  loadOfflineData: () => Promise<void>;
  clearOfflineData: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      currentDate: new Date().toISOString().split('T')[0],
      dailySchedules: {},
      selectedTask: null,
      tasks: [],
      projects: [],
      isLoading: false,
      isOffline: false,
      lastSyncTimestamp: 0,
      isListening: false,
      voiceText: '',

      // Actions
      setUser: (user) => set({user}),
      
      setAuthenticated: (authenticated) => set({isAuthenticated: authenticated}),
      
      setCurrentDate: (date) => set({currentDate: date}),
      
      setDailySchedule: (date, schedule) =>
        set((state) => ({
          dailySchedules: {
            ...state.dailySchedules,
            [date]: schedule,
          },
        })),
      
      setSelectedTask: (task) => set({selectedTask: task}),
      
      addTask: (task) =>
        set((state) => ({
          tasks: [...state.tasks, task],
        })),
      
      updateTask: (taskId, updates) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId ? {...task, ...updates} : task
          ),
        })),
      
      deleteTask: (taskId) =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== taskId),
          selectedTask: state.selectedTask?.id === taskId ? null : state.selectedTask,
        })),
      
      completeTask: (taskId, completedMinutes) =>
        set((state) => {
          const task = state.tasks.find((t) => t.id === taskId);
          if (!task) return state;
          
          const minutesToLog = completedMinutes ?? task.remainingMinutes;
          const newCompletedMinutes = task.completedMinutes + minutesToLog;
          const newRemainingMinutes = Math.max(0, task.duration - newCompletedMinutes);
          const isFullyCompleted = newRemainingMinutes === 0;
          
          const completionEntry = {
            timestamp: new Date(),
            minutesLogged: minutesToLog,
            wasPartialCompletion: !isFullyCompleted,
          };
          
          return {
            tasks: state.tasks.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    completedMinutes: newCompletedMinutes,
                    remainingMinutes: newRemainingMinutes,
                    status: isFullyCompleted ? 'completed' : 'in_progress',
                    completedAt: isFullyCompleted ? new Date() : t.completedAt,
                    completionHistory: [...t.completionHistory, completionEntry],
                  }
                : t
            ),
          };
        }),
      
      addProject: (project) =>
        set((state) => ({
          projects: [...state.projects, project],
        })),
      
      updateProject: (projectId, updates) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId ? {...project, ...updates} : project
          ),
        })),
      
      deleteProject: (projectId) =>
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== projectId),
        })),
      
      setLoading: (loading) => set({isLoading: loading}),
      
      setOffline: (offline) => set({isOffline: offline}),
      
      updateLastSync: () => set({lastSyncTimestamp: Date.now()}),
      
      setVoiceListening: (listening) => set({isListening: listening}),
      
      setVoiceText: (text) => set({voiceText: text}),
      
      clearVoiceText: () => set({voiceText: ''}),
      
      saveOfflineData: () => {
        const state = get();
        const offlineData: OfflineData = {
          schedule: Object.values(state.dailySchedules),
          tasks: state.tasks,
          projects: state.projects,
          lastSyncTimestamp: state.lastSyncTimestamp,
        };
        
        AsyncStorage.setItem('offlineData', JSON.stringify(offlineData));
      },
      
      loadOfflineData: async () => {
        try {
          const data = await AsyncStorage.getItem('offlineData');
          if (data) {
            const offlineData: OfflineData = JSON.parse(data);
            const dailySchedules: Record<string, DailySchedule> = {};
            
            offlineData.schedule.forEach((schedule) => {
              dailySchedules[schedule.date] = schedule;
            });
            
            set({
              dailySchedules,
              tasks: offlineData.tasks,
              projects: offlineData.projects,
              lastSyncTimestamp: offlineData.lastSyncTimestamp,
            });
          }
        } catch (error) {
          console.error('Failed to load offline data:', error);
        }
      },
      
      clearOfflineData: () => {
        AsyncStorage.removeItem('offlineData');
        set({
          dailySchedules: {},
          tasks: [],
          projects: [],
          lastSyncTimestamp: 0,
        });
      },
    }),
    {
      name: 'momentum-mobile-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        lastSyncTimestamp: state.lastSyncTimestamp,
      }),
    }
  )
);