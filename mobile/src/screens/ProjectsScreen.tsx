import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useAppStore} from '@/store/useAppStore';
import {Project} from '@/types';

export const ProjectsScreen: React.FC = () => {
  const {projects, tasks} = useAppStore();

  const getProjectProgress = (project: Project) => {
    const projectTasks = tasks.filter(task => task.projectId === project.id);
    const completedTasks = projectTasks.filter(task => task.status === 'completed');
    const totalMinutes = projectTasks.reduce((sum, task) => sum + task.duration, 0);
    const completedMinutes = projectTasks.reduce((sum, task) => sum + task.completedMinutes, 0);
    
    return {
      totalTasks: projectTasks.length,
      completedTasks: completedTasks.length,
      totalMinutes,
      completedMinutes,
      progressPercentage: totalMinutes > 0 ? (completedMinutes / totalMinutes) * 100 : 0,
    };
  };

  const renderProject = ({item}: {item: Project}) => {
    const progress = getProjectProgress(item);
    
    return (
      <TouchableOpacity style={styles.projectCard} activeOpacity={0.7}>
        <View style={styles.projectHeader}>
          <View style={[styles.projectDot, {backgroundColor: item.color}]} />
          <Text style={styles.projectName}>{item.name}</Text>
        </View>
        
        {item.description && (
          <Text style={styles.projectDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                {
                  width: `${progress.progressPercentage}%`,
                  backgroundColor: item.color,
                }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(progress.progressPercentage)}%
          </Text>
        </View>
        
        <View style={styles.projectStats}>
          <View style={styles.statItem}>
            <Icon name="assignment" size={16} color="#6B7280" />
            <Text style={styles.statText}>
              {progress.completedTasks}/{progress.totalTasks} tasks
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Icon name="schedule" size={16} color="#6B7280" />
            <Text style={styles.statText}>
              {Math.round(progress.completedMinutes / 60)}h / {Math.round(progress.totalMinutes / 60)}h
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Projects</Text>
        <TouchableOpacity style={styles.addButton} activeOpacity={0.7}>
          <Icon name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={projects}
        renderItem={renderProject}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
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
  listContent: {
    padding: 16,
  },
  projectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  projectDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  projectName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  projectDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  projectStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
});