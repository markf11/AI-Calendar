import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import {PanGestureHandler, State} from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Task} from '@/types';
import {format} from 'date-fns';

interface TaskCardProps {
  task: Task;
  onPress?: () => void;
  onSwipeComplete?: () => void;
  onSwipeEdit?: () => void;
  showProject?: boolean;
  projectName?: string;
  projectColor?: string;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onPress,
  onSwipeComplete,
  onSwipeEdit,
  showProject = false,
  projectName,
  projectColor,
}) => {
  const translateX = new Animated.Value(0);
  const opacity = new Animated.Value(1);

  const handleGestureEvent = Animated.event(
    [{nativeEvent: {translationX: translateX}}],
    {useNativeDriver: true}
  );

  const handleStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const {translationX, velocityX} = event.nativeEvent;
      
      // Swipe right to complete
      if (translationX > 100 || velocityX > 500) {
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: 300,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onSwipeComplete?.();
        });
      }
      // Swipe left to edit
      else if (translationX < -100 || velocityX < -500) {
        Animated.timing(translateX, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
        onSwipeEdit?.();
      }
      // Snap back
      else {
        Animated.timing(translateX, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'critical':
        return '#DC2626';
      case 'high':
        return '#EA580C';
      case 'medium':
        return '#D97706';
      case 'low':
        return '#65A30D';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'check-circle';
      case 'in_progress':
        return 'play-circle-filled';
      case 'blocked':
        return 'block';
      default:
        return 'radio-button-unchecked';
    }
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const progressPercentage = task.duration > 0 
    ? (task.completedMinutes / task.duration) * 100 
    : 0;

  return (
    <PanGestureHandler
      onGestureEvent={handleGestureEvent}
      onHandlerStateChange={handleStateChange}
    >
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{translateX}],
            opacity,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.card}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Icon
                name={getStatusIcon(task.status)}
                size={20}
                color={task.status === 'completed' ? '#10B981' : '#6B7280'}
                style={styles.statusIcon}
              />
              <Text style={styles.title} numberOfLines={2}>
                {task.title}
              </Text>
            </View>
            
            <View style={[
              styles.priorityBadge,
              {backgroundColor: getPriorityColor(task.priority)}
            ]}>
              <Text style={styles.priorityText}>
                {task.priority.toUpperCase()}
              </Text>
            </View>
          </View>

          {showProject && projectName && (
            <View style={styles.projectRow}>
              <View style={[
                styles.projectDot,
                {backgroundColor: projectColor || '#6B7280'}
              ]} />
              <Text style={styles.projectName}>{projectName}</Text>
            </View>
          )}

          <View style={styles.details}>
            <View style={styles.detailRow}>
              <Icon name="schedule" size={16} color="#6B7280" />
              <Text style={styles.detailText}>
                {formatDuration(task.remainingMinutes)} remaining
              </Text>
            </View>

            {task.deadline && (
              <View style={styles.detailRow}>
                <Icon 
                  name={task.isHardDeadline ? "warning" : "flag"} 
                  size={16} 
                  color={task.isHardDeadline ? "#EF4444" : "#F59E0B"} 
                />
                <Text style={[
                  styles.detailText,
                  task.isHardDeadline && styles.hardDeadline
                ]}>
                  {format(new Date(task.deadline), 'MMM d, HH:mm')}
                </Text>
              </View>
            )}

            {task.dependencies.length > 0 && (
              <View style={styles.detailRow}>
                <Icon name="link" size={16} color="#6B7280" />
                <Text style={styles.detailText}>
                  {task.dependencies.length} dependencies
                </Text>
              </View>
            )}
          </View>

          {progressPercentage > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    {width: `${progressPercentage}%`}
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(progressPercentage)}%
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Swipe indicators */}
        <View style={styles.swipeIndicators}>
          <View style={styles.completeIndicator}>
            <Icon name="check" size={24} color="#FFFFFF" />
            <Text style={styles.indicatorText}>Complete</Text>
          </View>
          <View style={styles.editIndicator}>
            <Icon name="edit" size={24} color="#FFFFFF" />
            <Text style={styles.indicatorText}>Edit</Text>
          </View>
        </View>
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 8,
  },
  statusIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  projectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  projectName: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  details: {
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
  },
  hardDeadline: {
    color: '#EF4444',
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  swipeIndicators: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: -1,
  },
  completeIndicator: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  editIndicator: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  indicatorText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 4,
  },
});