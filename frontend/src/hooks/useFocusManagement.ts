import { useEffect, useRef, useCallback } from 'react'

export interface FocusableElement {
  element: HTMLElement
  priority: number
  group?: string
}

export const useFocusManagement = () => {
  const focusHistoryRef = useRef<HTMLElement[]>([])
  const focusGroupsRef = useRef<Map<string, HTMLElement[]>>(new Map())

  // Get all focusable elements in the document
  const getFocusableElements = useCallback((): HTMLElement[] => {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ')

    return Array.from(document.querySelectorAll(focusableSelectors)) as HTMLElement[]
  }, [])

  // Get focusable elements within a container
  const getFocusableElementsInContainer = useCallback((container: HTMLElement): HTMLElement[] => {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ')

    return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[]
  }, [])

  // Focus the first focusable element in a container
  const focusFirstInContainer = useCallback((container: HTMLElement | string) => {
    const containerElement = typeof container === 'string' 
      ? document.querySelector(container) as HTMLElement
      : container

    if (!containerElement) return false

    const focusableElements = getFocusableElementsInContainer(containerElement)
    if (focusableElements.length > 0) {
      focusableElements[0].focus()
      return true
    }
    return false
  }, [getFocusableElementsInContainer])

  // Focus the last focusable element in a container
  const focusLastInContainer = useCallback((container: HTMLElement | string) => {
    const containerElement = typeof container === 'string' 
      ? document.querySelector(container) as HTMLElement
      : container

    if (!containerElement) return false

    const focusableElements = getFocusableElementsInContainer(containerElement)
    if (focusableElements.length > 0) {
      focusableElements[focusableElements.length - 1].focus()
      return true
    }
    return false
  }, [getFocusableElementsInContainer])

  // Navigate focus within a container (for arrow key navigation)
  const navigateFocusInContainer = useCallback((
    container: HTMLElement | string,
    direction: 'next' | 'prev' | 'first' | 'last'
  ) => {
    const containerElement = typeof container === 'string' 
      ? document.querySelector(container) as HTMLElement
      : container

    if (!containerElement) return false

    const focusableElements = getFocusableElementsInContainer(containerElement)
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement)

    let targetIndex: number

    switch (direction) {
      case 'next':
        targetIndex = currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0
        break
      case 'prev':
        targetIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1
        break
      case 'first':
        targetIndex = 0
        break
      case 'last':
        targetIndex = focusableElements.length - 1
        break
      default:
        return false
    }

    if (focusableElements[targetIndex]) {
      focusableElements[targetIndex].focus()
      return true
    }
    return false
  }, [getFocusableElementsInContainer])

  // Trap focus within a container (for modals)
  const trapFocus = useCallback((container: HTMLElement) => {
    const focusableElements = getFocusableElementsInContainer(container)
    
    if (focusableElements.length === 0) return () => {}

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    // Focus first element initially
    firstElement.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      if (event.shiftKey) {
        // Shift + Tab (backward)
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab (forward)
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  }, [getFocusableElementsInContainer])

  // Save current focus to history
  const saveFocus = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement
    if (activeElement && activeElement !== document.body) {
      focusHistoryRef.current.push(activeElement)
      // Keep only last 10 focus states
      if (focusHistoryRef.current.length > 10) {
        focusHistoryRef.current.shift()
      }
    }
  }, [])

  // Restore previous focus
  const restoreFocus = useCallback(() => {
    const previousElement = focusHistoryRef.current.pop()
    if (previousElement && document.contains(previousElement)) {
      previousElement.focus()
      return true
    }
    return false
  }, [])

  // Focus management for specific UI patterns
  const focusPatterns = {
    // Focus task sidebar
    focusTaskSidebar: useCallback(() => {
      return focusFirstInContainer('[data-testid="task-sidebar"]')
    }, [focusFirstInContainer]),

    // Focus calendar
    focusCalendar: useCallback(() => {
      return focusFirstInContainer('[data-testid="calendar-container"]')
    }, [focusFirstInContainer]),

    // Focus search
    focusSearch: useCallback(() => {
      const searchInput = document.querySelector('[data-testid="task-search"]') as HTMLInputElement
      if (searchInput) {
        searchInput.focus()
        searchInput.select()
        return true
      }
      return false
    }, []),

    // Focus main content
    focusMainContent: useCallback(() => {
      const mainContent = document.querySelector('main') as HTMLElement
      if (mainContent) {
        // Set tabindex temporarily to make it focusable
        mainContent.setAttribute('tabindex', '-1')
        mainContent.focus()
        // Remove tabindex after focus
        setTimeout(() => mainContent.removeAttribute('tabindex'), 100)
        return true
      }
      return false
    }, [])
  }

  // Skip links functionality
  const createSkipLink = useCallback((targetSelector: string, label: string) => {
    const skipLink = document.createElement('a')
    skipLink.href = '#'
    skipLink.textContent = label
    skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded'
    
    skipLink.addEventListener('click', (event) => {
      event.preventDefault()
      const target = document.querySelector(targetSelector) as HTMLElement
      if (target) {
        target.setAttribute('tabindex', '-1')
        target.focus()
        setTimeout(() => target.removeAttribute('tabindex'), 100)
      }
    })

    return skipLink
  }, [])

  // Initialize skip links
  useEffect(() => {
    const skipLinks = [
      { selector: 'main', label: 'Skip to main content' },
      { selector: '[data-testid="task-sidebar"]', label: 'Skip to task sidebar' },
      { selector: '[data-testid="calendar-container"]', label: 'Skip to calendar' }
    ]

    const skipLinksContainer = document.createElement('div')
    skipLinksContainer.setAttribute('aria-label', 'Skip links')
    
    skipLinks.forEach(({ selector, label }) => {
      const skipLink = createSkipLink(selector, label)
      skipLinksContainer.appendChild(skipLink)
    })

    document.body.insertBefore(skipLinksContainer, document.body.firstChild)

    return () => {
      if (document.body.contains(skipLinksContainer)) {
        document.body.removeChild(skipLinksContainer)
      }
    }
  }, [createSkipLink])

  return {
    getFocusableElements,
    getFocusableElementsInContainer,
    focusFirstInContainer,
    focusLastInContainer,
    navigateFocusInContainer,
    trapFocus,
    saveFocus,
    restoreFocus,
    focusPatterns
  }
}