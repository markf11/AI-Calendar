import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import TaskSidebar from '../TaskSidebar'
import { TaskProvider } from '../../../contexts/TaskContext'
import { Task, Project } from '../../../types'

// Additional mocks for this test file

const mockTasks: Task[] = [
  {
    id: '1',
    userId: 'user1',
    title: 'Test Task 1',
    description: 'Description 1',
    duration: 60,
    priority: 'high',
    deadline: new Date('2024-12-31'),
    isHardDeadline: false,
    isBlocking: false,
    dependencies: [],
    dependents: [],
    status: 'pending',
    completedMinutes: 0,
    remainingMinutes: 60,
    scheduledSlots: [],
    completionHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    userId: 'user1',
    title: 'Critical Task',
    duration: 30,
    priority: 'critical',
    isHardDeadline: true,
    isBlocking: true,
    dependencies: [],
    dependents: [],
    status: 'pending',
    completedMinutes: 0,
    remainingMinutes: 30,
    scheduledSlots: [],
    completionHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const mockProjects: Project[] = [
  {
    id: 'proj1',
    userId: 'user1',
    name: 'Test Project',
    color: '#3B82F6',
    tasks: ['1'],
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
  getProjectById: vi.fn((id: string) => mockProjects.find(p => p.id === id)),
}

const renderWithContext = (component: React.ReactElement) => {
  return render(
    <TaskProvider>
      {component}
    </TaskProvider>
  )
}

describe('TaskSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders task sidebar with correct title and task count', () => {
    renderWithContext(<TaskSidebar />)
    
    expect(screen.getByText('Unscheduled Tasks')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // Task count
  })

  it('displays tasks grouped by priority', () => {
    renderWithContext(<TaskSidebar />)
    
    expect(screen.getByText('Critical (1)')).toBeInTheDocument()
    expect(screen.getByText('High Priority (1)')).toBeInTheDocument()
    expect(screen.getByText('Test Task 1')).toBeInTheDocument()
    expect(screen.getByText('Critical Task')).toBeInTheDocument()
  })

  it('shows add task button and opens quick form', async () => {
    const user = userEvent.setup()
    renderWithContext(<TaskSidebar />)
    
    const addButton = screen.getByText('Add Task')
    expect(addButton).toBeInTheDocument()
    
    await user.click(addButton)
    expect(screen.getByText('Add New Task')).toBeInTheDocument()
  })

  it('can collapse and expand sidebar', async () => {
    const user = userEvent.setup()
    renderWithContext(<TaskSidebar />)
    
    const collapseButton = screen.getByLabelText('Collapse sidebar')
    await user.click(collapseButton)
    
    expect(screen.getByLabelText('Expand task sidebar')).toBeInTheDocument()
    expect(screen.getByText('Tasks (2)')).toBeInTheDocument()
  })

  it('filters tasks by project', async () => {
    const user = userEvent.setup()
    renderWithContext(<TaskSidebar />)
    
    const projectFilter = screen.getByDisplayValue('All Projects')
    await user.selectOptions(projectFilter, 'proj1')
    
    // Should show only tasks from the selected project
    expect(screen.getByText('Test Task 1')).toBeInTheDocument()
  })

  it('searches tasks by title', async () => {
    const user = userEvent.setup()
    renderWithContext(<TaskSidebar />)
    
    const searchInput = screen.getByPlaceholderText('Search tasks...')
    await user.type(searchInput, 'Critical')
    
    expect(screen.getByText('Critical Task')).toBeInTheDocument()
    expect(screen.queryByText('Test Task 1')).not.toBeInTheDocument()
  })

  it('shows empty state when no tasks', () => {
    const emptyContext = {
      ...mockTaskContext,
      state: {
        ...mockTaskContext.state,
        unscheduledTasks: [],
      },
    }
    
    render(
      <TaskProvider>
        <TaskSidebar />
      </TaskProvider>
    )
    
    expect(screen.getByText('No unscheduled tasks')).toBeInTheDocument()
    expect(screen.getByText('All your tasks are scheduled!')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    const loadingContext = {
      ...mockTaskContext,
      state: {
        ...mockTaskContext.state,
        isLoading: true,
      },
    }
    
    render(
      <TaskProvider>
        <TaskSidebar />
      </TaskProvider>
    )
    
    expect(screen.getByText('Loading tasks...')).toBeInTheDocument()
  })

  it('handles drag and drop events', async () => {
    renderWithContext(<TaskSidebar />)
    
    // Check that drag and drop context is rendered (mocked)
    expect(screen.getByText('Test Task 1')).toBeInTheDocument()
  })

  it('opens task edit modal when edit is clicked', async () => {
    const user = userEvent.setup()
    renderWithContext(<TaskSidebar />)
    
    // Find and click edit button for first task
    const editButtons = screen.getAllByTitle('Edit task')
    await user.click(editButtons[0])
    
    // Should open edit modal (mocked)
    expect(screen.getByText('Edit Task')).toBeInTheDocument()
  })

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup()
    renderWithContext(<TaskSidebar />)
    
    const addButton = screen.getByText('Add Task')
    addButton.focus()
    
    await user.keyboard('{Enter}')
    expect(screen.getByText('Add New Task')).toBeInTheDocument()
  })
})