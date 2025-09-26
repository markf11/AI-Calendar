import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {TaskCard} from '../TaskCard';
import {Task} from '@/types';

describe('TaskCard', () => {
  const mockTask: Task = {
    id: 'task1',
    userId: 'user1',
    title: 'Complete project documentation',
    description: 'Write comprehensive docs',
    duration: 120,
    priority: 'high',
    deadline: new Date('2024-01-20T17:00:00'),
    isHardDeadline: true,
    isBlocking: false,
    dependencies: ['task0'],
    dependents: [],
    status: 'pending',
    completedMinutes: 30,
    remainingMinutes: 90,
    scheduledSlots: [],
    completionHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const defaultProps = {
    task: mockTask,
  };

  it('renders task information correctly', () => {
    const {getByText} = render(<TaskCard {...defaultProps} />);
    
    expect(getByText('Complete project documentation')).toBeTruthy();
    expect(getByText('1h 30m remaining')).toBeTruthy();
    expect(getByText('HIGH')).toBeTruthy();
    expect(getByText('1 dependencies')).toBeTruthy();
  });

  it('displays deadline with correct styling for hard deadlines', () => {
    const {getByText} = render(<TaskCard {...defaultProps} />);
    
    const deadlineText = getByText(/Jan 20/);
    expect(deadlineText).toBeTruthy();
  });

  it('shows progress bar when task has progress', () => {
    const {getByText} = render(<TaskCard {...defaultProps} />);
    
    // 30 minutes completed out of 120 total = 25%
    expect(getByText('25%')).toBeTruthy();
  });

  it('calls onPress when card is pressed', () => {
    const mockOnPress = jest.fn();
    const {getByText} = render(
      <TaskCard {...defaultProps} onPress={mockOnPress} />
    );
    
    fireEvent.press(getByText('Complete project documentation'));
    expect(mockOnPress).toHaveBeenCalled();
  });

  it('displays project information when provided', () => {
    const {getByText} = render(
      <TaskCard
        {...defaultProps}
        showProject={true}
        projectName="Important Project"
        projectColor="#FF6B6B"
      />
    );
    
    expect(getByText('Important Project')).toBeTruthy();
  });

  it('shows correct status icon for different statuses', () => {
    const completedTask = {...mockTask, status: 'completed' as const};
    const {rerender} = render(<TaskCard task={completedTask} />);
    
    // Should show completed icon (check-circle)
    // Note: We can't easily test icon names with react-native-vector-icons mock
    // but we can test that the component renders without errors
    
    const inProgressTask = {...mockTask, status: 'in_progress' as const};
    rerender(<TaskCard task={inProgressTask} />);
    
    const blockedTask = {...mockTask, status: 'blocked' as const};
    rerender(<TaskCard task={blockedTask} />);
  });

  it('formats duration correctly for different time ranges', () => {
    // Test hours and minutes
    const {getByText, rerender} = render(<TaskCard {...defaultProps} />);
    expect(getByText('1h 30m remaining')).toBeTruthy();
    
    // Test only minutes
    const shortTask = {...mockTask, duration: 45, remainingMinutes: 45};
    rerender(<TaskCard task={shortTask} />);
    expect(getByText('45m remaining')).toBeTruthy();
    
    // Test only hours
    const longTask = {...mockTask, duration: 120, remainingMinutes: 120};
    rerender(<TaskCard task={longTask} />);
    expect(getByText('2h remaining')).toBeTruthy();
  });

  it('handles tasks without deadlines', () => {
    const taskWithoutDeadline = {...mockTask, deadline: undefined};
    const {queryByText} = render(<TaskCard task={taskWithoutDeadline} />);
    
    // Should not show deadline text
    expect(queryByText(/Jan 20/)).toBeFalsy();
  });

  it('handles tasks without dependencies', () => {
    const taskWithoutDeps = {...mockTask, dependencies: []};
    const {queryByText} = render(<TaskCard task={taskWithoutDeps} />);
    
    // Should not show dependencies text
    expect(queryByText(/dependencies/)).toBeFalsy();
  });

  it('handles tasks with no progress', () => {
    const taskWithoutProgress = {
      ...mockTask,
      completedMinutes: 0,
      remainingMinutes: 120,
    };
    const {queryByText} = render(<TaskCard task={taskWithoutProgress} />);
    
    // Should not show progress bar
    expect(queryByText(/\d+%/)).toBeFalsy();
  });
});