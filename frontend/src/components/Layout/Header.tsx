import React from 'react'
import { useCalendar } from '../../contexts/CalendarContext'
import { CalendarView } from '../../types'
import { format } from 'date-fns'

const Header: React.FC = () => {
  const { state, setView, navigateDate, goToToday } = useCalendar()
  const { view, currentDate } = state

  const formatHeaderDate = (date: Date, view: CalendarView) => {
    switch (view) {
      case 'day':
        return format(date, 'EEEE, MMMM d, yyyy')
      case 'week':
        return format(date, 'MMMM yyyy')
      case 'month':
        return format(date, 'MMMM yyyy')
      default:
        return format(date, 'MMMM yyyy')
    }
  }

  const viewButtons: { key: CalendarView; label: string; shortcut: string }[] = [
    { key: 'day', label: 'Day', shortcut: '1' },
    { key: 'week', label: 'Week', shortcut: '2' },
    { key: 'month', label: 'Month', shortcut: '3' },
  ]

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4" role="banner">
      <div className="flex items-center justify-between">
        {/* Left: Logo and Navigation */}
        <div className="flex items-center space-x-6">
          <h1 className="text-2xl font-bold text-gray-900">Momentum</h1>
          
          {/* Date Navigation */}
          <nav className="flex items-center space-x-2" aria-label="Calendar navigation">
            <button
              onClick={() => navigateDate('prev')}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              aria-label="Previous period"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              aria-label="Go to today"
            >
              Today
            </button>
            
            <button
              onClick={() => navigateDate('next')}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              aria-label="Next period"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </nav>
          
          {/* Current Date Display */}
          <h2 className="text-xl font-semibold text-gray-900" aria-live="polite">
            {formatHeaderDate(currentDate, view)}
          </h2>
        </div>

        {/* Right: View Controls */}
        <div className="flex items-center space-x-4">
          {/* View Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1" role="tablist" aria-label="Calendar view selector">
            {viewButtons.map(({ key, label, shortcut }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                  view === key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                role="tab"
                aria-selected={view === key}
                aria-controls="calendar-content"
                title={`Switch to ${label} view (${shortcut})`}
                aria-label={`Switch to ${label} view`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Settings Button */}
          <button
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            aria-label="Open settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header