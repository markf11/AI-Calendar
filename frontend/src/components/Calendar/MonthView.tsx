import React, { useMemo } from 'react'
import { useCalendar } from '../../contexts/CalendarContext'
import { useTask } from '../../contexts/TaskContext'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday 
} from 'date-fns'

const MonthView: React.FC = () => {
  const { state: calendarState, setSelectedDate, setView } = useCalendar()
  const { state: taskState } = useTask()
  const { currentDate, events, selectedDate } = calendarState

  // Calculate month boundaries
  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate])
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate])
  const calendarStart = useMemo(() => startOfWeek(monthStart, { weekStartsOn: 1 }), [monthStart])
  const calendarEnd = useMemo(() => endOfWeek(monthEnd, { weekStartsOn: 1 }), [monthEnd])
  const calendarDays = useMemo(() => eachDayOfInterval({ start: calendarStart, end: calendarEnd }), [calendarStart, calendarEnd])

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: { [key: string]: typeof events } = {}
    events.forEach(event => {
      const dateKey = format(new Date(event.startTime), 'yyyy-MM-dd')
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(event)
    })
    return grouped
  }, [events])

  // Group scheduled tasks by date
  const tasksByDate = useMemo(() => {
    const grouped: { [key: string]: any[] } = {}
    taskState.tasks.forEach(task => {
      task.scheduledSlots.forEach(slot => {
        const dateKey = format(new Date(slot.startTime), 'yyyy-MM-dd')
        if (!grouped[dateKey]) {
          grouped[dateKey] = []
        }
        grouped[dateKey].push({ task, slot })
      })
    })
    return grouped
  }, [taskState.tasks])

  const handleDateClick = (date: Date) => {
    if (isSameDay(date, selectedDate || new Date())) {
      // Double click - switch to day view
      setView('day')
    } else {
      setSelectedDate(date)
    }
  }

  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="flex flex-col h-full">
      {/* Month Header */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="grid grid-cols-7">
          {weekdays.map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wide">
              {day}
            </div>
          ))}
        </div>
      </div>

      {/* Month Grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 h-full">
          {calendarDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const dayEvents = eventsByDate[dateKey] || []
            const dayTasks = tasksByDate[dateKey] || []
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isSelected = selectedDate && isSameDay(day, selectedDate)
            const isCurrentDay = isToday(day)

            return (
              <div
                key={day.toISOString()}
                className={`border-r border-b border-gray-200 last:border-r-0 min-h-32 p-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                  !isCurrentMonth ? 'bg-gray-25 text-gray-400' : ''
                } ${isSelected ? 'bg-primary-50' : ''} ${isCurrentDay ? 'bg-blue-50' : ''}`}
                onClick={() => handleDateClick(day)}
              >
                {/* Date number */}
                <div className={`text-sm font-medium mb-1 ${
                  isCurrentDay ? 'bg-primary-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : ''
                }`}>
                  {format(day, 'd')}
                </div>

                {/* Events and tasks */}
                <div className="space-y-1">
                  {/* Firm events */}
                  {dayEvents
                    .filter(event => !event.isFlexible)
                    .slice(0, 2)
                    .map(event => (
                      <div
                        key={event.id}
                        className="text-xs p-1 rounded bg-blue-100 text-blue-800 truncate"
                        title={`${event.title} - ${format(new Date(event.startTime), 'HH:mm')}`}
                      >
                        {format(new Date(event.startTime), 'HH:mm')} {event.title}
                      </div>
                    ))}

                  {/* Flexible events */}
                  {dayEvents
                    .filter(event => event.isFlexible)
                    .slice(0, 1)
                    .map(event => (
                      <div
                        key={event.id}
                        className="text-xs p-1 rounded bg-purple-100 text-purple-800 truncate border-l-2 border-purple-300 border-dashed"
                        title={`${event.title} - ${format(new Date(event.startTime), 'HH:mm')} (AI Scheduled)`}
                      >
                        {format(new Date(event.startTime), 'HH:mm')} {event.title}
                      </div>
                    ))}

                  {/* Scheduled tasks */}
                  {dayTasks
                    .slice(0, 2)
                    .map(({ task, slot }, index) => {
                      const priorityColors = {
                        low: 'bg-green-100 text-green-800 border-green-300',
                        medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                        high: 'bg-orange-100 text-orange-800 border-orange-300',
                        critical: 'bg-red-100 text-red-800 border-red-300',
                      }
                      
                      return (
                        <div
                          key={`${task.id}-${slot.id}`}
                          className={`text-xs p-1 rounded truncate border-l-2 ${
                            priorityColors[task.priority]
                          } ${task.isBlocking ? 'border-l-4' : ''}`}
                          title={`${task.title} - ${format(new Date(slot.startTime), 'HH:mm')}`}
                        >
                          {format(new Date(slot.startTime), 'HH:mm')} {task.title}
                        </div>
                      )
                    })}

                  {/* More indicator */}
                  {(dayEvents.length + dayTasks.length) > 3 && (
                    <div className="text-xs text-gray-500 font-medium">
                      +{dayEvents.length + dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default MonthView