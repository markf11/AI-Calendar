import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {DailyCalendarView} from '../DailyCalendarView';
import {CalendarEvent, Task} from '@/types';

// Mock the store
jest.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    projects: [
      {
        id: 'project1',
        name: 'Test Project',
        color: '#3B82F6',
      },
    ],
  }),
}));

describe('DailyCalendarView', () => {
  const mockDate = '2024-01-15';
  
  const mockEvents: CalendarEvent[] = [
    {
      id: 'event1',
      userId: 'user1',
      title: 'Team Meeting',
      startTime: new Date('2024-01-15T10:00:00'),
      endTime: new Date('2024-01-15T11:00:00'),
      isFlexible: false,
      source: 'google',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockTasks: Task[] = [
    {
      id: 'task1',
      userId: 'user1',
      projectId: 'project1',
      title: 'Review Code',
      duration: 60,
      priority: 'high',
      status: 'scheduled',
      isBlocking: false,
      isHardDeadline: false,
      dependencies: [],
      dependents: [],
      completedMinutes: 0,
      remainingMinutes: 60,
      scheduledSlots: [
        {
          id: 'slot1',
          taskId: 'task1',
          startTime: new Date('2024-01-15T14:00:00'),
          endTime: new Date('2024-01-15T15:00:00'),
          duration: 60,
          isConfirmed: true,
        },
      ],
      completionHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const defaultProps = {
    date: mockDate,
    events: mockEvents,
    tasks: mockTasks,
  };

  it('renders correctly with events and tasks', () => {
    const {getByText} = render(<DailyCalendarView {...defaultProps} />);
    
    expect(getByText('Team Meeting')).toBeTruthy();
    expect(getByText('Review Code')).toBeTruthy();
  });

  it('displays time slots correctly', () => {
    const {getByText} = render(<DailyCalendarView {...defaultProps} />);
    
    // Check for time labels
    expect(getByText('10:00')).toBeTruthy();
    expect(getByText('14:00')).toBeTruthy();
  });

  it('calls onTaskPress when task is pressed', () => {
    const mockOnTaskPress = jest.fn();
    const {getByText} = render(
      <DailyCalendarView {...defaultProps} onTaskPress={mockOnTaskPress} />
    );
    
    fireEvent.press(getByText('Review Code'));
    expect(mockOnTaskPress).toHaveBeenCalledWith(mockTasks[0]);
  });

  it('calls onEventPress when event is pressed', () => {
    const mockOnEventPress = jest.fn();
    const {getByText} = render(
      <DailyCalendarView {...defaultProps} onEventPress={mockOnEventPress} />
    );
    
    fireEvent.press(getByText('Team Meeting'));
    expect(mockOnEventPress).toHaveBeenCalledWith(mockEvents[0]);
  });

  it('shows priority badge for tasks', () => {
    const {getByText} = render(<DailyCalendarView {...defaultProps} />);
    
    expect(getByText('HIGH')).toBeTruthy();
  });

  it('handles empty events and tasks', () => {
    const {queryByText} = render(
      <DailyCalendarView date={mockDate} events={[]} tasks={[]} />
    );
    
    // Should still render time grid
    expect(queryByText('10:00')).toBeTruthy();
    expect(queryByText('14:00')).toBeTruthy();
  });

  it('filters events and tasks by date', () => {
    const differentDateTasks: Task[] = [
      {
        ...mockTasks[0],
        scheduledSlots: [
          {
            ...mockTasks[0].scheduledSlots[0],
            startTime: new Date('2024-01-16T14:00:00'),
            endTime: new Date('2024-01-16T15:00:00'),
          },
        ],
      },
    ];

    const {queryByText} = render(
      <DailyCalendarView
        date={mockDate}
        events={mockEvents}
        tasks={differentDateTasks}
      />
    );
    
    // Should show event from correct date
    expect(queryByText('Team Meeting')).toBeTruthy();
    // Should not show task from different date
    expect(queryByText('Review Code')).toBeFalsy();
  });
});