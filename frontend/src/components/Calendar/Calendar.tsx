import React, { useEffect, useState } from 'react'
import { useCalendar } from '../../contexts/CalendarContext'
import { useTask } from '../../contexts/TaskContext'
import DayView from './DayView'
import WeekView from './WeekView'
import MonthView from './MonthView'
import KeyboardShortcutsHelp from '../KeyboardShortcuts/KeyboardShortcutsHelp'
import { motion, AnimatePresence } from 'framer-motion'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'

const Calendar: React.FC = () => {
  const { state: calendarState } = useCalendar()
  const { state: taskState } = useTask()
  const { view } = calendarState
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)

  // Initialize keyboard shortcuts
  useKeyboardShortcuts()

  // Listen for keyboard help events
  useEffect(() => {
    const handleShowKeyboardHelp = () => setShowKeyboardHelp(true)
    const handleCloseModals = () => setShowKeyboardHelp(false)

    document.addEventListener('showKeyboardHelp', handleShowKeyboardHelp)
    document.addEventListener('closeModals', handleCloseModals)

    return () => {
      document.removeEventListener('showKeyboardHelp', handleShowKeyboardHelp)
      document.removeEventListener('closeModals', handleCloseModals)
    }
  }, [])

  const renderCalendarView = () => {
    switch (view) {
      case 'day':
        return <DayView />
      case 'week':
        return <WeekView />
      case 'month':
        return <MonthView />
      default:
        return <WeekView />
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-white" data-testid="calendar-container">
      {/* Loading Overlay */}
      <AnimatePresence>
        {calendarState.isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50"
            role="status"
            aria-live="polite"
            aria-label="Updating schedule"
          >
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" aria-hidden="true"></div>
              <span className="text-gray-600">Updating schedule...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {calendarState.error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 mx-4 mt-4 rounded-lg"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {calendarState.error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar View */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderCalendarView()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
    </div>
  )
}

export default Calendar