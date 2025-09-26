import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useFocusManagement } from '../../hooks/useFocusManagement'

interface KeyboardShortcutsHelpProps {
  isOpen: boolean
  onClose: () => void
}

const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({ isOpen, onClose }) => {
  const { shortcuts } = useKeyboardShortcuts()
  const { trapFocus } = useFocusManagement()
  const [modalRef, setModalRef] = useState<HTMLDivElement | null>(null)

  // Group shortcuts by category
  const shortcutsByCategory = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = []
    }
    acc[shortcut.category].push(shortcut)
    return acc
  }, {} as Record<string, typeof shortcuts>)

  // Format key combination for display
  const formatKeyCombo = (shortcut: typeof shortcuts[0]) => {
    const keys = []
    
    if (shortcut.ctrlKey) keys.push('Ctrl')
    if (shortcut.metaKey) keys.push('Cmd')
    if (shortcut.shiftKey) keys.push('Shift')
    if (shortcut.altKey) keys.push('Alt')
    
    // Special key formatting
    let keyDisplay = shortcut.key
    switch (shortcut.key) {
      case 'ArrowLeft':
        keyDisplay = '←'
        break
      case 'ArrowRight':
        keyDisplay = '→'
        break
      case 'ArrowUp':
        keyDisplay = '↑'
        break
      case 'ArrowDown':
        keyDisplay = '↓'
        break
      case 'Escape':
        keyDisplay = 'Esc'
        break
      case ' ':
        keyDisplay = 'Space'
        break
    }
    
    keys.push(keyDisplay)
    return keys
  }

  // Category display names
  const categoryNames = {
    navigation: 'Navigation',
    calendar: 'Calendar Views',
    tasks: 'Task Management',
    general: 'General'
  }

  // Trap focus when modal is open
  useEffect(() => {
    if (isOpen && modalRef) {
      const cleanup = trapFocus(modalRef)
      return cleanup
    }
  }, [isOpen, modalRef, trapFocus])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <motion.div
          ref={setModalRef}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby="shortcuts-title"
          aria-describedby="shortcuts-description"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="shortcuts-title" className="text-xl font-semibold text-gray-900">
                  Keyboard Shortcuts
                </h2>
                <p id="shortcuts-description" className="text-sm text-gray-600 mt-1">
                  Use these shortcuts to navigate Momentum more efficiently
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close keyboard shortcuts help"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
            <div className="space-y-6">
              {Object.entries(categoryNames).map(([category, displayName]) => {
                const categoryShortcuts = shortcutsByCategory[category]
                if (!categoryShortcuts || categoryShortcuts.length === 0) return null

                return (
                  <div key={category}>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">
                      {displayName}
                    </h3>
                    <div className="space-y-2">
                      {categoryShortcuts.map((shortcut, index) => (
                        <div
                          key={`${category}-${index}`}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                        >
                          <span className="text-gray-700">{shortcut.description}</span>
                          <div className="flex items-center space-x-1">
                            {formatKeyCombo(shortcut).map((key, keyIndex) => (
                              <React.Fragment key={keyIndex}>
                                {keyIndex > 0 && (
                                  <span className="text-gray-400 text-sm">+</span>
                                )}
                                <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded">
                                  {key}
                                </kbd>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Press <kbd className="px-1 py-0.5 text-xs bg-gray-200 rounded">?</kbd> to show this help again</span>
              <span>Press <kbd className="px-1 py-0.5 text-xs bg-gray-200 rounded">Esc</kbd> to close</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default KeyboardShortcutsHelp