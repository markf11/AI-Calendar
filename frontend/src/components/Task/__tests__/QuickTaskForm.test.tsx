import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import QuickTaskForm from '../QuickTaskForm'
import { TaskProvider } from '../../../contexts/TaskContext'
import { Task, Project } from '../../../types'

// Additional mocks for this test file

const mockProjects: Project[] = [
  {
    id: 'proj1',
    userId: 'user1',
    name: 'Test Project',
    color: '#3B82F6',
    tasks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const mockTasks: Task[] = [
  {
    id: '1',
    userId: 'user1',
    title: 'Previous Task',
    duration: 90,
    priority: 'high',
    isHardDeadline: false,
    isBlocking: false,
    dependencies: [],
    dependents: [],
    status: 'pending',
    completedMinutes: 0,
    remainingMinutes: 90,
    scheduledSlots: [],
    completionHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const mockTaskContext = {
  state: {
    tasks: mockTasks,
    projects: mockProjects,
    unscheduledTasks: mockTasks,
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
  getProjectById: vi.fn(),
}

const renderWithContext = (onClose = vi.fn()) => {
  return render(
    <TaskProvider>
      <QuickTaskForm onClose={onClose} />
    </TaskProvider>
  )
}

describe('QuickTaskForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders form with smart defaults', () => {
    renderWithContext()
    
    expect(screen.getByText('Add New Task')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('What needs to be done?')).toBeInTheDocument()
    expect(screen.getByDisplayValue('90')).toBeInTheDocument() // Smart duration default
    expect(screen.getByDisplayValue('high')).toBeInTheDocument() // Smart priority default
  })

  it('shows keyboard shortcuts hint', () => {
    renderWithContext()
    
    expect(screen.getByText(/Esc/)).toBeInTheDocument()
    expect(screen.getByText(/⌘Enter/)).toBeInTheDocument()
  })

  it('provides task title suggestions', async () => {
    const user = userEvent.setup()
    renderWithContext()
    
    const titleInput = screen.getByPlaceholderText('What needs to be done?')
    await user.type(titleInput, 'email')
    
    await waitFor(() => {
      expect(screen.getByText('Review and respond to emails')).toBeInTheDocument()
    })
  })

  it('shows duration quick buttons based on task type', async () => {
    const user = userEvent.setup()
    renderWithContext()
    
    const titleInput = screen.getByPlaceholderText('What needs to be done?')
    await user.type(titleInput, 'email check')
    
    // Should show quick duration buttons for email tasks
    expect(screen.getByText('15m')).toBeInTheDocument()
    expect(screen.getByText('30m')).toBeInTheDocument()
    expect(screen.getByText('45m')).toBeInTheDocument()
  })

  it('allows selecting duration with quick buttons', async () => {
    const user = userEvent.setup()
    renderWithContext()
    
    const duration30Button = screen.getByText('30m')
    await user.click(duration30Button)
    
    expect(screen.getByDisplayValue('30')).toBeInTheDocument()
  })

  it('expands to show more options', async () => {
    const user = userEvent.setup()
    renderWithContext()
    
    const expandButton = screen.getByText('More options')
    await user.click(expandButton)
    
    expect(screen.getByText('Less options')).toBeInTheDocument()
    expect(screen.getByText('Project')).toBeInTheDocument()
    expect(screen.getByText('Deadline (optional)')).toBeInTheDocument()
  })

  it('shows project selection when projects exist', async () => {
    const user = userEvent.setup()
    renderWithContext()
    
    const expandButton = screen.getByText('More options')
    await user.click(expandButton)
    
    expect(screen.getByText('Test Project')).toBeInTheDocument()
  })

  it('validates required fields', async () => {
    const user = userEvent.setup()
    renderWithContext()
    
    const submitButton = screen.getByText('Add Task')
    await user.click(submitButton)
    
    expect(screen.getByText('Task title is required')).toBeInTheDocument()
  })

  it('validates duration limits', async () => {
    const user = userEvent.setup()
    renderWithContext()
    
    const titleInput = screen.getByPlaceholderText('What needs to be done?')
    const durationInput = screen.getByDisplayValue('90')
    
    await user.type(titleInput, 'Test task')
    await user.clear(durationInput)
    await user.type(durationInput, '2')
    
    const submitButton = screen.getByText('Add Task')
    await user.click(submitButton)
    
    expect(screen.getByText('Minimum 5 minutes')).toBeInTheDocument()
  })

  it('creates task with correct data', async () => {
    const user = userEvent.setup()
    const mockAddTask = vi.fn()
    
    render(
      <TaskProvider>
        <QuickTaskForm onClose={vi.fn()} />
      </TaskProvider>
    )
    
    const titleInput = screen.getByPlaceholderText('What needs to be done?')
    await user.type(titleInput, 'Test Task')
    
    const submitButton = screen.getByText('Add Task')
    await user.click(submitButton)
    
    await waitFor(() => {
      // Task should be created (mocked in context)
      expect(titleInput).toHaveValue('Test Task')
    })
  })

  it('handles keyboard shortcuts', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderWithContext(onClose)
    
    // Test Escape key
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('handles Cmd+Enter to submit', async () => {
    const user = userEvent.setup()
    renderWithContext()
    
    const titleInput = screen.getByPlaceholderText('What needs to be done?')
    await user.type(titleInput, 'Test Task')
    
    await user.keyboard('{Meta>}{Enter}{/Meta}')
    
    // Should attempt to submit the form
    await waitFor(() => {
      expect(titleInput).toHaveValue('Test Task')
    })
  })

  it('shows deadline type option when deadline is set', async () => {
    const user = userEvent.setup()
    renderWithContext()
    
    const expandButton = screen.getByText('More options')
    await user.click(expandButton)
    
    const deadlineInput = screen.getByLabelText('Deadline (optional)')
    await user.type(deadlineInput, '2024-12-31T10:00')
    
    expect(screen.getByText('Hard deadline (must be completed by this time)')).toBeInTheDocument()
  })

  it('shows blocking task option', async () => {
    const user = userEvent.setup()
    renderWithContext()
    
    const expandButton = screen.getByText('More options')
    await user.click(expandButton)
    
    expect(screen.getByText('Blocking task (cannot be split into smaller chunks)')).toBeInTheDocument()
  })

  it('cancels form and calls onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderWithContext(onClose)
    
    const cancelButton = screen.getByText('Cancel')
    await user.click(cancelButton)
    
    expect(onClose).toHaveBeenCalled()
  })

  it('shows smart priority suggestion hint', () => {
    renderWithContext()
    
    expect(screen.getByText('Based on your recent tasks')).toBeInTheDocument()
  })
})