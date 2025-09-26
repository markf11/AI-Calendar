import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TaskSidebar from '../TaskSidebar'
import QuickTaskForm from '../QuickTaskForm'
import TaskItem from '../TaskItem'
import { TaskProvider } from '../../../contexts/TaskContext'
import { Task } from '../../../types'

// Simple test to verify components render
describe('Task Management Components', () => {
  const mockTask: Task = {
    id: '1',
    userId: 'user1',
    title: 'Test Task',
    duration: 60,
    priority: 'medium',
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
  }

  it('renders TaskSidebar without crashing', () => {
    render(
      <TaskProvider>
        <TaskSidebar />
      </TaskProvider>
    )
    expect(screen.getByText('Unscheduled Tasks')).toBeInTheDocument()
  })

  it('renders QuickTaskForm without crashing', () => {
    const onClose = vi.fn()
    render(
      <TaskProvider>
        <QuickTaskForm onClose={onClose} />
      </TaskProvider>
    )
    expect(screen.getByText('Add New Task')).toBeInTheDocument()
  })

  it('renders TaskItem without crashing', () => {
    render(
      <TaskProvider>
        <TaskItem task={mockTask} />
      </TaskProvider>
    )
    expect(screen.getByText('Test Task')).toBeInTheDocument()
  })
})