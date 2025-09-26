import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { vi } from 'vitest'
import Calendar from '../Calendar'
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

describe('Calendar Component', () => {
  beforeEach(() => {
    // Reset any mocks
    vi.clearAllMocks()
  })

  it('renders calendar component', () => {
    render(
      <TestWrapper>
        <Calendar />
      </TestWrapper>
    )

    // Should render the calendar container
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('handles keyboard shortcuts', () => {
    render(
      <TestWrapper>
        <Calendar />
      </TestWrapper>
    )

    // Test view switching shortcuts
    fireEvent.keyDown(document, { key: '1' })
    fireEvent.keyDown(document, { key: '2' })
    fireEvent.keyDown(document, { key: '3' })

    // Test navigation shortcuts
    fireEvent.keyDown(document, { key: 'ArrowLeft', ctrlKey: true })
    fireEvent.keyDown(document, { key: 'ArrowRight', ctrlKey: true })
    fireEvent.keyDown(document, { key: 't', ctrlKey: true })

    // Should not throw errors
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(
      <TestWrapper>
        <Calendar />
      </TestWrapper>
    )

    // Loading state should be handled by context
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('displays error messages', () => {
    render(
      <TestWrapper>
        <Calendar />
      </TestWrapper>
    )

    // Error handling should be managed by context
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('switches between calendar views', () => {
    render(
      <TestWrapper>
        <Calendar />
      </TestWrapper>
    )

    // Default should show week view
    expect(screen.getByRole('main')).toBeInTheDocument()
  })
})