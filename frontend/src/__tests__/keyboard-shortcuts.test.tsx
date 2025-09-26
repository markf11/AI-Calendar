import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useFocusManagement } from '../hooks/useFocusManagement'

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}))

// Mock contexts
vi.mock('../contexts/CalendarContext', () => ({
  useCalendar: () => ({
    setView: vi.fn(),
    navigateDate: vi.fn(),
    goToToday: vi.fn(),
  }),
}))

vi.mock('../contexts/TaskContext', () => ({
  useTask: () => ({
    focusTaskSidebar: vi.fn(),
  }),
}))

describe('Keyboard Shortcuts', () => {
  test('useKeyboardShortcuts hook returns shortcuts array', () => {
    const TestComponent = () => {
      const { shortcuts } = useKeyboardShortcuts()
      return <div data-testid="shortcuts-count">{shortcuts.length}</div>
    }

    render(<TestComponent />)
    
    const shortcutsCount = screen.getByTestId('shortcuts-count')
    expect(parseInt(shortcutsCount.textContent || '0')).toBeGreaterThan(0)
  })

  test('keyboard shortcuts are properly categorized', () => {
    const TestComponent = () => {
      const { shortcuts } = useKeyboardShortcuts()
      const categories = [...new Set(shortcuts.map(s => s.category))]
      return (
        <div>
          {categories.map(cat => (
            <div key={cat} data-testid={`category-${cat}`}>{cat}</div>
          ))}
        </div>
      )
    }

    render(<TestComponent />)
    
    expect(screen.getByTestId('category-navigation')).toBeInTheDocument()
    expect(screen.getByTestId('category-calendar')).toBeInTheDocument()
    expect(screen.getByTestId('category-tasks')).toBeInTheDocument()
    expect(screen.getByTestId('category-general')).toBeInTheDocument()
  })
})

describe('Focus Management', () => {
  test('useFocusManagement hook provides focus utilities', () => {
    const TestComponent = () => {
      const { getFocusableElements, focusPatterns } = useFocusManagement()
      
      return (
        <div>
          <button onClick={() => getFocusableElements()}>Get Focusable</button>
          <button onClick={focusPatterns.focusTaskSidebar}>Focus Sidebar</button>
          <input data-testid="test-input" />
        </div>
      )
    }

    render(<TestComponent />)
    
    const getFocusableButton = screen.getByText('Get Focusable')
    const focusSidebarButton = screen.getByText('Focus Sidebar')
    
    expect(getFocusableButton).toBeInTheDocument()
    expect(focusSidebarButton).toBeInTheDocument()
  })

  test('creates skip links on mount', () => {
    const TestComponent = () => {
      useFocusManagement()
      return <div>Test</div>
    }

    render(<TestComponent />)
    
    // Skip links should be created in the document
    const skipLinks = document.querySelectorAll('a[href="#"]')
    expect(skipLinks.length).toBeGreaterThan(0)
  })
})

describe('Accessibility Features', () => {
  test('skip links have proper labels', () => {
    const TestComponent = () => {
      useFocusManagement()
      return <div>Test</div>
    }

    render(<TestComponent />)
    
    // Check for skip link text content
    const skipToMain = Array.from(document.querySelectorAll('a')).find(
      link => link.textContent === 'Skip to main content'
    )
    const skipToSidebar = Array.from(document.querySelectorAll('a')).find(
      link => link.textContent === 'Skip to task sidebar'
    )
    
    expect(skipToMain).toBeTruthy()
    expect(skipToSidebar).toBeTruthy()
  })

  test('keyboard shortcuts do not interfere with input fields', async () => {
    const user = userEvent.setup()
    
    const TestComponent = () => {
      useKeyboardShortcuts()
      return <input data-testid="test-input" />
    }

    render(<TestComponent />)
    
    const input = screen.getByTestId('test-input')
    await user.click(input)
    await user.keyboard('123')
    
    expect(input).toHaveValue('123')
  })

  test('focus management provides navigation utilities', () => {
    const TestComponent = () => {
      const { navigateFocusInContainer, focusFirstInContainer } = useFocusManagement()
      
      return (
        <div data-testid="container">
          <button onClick={() => focusFirstInContainer('[data-testid="container"]')}>
            Focus First
          </button>
          <button onClick={() => navigateFocusInContainer('[data-testid="container"]', 'next')}>
            Navigate Next
          </button>
          <button>Button 1</button>
          <button>Button 2</button>
        </div>
      )
    }

    render(<TestComponent />)
    
    const focusFirstButton = screen.getByText('Focus First')
    const navigateButton = screen.getByText('Navigate Next')
    
    // These should not throw errors
    fireEvent.click(focusFirstButton)
    fireEvent.click(navigateButton)
    
    expect(true).toBe(true) // Test passes if no errors thrown
  })
})