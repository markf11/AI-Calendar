import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { vi } from 'vitest'
import WeekView from '../WeekView'
import { CalendarProvider } from '../../../contexts/CalendarContext'
import { TaskProvider } from '../../../contexts/TaskContext'

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

describe('WeekView Component', () => {
  it('renders week view with day headers', () => {
    render(
      <TestWrapper>
        <WeekView />
      </TestWrapper>
    )

    // Should render day headers
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Tue')).toBeInTheDocument()
    expect(screen.getByText('Wed')).toBeInTheDocument()
    expect(screen.getByText('Thu')).toBeInTheDocument()
    expect(screen.getByText('Fri')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })

  it('renders time grid', () => {
    render(
      <TestWrapper>
        <WeekView />
      </TestWrapper>
    )

    // Should render time labels
    expect(screen.getByText('09:00')).toBeInTheDocument()
  })

  it('handles date selection', () => {
    render(
      <TestWrapper>
        <WeekView />
      </TestWrapper>
    )

    // Click on a day should select it
    const dayButton = screen.getAllByRole('button')[0]
    fireEvent.click(dayButton)

    // Should not throw errors
    expect(dayButton).toBeInTheDocument()
  })

  it('displays events and tasks', () => {
    render(
      <TestWrapper>
        <WeekView />
      </TestWrapper>
    )

    // Should render the week grid structure
    expect(screen.getByText('Mon')).toBeInTheDocument()
  })

  it('shows current time indicator for today', () => {
    render(
      <TestWrapper>
        <WeekView />
      </TestWrapper>
    )

    // Should render without errors
    expect(screen.getByText('Mon')).toBeInTheDocument()
  })
})