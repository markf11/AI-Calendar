import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {format, parseISO, addDays, subDays} from 'date-fns';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface CalendarHeaderProps {
  currentDate: string;
  onDateChange: (date: string) => void;
  onTodayPress: () => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  onDateChange,
  onTodayPress,
}) => {
  const date = parseISO(currentDate);
  const isToday = format(new Date(), 'yyyy-MM-dd') === currentDate;

  const handlePreviousDay = () => {
    const previousDay = subDays(date, 1);
    onDateChange(format(previousDay, 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    const nextDay = addDays(date, 1);
    onDateChange(format(nextDay, 'yyyy-MM-dd'));
  };

  return (
    <View style={styles.container}>
      <View style={styles.navigationRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={handlePreviousDay}
          activeOpacity={0.7}
        >
          <Icon name="chevron-left" size={24} color="#374151" />
        </TouchableOpacity>

        <View style={styles.dateContainer}>
          <Text style={styles.dayName}>
            {format(date, 'EEEE')}
          </Text>
          <Text style={styles.dateText}>
            {format(date, 'MMMM d, yyyy')}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.navButton}
          onPress={handleNextDay}
          activeOpacity={0.7}
        >
          <Icon name="chevron-right" size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        {!isToday && (
          <TouchableOpacity
            style={styles.todayButton}
            onPress={onTodayPress}
            activeOpacity={0.7}
          >
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateContainer: {
    alignItems: 'center',
    flex: 1,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 14,
    color: '#6B7280',
  },
  actionRow: {
    marginTop: 8,
    alignItems: 'center',
  },
  todayButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 20,
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});