import React from 'react'
import { format } from 'date-fns'
import { CalendarEvent as CalendarEventType } from '../../types'
import { useCalendar } from '../../contexts/CalendarContext'

interface CalendarEventProps {
  event: CalendarEventType
  dayIndex: number
  totalDays: number
}

const CalendarEvent: React.FC<CalendarEventProps> = ({ event, dayIndex, totalDays }) => {
  const { selectEvent, state } = useCalendar()
  const { selectedEventId } = state

  const startTime = new Date(event.startTime)
  const endTime = new Date(event.endTime)
  const startMinutes = startTime.getHours() * 60 + startTime.getMinutes()
  const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60)
  
  const topPosition = (startMinutes / (24 * 60)) * (24 * 64) // 64px per hour
  const height = (duration / (24 * 60)) * (24 * 64)

  const isSelected = selectedEventId === event.id
  const isFirmEvent = !event.isFlexible

  // Visual differentiation between firm events and flexible tasks
  const getEventStyles = () => {
    if (isFirmEvent) {
      // Firm events (from external calendars) - solid colors
      return {
        firm: 'bg-event-firm text-white border-event-firm',
        google: 'bg-blue-600 text-white border-blue-600',
        microsoft: 'bg-orange-600 text-white border-orange-600',
        momentum: 'bg-event-firm text-white border-event-firm',
      }[event.source] || 'bg-event-firm text-white border-event-firm'
    } else {
      // Flexible events (AI-scheduled) - lighter colors
      return 'bg-event-flexible text-white border-event-flexible'
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    selectEvent(isSelected ? null : event.id)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      selectEvent(isSelected ? null : event.id)
    }
  }

  return (
    <div
      className={`absolute left-1 right-1 rounded-md p-2 cursor-pointer transition-all duration-200 calendar-event ${
        getEventStyles()
      } ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-primary-500 shadow-lg' : 'hover:shadow-md'} ${
        isFirmEvent ? 'border-l-4' : 'border-l-2 border-dashed'
      }`}
      style={{
        top: `${topPosition}px`,
        height: `${Math.max(height, 32)}px`,
        zIndex: isSelected ? 30 : 10,
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${event.title} from ${format(startTime, 'HH:mm')} to ${format(endTime, 'HH:mm')}`}
      title={`${event.title}\n${format(startTime, 'HH:mm')} - ${format(endTime, 'HH:mm')}\n${
        isFirmEvent ? 'Firm event' : 'Flexible event'
      } from ${event.source}`}
    >
      <div className="text-sm font-medium truncate">{event.title}</div>
      
      {height > 40 && (
        <div className="text-xs opacity-90 mt-1">
          {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
        </div>
      )}
      
      {height > 60 && event.description && (
        <div className="text-xs opacity-75 mt-1 line-clamp-2">
          {event.description}
        </div>
      )}

      {/* Source indicator */}
      <div className="absolute top-1 right-1">
        {event.source === 'google' && (
          <div className="w-2 h-2 bg-white bg-opacity-30 rounded-full" title="Google Calendar" />
        )}
        {event.source === 'microsoft' && (
          <div className="w-2 h-2 bg-white bg-opacity-30 rounded-full" title="Microsoft Calendar" />
        )}
        {!isFirmEvent && (
          <div className="w-2 h-2 bg-white bg-opacity-30 rounded-full animate-pulse" title="AI Scheduled" />
        )}
      </div>
    </div>
  )
}

export default CalendarEvent