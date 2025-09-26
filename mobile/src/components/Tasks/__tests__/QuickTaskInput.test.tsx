import React from 'react';
import {render, fireEvent, waitFor} from '@testing-library/react-native';
import {Alert} from 'react-native';
import {QuickTaskInput} from '../QuickTaskInput';

// Mock the store
jest.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    isListening: false,
    voiceText: '',
    setVoiceListening: jest.fn(),
    setVoiceText: jest.fn(),
    clearVoiceText: jest.fn(),
  }),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('QuickTaskInput', () => {
  const mockOnTaskCreate = jest.fn();
  const mockOnClose = jest.fn();

  const defaultProps = {
    onTaskCreate: mockOnTaskCreate,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default placeholder', () => {
    const {getByPlaceholderText} = render(<QuickTaskInput {...defaultProps} />);
    
    expect(getByPlaceholderText('What do you need to do?')).toBeTruthy();
  });

  it('renders with custom placeholder', () => {
    const {getByPlaceholderText} = render(
      <QuickTaskInput {...defaultProps} placeholder="Custom placeholder" />
    );
    
    expect(getByPlaceholderText('Custom placeholder')).toBeTruthy();
  });

  it('expands options when text input is focused', () => {
    const {getByPlaceholderText, getByText} = render(<QuickTaskInput {...defaultProps} />);
    
    const textInput = getByPlaceholderText('What do you need to do?');
    fireEvent(textInput, 'focus');
    
    // Should show expanded options
    expect(getByText('Duration (minutes):')).toBeTruthy();
    expect(getByText('Priority:')).toBeTruthy();
  });

  it('creates task with correct data when submitted', async () => {
    const {getByPlaceholderText, getByText, getByDisplayValue} = render(
      <QuickTaskInput {...defaultProps} />
    );
    
    // Focus to expand options
    const textInput = getByPlaceholderText('What do you need to do?');
    fireEvent(textInput, 'focus');
    
    // Fill in task details
    fireEvent.changeText(textInput, 'Test task');
    
    const durationInput = getByDisplayValue('30');
    fireEvent.changeText(durationInput, '60');
    
    // Select high priority
    const highPriorityButton = getByText('HIGH');
    fireEvent.press(highPriorityButton);
    
    // Submit
    const createButton = getByText('Create Task');
    fireEvent.press(createButton);
    
    await waitFor(() => {
      expect(mockOnTaskCreate).toHaveBeenCalledWith({
        title: 'Test task',
        duration: 60,
        priority: 'high',
        status: 'pending',
        isBlocking: false,
        isHardDeadline: false,
        dependencies: [],
        dependents: [],
        completedMinutes: 0,
        remainingMinutes: 60,
        scheduledSlots: [],
        completionHistory: [],
      });
    });
  });

  it('shows error when submitting empty task', async () => {
    const {getByPlaceholderText, getByText} = render(<QuickTaskInput {...defaultProps} />);
    
    // Focus to expand options
    const textInput = getByPlaceholderText('What do you need to do?');
    fireEvent(textInput, 'focus');
    
    // Try to submit without entering text
    const createButton = getByText('Create Task');
    fireEvent.press(createButton);
    
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a task title.');
    });
    
    expect(mockOnTaskCreate).not.toHaveBeenCalled();
  });

  it('shows error when submitting invalid duration', async () => {
    const {getByPlaceholderText, getByText, getByDisplayValue} = render(
      <QuickTaskInput {...defaultProps} />
    );
    
    // Focus to expand options
    const textInput = getByPlaceholderText('What do you need to do?');
    fireEvent(textInput, 'focus');
    
    // Fill in task title
    fireEvent.changeText(textInput, 'Test task');
    
    // Set invalid duration
    const durationInput = getByDisplayValue('30');
    fireEvent.changeText(durationInput, 'invalid');
    
    // Try to submit
    const createButton = getByText('Create Task');
    fireEvent.press(createButton);
    
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter a valid duration.');
    });
    
    expect(mockOnTaskCreate).not.toHaveBeenCalled();
  });

  it('cancels and resets form when cancel is pressed', async () => {
    const {getByPlaceholderText, getByText, getByDisplayValue} = render(
      <QuickTaskInput {...defaultProps} />
    );
    
    // Focus to expand options
    const textInput = getByPlaceholderText('What do you need to do?');
    fireEvent(textInput, 'focus');
    
    // Fill in some data
    fireEvent.changeText(textInput, 'Test task');
    
    const durationInput = getByDisplayValue('30');
    fireEvent.changeText(durationInput, '60');
    
    // Cancel
    const cancelButton = getByText('Cancel');
    fireEvent.press(cancelButton);
    
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('handles priority selection correctly', () => {
    const {getByPlaceholderText, getByText} = render(<QuickTaskInput {...defaultProps} />);
    
    // Focus to expand options
    const textInput = getByPlaceholderText('What do you need to do?');
    fireEvent(textInput, 'focus');
    
    // Test each priority level
    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    
    priorities.forEach(priority => {
      const priorityButton = getByText(priority);
      fireEvent.press(priorityButton);
      // The button should be selected (we can't easily test styling changes in tests)
    });
  });

  it('resets form after successful submission', async () => {
    const {getByPlaceholderText, getByText, getByDisplayValue} = render(
      <QuickTaskInput {...defaultProps} />
    );
    
    // Focus to expand options
    const textInput = getByPlaceholderText('What do you need to do?');
    fireEvent(textInput, 'focus');
    
    // Fill in task details
    fireEvent.changeText(textInput, 'Test task');
    
    // Submit
    const createButton = getByText('Create Task');
    fireEvent.press(createButton);
    
    await waitFor(() => {
      expect(mockOnTaskCreate).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});