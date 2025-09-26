import { useEffect, useCallback, useRef } from 'react'
import { useCalendar } from '../contexts/CalendarContext'
import { useTask } from '../contexts/TaskContext'

export interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  description: string
  action: () => void
  category: 'navigation' | 'calendar' | 'tasks' | 'general'
}

export const useKeyboardShortcuts = () => {
  const { setView, navigateDate, goToToday } = useCalendar()
  const { createTask, focusTaskSidebar } = useTask()
  const activeElementRef = useRef<HTMLElement | null>(null)

  // Track focus for proper shortcut handling
  useEffect(() => {
    const handleFocus = (event: FocusEvent) => {
      activeElementRef.current = event.target as HTMLElement
    }

    document.addEventListener('focusin', handleFocus)
    return () => document.removeEventListener('focusin', handleFocus)
  }, [])

  // Check if we're in an input field
  const isInInputField = useCallback(() => {
    const activeElement = document.activeElement
    return activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.getAttribute('contenteditable') === 'true' ||
      activeElement.getAttribute('role') === 'textbox'
    )
  }, [])

  // Define all keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = [
    // Calendar Navigation
    {
      key: '1',
      description: 'Switch to Day view',
      action: () => setView('day'),
      category: 'calendar'
    },
    {
      key: '2',
      description: 'Switch to Week view',
      action: () => setView('week'),
      category: 'calendar'
    },
    {
      key: '3',
      description: 'Switch to Month view',
      action: () => setView('month'),
      category: 'calendar'
    },
    {
      key: 'ArrowLeft',
      ctrlKey: true,
      description: 'Previous period',
      action: () => navigateDate('prev'),
      category: 'navigation'
    },
    {
      key: 'ArrowRight',
      ctrlKey: true,
      description: 'Next period',
      action: () => navigateDate('next'),
      category: 'navigation'
    },
    {
      key: 't',
      ctrlKey: true,
      description: 'Go to Today',
      action: goToToday,
      category: 'navigation'
    },
    // Task Management
    {
      key: 'n',
      ctrlKey: true,
      description: 'Create new task',
      action: () => {
        // Focus task sidebar and open quick form
        focusTaskSidebar()
        // Trigger quick task form
        const event = new CustomEvent('openQuickTaskForm')
        document.dispatchEvent(event)
      },
      category: 'tasks'
    },
    {
      key: 's',
      ctrlKey: true,
      description: 'Focus task sidebar',
      action: focusTaskSidebar,
      category: 'tasks'
    },
    {
      key: 'f',
      ctrlKey: true,
      description: 'Focus search',
      action: () => {
        const searchInput = document.querySelector('[data-testid="task-search"]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
        }
      },
      category: 'general'
    },
    // General Navigation
    {
      key: 'Escape',
      description: 'Close modal/form or clear focus',
      action: () => {
        // Close any open modals
        const event = new CustomEvent('closeModals')
        document.dispatchEvent(event)
        
        // If no modals, blur current element
        if (document.activeElement && document.activeElement !== document.body) {
          (document.activeElement as HTMLElement).blur()
        }
      },
      category: 'general'
    },
    {
      key: '?',
      shiftKey: true,
      description: 'Show keyboard shortcuts help',
      action: () => {
        const event = new CustomEvent('showKeyboardHelp')
        document.dispatchEvent(event)
      },
      category: 'general'
    }
  ]

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't handle shortcuts when typing in input fields
    if (isInInputField()) {
      return
    }

    // Find matching shortcut
    const matchingShortcut = shortcuts.find(shortcut => {
      const keyMatch = shortcut.key === event.key
      const ctrlMatch = !!shortcut.ctrlKey === event.ctrlKey
      const metaMatch = !!shortcut.metaKey === event.metaKey
      const shiftMatch = !!shortcut.shiftKey === event.shiftKey
      const altMatch = !!shortcut.altKey === event.altKey

      return keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch
    })

    if (matchingShortcut) {
      event.preventDefault()
      event.stopPropagation()
      matchingShortcut.action()
    }
  }, [shortcuts, isInInputField])

  // Set up event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return {
    shortcuts,
    isInInputField
  }
}

// Hook for components that need to register custom shortcuts
export const useCustomKeyboardShortcut = (
  key: string,
  action: () => void,
  options: {
    ctrlKey?: boolean
    metaKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
    preventDefault?: boolean
  } = {}
) => {
  const { preventDefault = true } = options

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle if in input field
      const activeElement = document.activeElement
      if (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      )) {
        return
      }

      const keyMatch = key === event.key
      const ctrlMatch = !!options.ctrlKey === event.ctrlKey
      const metaMatch = !!options.metaKey === event.metaKey
      const shiftMatch = !!options.shiftKey === event.shiftKey
      const altMatch = !!options.altKey === event.altKey

      if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
        if (preventDefault) {
          event.preventDefault()
          event.stopPropagation()
        }
        action()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [key, action, options, preventDefault])
}