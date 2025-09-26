import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {TaskCard} from '@/components/Tasks/TaskCard';
import {QuickTaskInput} from '@/components/Tasks/QuickTaskInput';
import {useAppStore} from '@/store/useAppStore';
import {Task} from '@/types';

export const TasksScreen: React.FC = () => {
  const {tasks, projects, addTask, completeTask, setSelectedTask} = useAppStore();
  const [showQuickInput, setShowQuickInput] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const handleTaskPress = (task: Task) => {
    setSelectedTask(task);
    // Navigate to task detail screen
  };

  const handleTaskComplete = (task: Task) => {
    completeTask(task.id);
  };

  const handleTaskEdit = (task: Task) => {
    setSelectedTask(task);
    // Navigate to task edit screen
  };

  const handleTaskCreate = (taskData: Partial<Task>) => {
    const newTask: Task = {
      id: `task_${Date.now()}`,
      userId: 'current_user',
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
    setShowQuickInput(false);
  };

  const renderTask = ({item}: {item: Task}) => {
    const project = item.projectId ? projects.find(p => p.id === item.projectId) : null;
    
    return (
      <TaskCard
        task={item}
        onPress={() => handleTaskPress(item)}
        onSwipeComplete={() => handleTaskComplete(item)}
        onSwipeEdit={() => handleTaskEdit(item)}
        showProject={!!project}
        projectName={project?.name}
        projectColor={project?.color}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tasks</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowQuickInput(true)}
          activeOpacity={0.7}
        >
          <Icon name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'pending', 'in_progress', 'completed'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterButton,
              filter === f && styles.filterButtonActive,
            ]}
            onPress={() => setFilter(f)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterButtonText,
                filter === f && styles.filterButtonTextActive,
              ]}
            >
              {f.replace('_', ' ').toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredTasks}
        renderItem={renderTask}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {showQuickInput && (
        <View style={styles.quickInputOverlay}>
          <QuickTaskInput
            onTaskCreate={handleTaskCreate}
            onClose={() => setShowQuickInput(false)}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  filterButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingVertical: 8,
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
});