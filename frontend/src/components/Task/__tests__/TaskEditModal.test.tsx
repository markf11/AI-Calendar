import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import TaskEditModal from '../TaskEditModal'
import { TaskProvider } from '../../../contexts/TaskContext'
import { Task, Project } from '../../../types'

// Additional mocks for this test file

const mockTask: Task = {
  id: '1',
  userId: 'user1',
  title: 'Test Task',
  description: 'Test description',
  duration: 60,
  priority: 'high',
  deadline: new Date('2024-12-31T10:00:00'),
  isHardDeadline: true,
  isBlocking: false,
  projectId: 'proj1',
  dependencies: ['dep1'],
  dependents: ['dep2'],
  status: 'pending',
  completedMinutes: 20,
  remainingMinutes: 40,
  scheduledSlots: [],
  completionHistory: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

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
    tasks: [mockTask],
    projects: mockProjects,
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
  getProjectById: vi.fn(),
}

const renderModal = (onClose = vi.fn(), onSave = vi.fn()) => {
  return render(
    <TaskProvider>
      <TaskEditModal task={mockTask} onClose={onClose} onSave={onSave} />
    </TaskProvider>
  )
}

describe('TaskEditModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders modal with task data', () => {
    renderModal()
    
    expect(screen.getByText('Edit Task')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test Task')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test description')).toBeInTheDocument()
    expect(screen.getByDisplayValue('60')).toBeInTheDocument()
    expect(screen.getByDisplayValue('high')).toBeInTheDocument()
  })

  it('shows task creation date and progress', () => {
    renderModal()
    
    expect(screen.getByText(/Created Jan 1, 2024/)).toBeInTheDocument()
    expect(screen.getByText(/20m completed/)).toBeInTheDocument()
  })

  it('displays progress bar for partially completed tasks', () => {
    renderModal()
    
    expect(screen.getByText('Progress')).toBeInTheDocument()
    expect(screen.getByText('Completed: 20m')).toBeInTheDocument()
    expect(screen.getByText('Remaining: 40m')).toBeInTheDocument()
  })

  it('shows dependency information', () => {
    renderModal()
    
    expect(screen.getByText('Dependencies')).toBeInTheDocument()
    expect(screen.getByText('Depends on 1 task')).toBeInTheDocument()
    expect(screen.getByText('1 task depend on this')).toBeInTheDocument()
  })

  it('validates required fields', async () => {
    const user = userEvent.setup()
    renderModal()
    
    const titleInput = screen.getByDisplayValue('Test Task')
    await user.clear(titleInput)
    
    const saveButton = screen.getByText('Save Changes')
    await user.click(saveButton)
    
    expect(screen.getByText('Task title is required')).toBeInTheDocument()
  })

  it('validates duration limits', async () => {
    const user = userEvent.setup()
    renderModal()
    
    const durationInput = screen.getByDisplayValue('60')
    await user.clear(durationInput)
    await user.type(durationInput, '2')
    
    const saveButton = screen.getByText('Save Changes')
    await user.click(saveButton)
    
    expect(screen.getByText('Minimum 5 minutes')).toBeInTheDocument()
  })

  it('saves changes and calls onSave', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    renderModal(vi.fn(), onSave)
    
    const titleInput = screen.getByDisplayValue('Test Task')
    await user.clear(titleInput)
    await user.type(titleInput, 'Updated Task')
    
    const saveButton = screen.getByText('Save Changes')
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Task',
          remainingMinutes: 40, // duration - completedMinutes
        })
      )
    })
  })

  it('closes modal on cancel', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderModal(onClose)
    
    const cancelButton = screen.getByText('Cancel')
    await user.click(cancelButton)
    
    expect(onClose).toHaveBeenCalled()
  })

  it('closes modal on backdrop click', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderModal(onClose)
    
    // Click backdrop - find by class since it doesn't have a role
    const backdrop = document.querySelector('.fixed.inset-0.bg-black')
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(onClose).toHaveBeenCalled()
    }
  })

  it('handles escape key to close', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderModal(onClose)
    
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows confirmation when closing with unsaved changes', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    
    renderModal(onClose)
    
    // Make a change
    const titleInput = screen.getByDisplayValue('Test Task')
    await user.type(titleInput, ' Modified')
    
    const cancelButton = screen.getByText('Cancel')
    await user.click(cancelButton)
    
    expect(confirmSpy).toHaveBeenCalledWith('You have unsaved changes. Are you sure you want to cancel?')
    expect(onClose).toHaveBeenCalled()
    
    confirmSpy.mockRestore()
  })

  it('shows delete confirmation dialog', async () => {
    const user = userEvent.setup()
    renderModal()
    
    const deleteButton = screen.getByText('Delete Task')
    await user.click(deleteButton)
    
    expect(screen.getByText('Delete Task')).toBeInTheDocument()
    expect(screen.getByText(/Are you sure you want to delete "Test Task"/)).toBeInTheDocument()
  })

  it('handles delete confirmation', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderModal(onClose)
    
    const deleteButton = screen.getByText('Delete Task')
    await user.click(deleteButton)
    
    const confirmDeleteButton = screen.getAllByText('Delete')[1] // Second "Delete" button in confirmation
    await user.click(confirmDeleteButton)
    
    expect(onClose).toHaveBeenCalled()
  })

  it('cancels delete confirmation', async () => {
    const user = userEvent.setup()
    renderModal()
    
    const deleteButton = screen.getByText('Delete Task')
    await user.click(deleteButton)
    
    const cancelDeleteButton = screen.getAllByText('Cancel')[1] // Cancel in delete confirmation
    await user.click(cancelDeleteButton)
    
    // Should close delete confirmation but keep main modal open
    expect(screen.getByText('Edit Task')).toBeInTheDocument()
  })

  it('shows hard deadline checkbox when deadline is set', () => {
    renderModal()
    
    expect(screen.getByLabelText(/Hard deadline/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Hard deadline/)).toBeChecked()
  })

  it('shows blocking task checkbox', () => {
    renderModal()
    
    expect(screen.getByLabelText(/Blocking task/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Blocking task/)).not.toBeChecked()
  })

  it('updates remaining minutes when duration changes', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    renderModal(vi.fn(), onSave)
    
    const durationInput = screen.getByDisplayValue('60')
    await user.clear(durationInput)
    await user.type(durationInput, '90')
    
    const saveButton = screen.getByText('Save Changes')
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: 90,
          remainingMinutes: 70, // 90 - 20 completed
        })
      )
    })
  })

  it('shows project selection', () => {
    renderModal()
    
    expect(screen.getByText('Project')).toBeInTheDocument()
    expect(screen.getByDisplayValue('proj1')).toBeInTheDocument()
  })
})