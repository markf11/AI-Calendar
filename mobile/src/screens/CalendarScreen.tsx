import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Alert,
} from 'react-native';
import {format} from 'date-fns';
import {GestureHandlerRootView, PanGestureHandler, State} from 'react-native-gesture-handler';
import {CalendarHeader} from '@/components/Calendar/CalendarHeader';
import {DailyCalendarView} from '@/components/Calendar/DailyCalendarView';
import {QuickTaskInput} from '@/components/Tasks/QuickTaskInput';
import {useAppStore} from '@/store/useAppStore';
import {Task, CalendarEvent} from '@/types';

export const CalendarScreen: React.FC = () => {
  const {
    currentDate,
    dailySchedules,
    tasks,
    projects,
    isLoading,
    isOffline,
    setCurrentDate,
    setSelectedTask,
    addTask,
    completeTask,
    updateLastSync,
  } = useAppStore();

  const [showQuickInput, setShowQuickInput] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const currentSchedule = dailySchedules[currentDate];
  const todayTasks = tasks.filter(task => 
    task.scheduledSlots.some(slot => 
      format(new Date(slot.startTime), 'yyyy-MM-dd') === currentDate
    )
  );

  useEffect(() => {
    // Load initial data when component mounts
    loadDayData(currentDate);
  }, [currentDate]);

  const loadDayData = async (date: string) => {
    // In a real app, this would fetch data from the API
    // For now, we'll use the store data
    console.log('Loading data for date:', date);
  };

  const handleDateChange = (date: string) => {
    setCurrentDate(date);
  };

  const handleTodayPress = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setCurrentDate(today);
  };

  const handleTaskPress = (task: Task) => {
    setSelectedTask(task);
    // Navigate to task detail screen
    console.log('Task pressed:', task.title);
  };

  const handleEventPress = (event: CalendarEvent) => {
    // Navigate to event detail screen
    console.log('Event pressed:', event.title);
  };

  const handleTaskCreate = async (taskData: Partial<Task>) => {
    try {
      const newTask: Task = {
        id: `task_${Date.now()}`,
        userId: 'current_user', // This would come from auth
        title: taskData.title!,
        duration: taskData.duration!,
        priority: taskData.priority!,
        status: 'pending',
        isBlocking: taskData.isBlocking || false,
        isHardDeadline: taskData.isHardDeadline || false,
        dependencies: [],
        dependents: [],
        completedMinutes: 0,
        remainingMinutes: taskData.duration!,
        scheduledSlots: [],
        completionHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        ...taskData,
      };

      addTask(newTask);
      
      // In a real app, this would sync with the backend
      console.log('Task created:', newTask.title);
      
      Alert.alert('Success', 'Task created successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to create task. Please try again.');
    }
  };

  const handleSwipeGesture = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const {translationY, velocityY} = event.nativeEvent;
      
      // Swipe down to show quick input
      if (translationY > 50 && velocityY > 200) {
        setShowQuickInput(true);
      }
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real app, this would sync with the backend
      updateLastSync();
      
      console.log('Data refreshed');
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [updateLastSync]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        
        <CalendarHeader
          currentDate={currentDate}
          onDateChange={handleDateChange}
          onTodayPress={handleTodayPress}
        />

        <PanGestureHandler onHandlerStateChange={handleSwipeGesture}>
          <View style={styles.calendarContainer}>
            <DailyCalendarView
              date={currentDate}
              events={currentSchedule?.events || []}
              tasks={todayTasks}
              onTaskPress={handleTaskPress}
              onEventPress={handleEventPress}
            />
          </View>
        </PanGestureHandler>

        {showQuickInput && (
          <View style={styles.quickInputOverlay}>
            <QuickTaskInput
              onTaskCreate={handleTaskCreate}
              onClose={() => setShowQuickInput(false)}
            />
          </View>
        )}

        {isOffline && (
          <View style={styles.offlineIndicator}>
            <Text style={styles.offlineText}>Offline Mode</Text>
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  calendarContainer: {
    flex: 1,
  },
  quickInputOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineIndicator: {
    position: 'absolute',
    top: 100,
    left: 16,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  offlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});