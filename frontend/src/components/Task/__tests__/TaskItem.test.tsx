import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import TaskItem from '../TaskItem'
import { TaskProvider } from '../../../contexts/TaskContext'
import { Task, Project } from '../../../types'

// Additional mocks for this test file

const mockProject: Project = {
  id: 'proj1',
  userId: 'user1',
  name: 'Test Project',
  color: '#3B82F6',
  tasks: ['1'],
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockTask: Task = {
  id: '1',
  userId: 'user1',
  title: 'Test Task',
  description: 'Test description',
  duration: 90,
  priority: 'high',
  deadline: new Date('2024-12-31'),
  isHardDeadline: false,
  isBlocking: true,
  projectId: 'proj1',
  dependencies: ['dep1', 'dep2'],
  dependents: [],
  status: 'pending',
  completedMinutes: 30,
  remainingMinutes: 60,
  scheduledSlots: [],
  completionHistory: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockTaskContext = {
  state: {
    tasks: [mockTask],
    projects: [mockProject],
    unscheduledTasks: [mockTask],
    selectedTaskId: null,
    isLoading: false,
    error: null,
  },
  setTasks: vi.fn(),
  addTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  setProjects: vi.fn(),
  addProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  selectTask: vi.fn(),
  setLoading: vi.fn(),
  setError: vi.fn(),
  getTasksByProject: vi.fn(),
  getProjectById: vi.fn(() => mockProject),
}

const renderTaskItem = (task = mockTask, onEdit = vi.fn()) => {
  return render(
    <TaskProvider>
      <TaskItem task={task} onEdit={onEdit} />
    </TaskProvider>
  )
}

describe('TaskItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders task with correct information', () => {
    renderTaskItem()
    
    expect(screen.getByText('Test Task')).toBeInTheDocument()
    expect(screen.getByText('1h 30m')).toBeInTheDocument() // Duration formatting
    expect(screen.getByText('Test Project')).toBeInTheDocument()
    expect(screen.getByText('Jan 1, 2024')).toBeInTheDocument() // Deadline
  })

  it('shows priority icon and styling', () => {
    renderTaskItem()
    
    expect(screen.getByTitle('high priority')).toBeInTheDocument()
    expect(screen.getByText('↑')).toBeInTheDocument() // High priority icon
  })

  it('shows blocking indicator for blocking tasks', () => {
    renderTaskItem()
    
    expect(screen.getByText('Blocking')).toBeInTheDocument()
    expect(screen.getByTitle('Cannot be split')).toBeInTheDocument()
  })

  it('displays project with color coding', () => {
    renderTaskItem()
    
    const projectElement = screen.getByText('Test Project')
    expect(projectElement).toBeInTheDocument()
    // Project color should be applied via style attribute
  })

  it('shows deadline information', () => {
    renderTaskItem()
    
    expect(screen.getByText('Jan 1, 2024')).toBeInTheDocument()
  })

  it('indicates hard deadline', () => {
    const hardDeadlineTask = {
      ...mockTask,
      isHardDeadline: true,
    }
    
    renderTaskItem(hardDeadlineTask)
    
    expect(screen.getByText('Jan 1, 2024 (Hard)')).toBeInTheDocument()
  })

  it('shows dependency information', () => {
    renderTaskItem()
    
    expect(screen.getByText('Depends on 2 tasks')).toBeInTheDocument()
  })

  it('handles task completion', async () => {
    const user = userEvent.setup()
    renderTaskItem()
    
    const completeButton = screen.getByTitle('Mark as complete')
    await user.click(completeButton)
    
    // Should call updateTask with completion data (mocked in context)
  })

  it('handles task editing', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    renderTaskItem(mockTask, onEdit)
    
    const editButton = screen.getByTitle('Edit task')
    await user.click(editButton)
    
    expect(onEdit).toHaveBeenCalled()
  })

  it('handles task deletion with confirmation', async () => {
    const user = userEvent.setup()
    
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    
    renderTaskItem()
    
    const deleteButton = screen.getByTitle('Delete task')
    await user.click(deleteButton)
    
    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this task?')
    
    confirmSpy.mockRestore()
  })

  it('cancels deletion when user declines confirmation', async () => {
    const user = userEvent.setup()
    
    // Mock window.confirm to return false
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    
    renderTaskItem()
    
    const deleteButton = screen.getByTitle('Delete task')
    await user.click(deleteButton)
    
    expect(confirmSpy).toHaveBeenCalled()
    // Task should still be visible
    expect(screen.getByText('Test Task')).toBeInTheDocument()
    
    confirmSpy.mockRestore()
  })

  it('expands to show description', async () => {
    const user = userEvent.setup()
    renderTaskItem()
    
    const expandButton = screen.getByTitle('Expand')
    await user.click(expandButton)
    
    expect(screen.getByText('Test description')).toBeInTheDocument()
    expect(screen.getByTitle('Collapse')).toBeInTheDocument()
  })

  it('collapses when expanded', async () => {
    const user = userEvent.setup()
    renderTaskItem()
    
    // First expand
    const expandButton = screen.getByTitle('Expand')
    await user.click(expandButton)
    
    // Then collapse
    const collapseButton = screen.getByTitle('Collapse')
    await user.click(collapseButton)
    
    expect(screen.queryByText('Test description')).not.toBeInTheDocument()
  })

  it('formats duration correctly for different values', () => {
    const shortTask = { ...mockTask, duration: 45 }
    renderTaskItem(shortTask)
    
    expect(screen.getByText('45m')).toBeInTheDocument()
  })

  it('formats duration with hours and minutes', () => {
    const longTask = { ...mockTask, duration: 125 } // 2h 5m
    renderTaskItem(longTask)
    
    expect(screen.getByText('2h 5m')).toBeInTheDocument()
  })

  it('shows correct priority colors and icons', () => {
    const criticalTask = { ...mockTask, priority: 'critical' as const }
    renderTaskItem(criticalTask)
    
    expect(screen.getByText('⚠')).toBeInTheDocument()
    expect(screen.getByTitle('critical priority')).toBeInTheDocument()
  })

  it('handles task without project', () => {
    const taskWithoutProject = { ...mockTask, projectId: undefined }
    renderTaskItem(taskWithoutProject)
    
    expect(screen.queryByText('Test Project')).not.toBeInTheDocument()
  })

  it('handles task without deadline', () => {
    const taskWithoutDeadline = { ...mockTask, deadline: undefined }
    renderTaskItem(taskWithoutDeadline)
    
    expect(screen.queryByText('Jan 1, 2024')).not.toBeInTheDocument()
  })

  it('handles task without dependencies', () => {
    const taskWithoutDeps = { ...mockTask, dependencies: [] }
    renderTaskItem(taskWithoutDeps)
    
    expect(screen.queryByText(/Depends on/)).not.toBeInTheDocument()
  })

  it('shows single dependency correctly', () => {
    const taskWithOneDep = { ...mockTask, dependencies: ['dep1'] }
    renderTaskItem(taskWithOneDep)
    
    expect(screen.getByText('Depends on 1 task')).toBeInTheDocument()
  })

  it('applies correct CSS classes for priority', () => {
    renderTaskItem()
    
    const taskCard = screen.getByText('Test Task').closest('.card')
    expect(taskCard).toHaveClass('bg-orange-50', 'border-orange-200', 'text-orange-800')
  })

  it('shows thicker border for blocking tasks', () => {
    renderTaskItem()
    
    const taskCard = screen.getByText('Test Task').closest('.card')
    expect(taskCard).toHaveClass('border-l-8')
  })
})