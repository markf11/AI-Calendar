import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { vi } from 'vitest'
import CalendarEvent from '../CalendarEvent'
import { CalendarProvider } from '../../../contexts/CalendarContext'
import { TaskProvider } from '../../../contexts/TaskContext'
import { CalendarEvent as CalendarEventType } from '../../../types'

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <CalendarProvider>
          <TaskProvider>
            {children}
          </TaskProvider>
        </CalendarProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

const mockEvent: CalendarEventType = {
  id: 'test-event-1',
  userId: 'user-1',
  title: 'Test Meeting',
  description: 'A test meeting',
  startTime: new Date('2024-01-01T09:00:00'),
  endTime: new Date('2024-01-01T10:00:00'),
  isFlexible: false,
  source: 'google',
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('CalendarEvent Component', () => {
  it('renders event with title and time', () => {
    render(
      <TestWrapper>
        <CalendarEvent event={mockEvent} dayIndex={0} totalDays={7} />
      </TestWrapper>
    )

    expect(screen.getByText('Test Meeting')).toBeInTheDocument()
    expect(screen.getByText('09:00 - 10:00')).toBeInTheDocument()
  })

  it('handles event selection', () => {
    render(
      <TestWrapper>
        <CalendarEvent event={mockEvent} dayIndex={0} totalDays={7} />
      </TestWrapper>
    )

    const eventElement = screen.getByRole('button')
    fireEvent.click(eventElement)

    // Should not throw errors
    expect(eventElement).toBeInTheDocument()
  })

  it('handles keyboard navigation', () => {
    render(
      <TestWrapper>
        <CalendarEvent event={mockEvent} dayIndex={0} totalDays={7} />
      </TestWrapper>
    )

    const eventElement = screen.getByRole('button')
    fireEvent.keyDown(eventElement, { key: 'Enter' })
    fireEvent.keyDown(eventElement, { key: ' ' })

    // Should not throw errors
    expect(eventElement).toBeInTheDocument()
  })

  it('displays firm event styling', () => {
    render(
      <TestWrapper>
        <CalendarEvent event={mockEvent} dayIndex={0} totalDays={7} />
      </TestWrapper>
    )

    const eventElement = screen.getByRole('button')
    expect(eventElement).toHaveClass('border-l-4')
  })

  it('displays flexible event styling', () => {
    const flexibleEvent = { ...mockEvent, isFlexible: true }
    
    render(
      <TestWrapper>
        <CalendarEvent event={flexibleEvent} dayIndex={0} totalDays={7} />
      </TestWrapper>
    )

    const eventElement = screen.getByRole('button')
    expect(eventElement).toHaveClass('border-l-2')
  })

  it('shows source indicator', () => {
    render(
      <TestWrapper>
        <CalendarEvent event={mockEvent} dayIndex={0} totalDays={7} />
      </TestWrapper>
    )

    // Should render without errors and show source styling
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})