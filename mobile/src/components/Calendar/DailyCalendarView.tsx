import React, {useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {format, parseISO, addMinutes, isSameDay} from 'date-fns';
import {CalendarEvent, Task, ScheduledSlot} from '@/types';
import {useAppStore} from '@/store/useAppStore';

interface DailyCalendarViewProps {
  date: string;
  events: CalendarEvent[];
  tasks: Task[];
  onTaskPress?: (task: Task) => void;
  onEventPress?: (event: CalendarEvent) => void;
}

interface TimeSlotItem {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  type: 'event' | 'task';
  isFlexible: boolean;
  priority?: string;
  color: string;
  item: CalendarEvent | Task;
}

const HOUR_HEIGHT = 60;
const SCREEN_WIDTH = Dimensions.get('window').width;
const TIME_COLUMN_WIDTH = 60;
const EVENT_COLUMN_WIDTH = SCREEN_WIDTH - TIME_COLUMN_WIDTH - 32;

export const DailyCalendarView: React.FC<DailyCalendarViewProps> = ({
  date,
  events,
  tasks,
  onTaskPress,
  onEventPress,
}) => {
  const {projects} = useAppStore();

  const timeSlots = useMemo(() => {
    const slots: TimeSlotItem[] = [];
    const targetDate = parseISO(date);

    // Add calendar events
    events
      .filter(event => isSameDay(parseISO(event.startTime.toString()), targetDate))
      .forEach(event => {
        slots.push({
          id: event.id,
          title: event.title,
          startTime: new Date(event.startTime),
          endTime: new Date(event.endTime),
          type: 'event',
          isFlexible: event.isFlexible,
          color: event.isFlexible ? '#3B82F6' : '#EF4444',
          item: event,
        });
      });

    // Add scheduled tasks
    tasks.forEach(task => {
      task.scheduledSlots
        .filter(slot => isSameDay(new Date(slot.startTime), targetDate))
        .forEach(slot => {
          const project = task.projectId 
            ? projects.find(p => p.id === task.projectId)
            : null;
          
          slots.push({
            id: `${task.id}-${slot.id}`,
            title: task.title,
            startTime: new Date(slot.startTime),
            endTime: new Date(slot.endTime),
            type: 'task',
            isFlexible: true,
            priority: task.priority,
            color: project?.color || getPriorityColor(task.priority),
            item: task,
          });
        });
    });

    return slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [date, events, tasks, projects]);

  const hours = useMemo(() => {
    return Array.from({length: 24}, (_, i) => i);
  }, []);

  const getSlotPosition = (startTime: Date, endTime: Date) => {
    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();
    const endHour = endTime.getHours();
    const endMinute = endTime.getMinutes();

    const top = (startHour + startMinute / 60) * HOUR_HEIGHT;
    const height = ((endHour + endMinute / 60) - (startHour + startMinute / 60)) * HOUR_HEIGHT;

    return {top, height};
  };

  const handleSlotPress = (slot: TimeSlotItem) => {
    if (slot.type === 'task' && onTaskPress) {
      onTaskPress(slot.item as Task);
    } else if (slot.type === 'event' && onEventPress) {
      onEventPress(slot.item as CalendarEvent);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.calendarGrid}>
          {/* Time column */}
          <View style={styles.timeColumn}>
            {hours.map(hour => (
              <View key={hour} style={styles.timeSlot}>
                <Text style={styles.timeText}>
                  {format(new Date().setHours(hour, 0, 0, 0), 'HH:mm')}
                </Text>
              </View>
            ))}
          </View>

          {/* Events column */}
          <View style={styles.eventsColumn}>
            {/* Hour grid lines */}
            {hours.map(hour => (
              <View key={hour} style={styles.hourLine} />
            ))}

            {/* Time slots */}
            {timeSlots.map(slot => {
              const {top, height} = getSlotPosition(slot.startTime, slot.endTime);
              
              return (
                <TouchableOpacity
                  key={slot.id}
                  style={[
                    styles.eventSlot,
                    {
                      top,
                      height: Math.max(height, 30),
                      backgroundColor: slot.color,
                    },
                  ]}
                  onPress={() => handleSlotPress(slot)}
                  activeOpacity={0.7}
                >
                  <View style={styles.eventContent}>
                    <Text style={styles.eventTitle} numberOfLines={2}>
                      {slot.title}
                    </Text>
                    <Text style={styles.eventTime}>
                      {format(slot.startTime, 'HH:mm')} - {format(slot.endTime, 'HH:mm')}
                    </Text>
                    {slot.type === 'task' && slot.priority && (
                      <View style={[styles.priorityBadge, {backgroundColor: getPriorityColor(slot.priority)}]}>
                        <Text style={styles.priorityText}>{slot.priority.toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  calendarGrid: {
    flexDirection: 'row',
    minHeight: 24 * HOUR_HEIGHT,
  },
  timeColumn: {
    width: TIME_COLUMN_WIDTH,
    backgroundColor: '#F9FAFB',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  timeSlot: {
    height: HOUR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  timeText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  eventsColumn: {
    flex: 1,
    position: 'relative',
  },
  hourLine: {
    height: HOUR_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  eventSlot: {
    position: 'absolute',
    left: 4,
    right: 4,
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  eventTime: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  priorityBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});