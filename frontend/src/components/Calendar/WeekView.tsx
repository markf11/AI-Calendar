import React, { useMemo } from 'react'
import { useCalendar } from '../../contexts/CalendarContext'
import { useTask } from '../../contexts/TaskContext'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from 'date-fns'
import CalendarEvent from './CalendarEvent'
import TimeGrid from './TimeGrid'
import { CalendarEvent as CalendarEventType, Task } from '../../types'

const WeekView: React.FC = () => {
  const { state: calendarState, setSelectedDate } = useCalendar()
  const { state: taskState } = useTask()
  const { currentDate, events, selectedDate } = calendarState

  // Calculate week boundaries
  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate])
  const weekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate])
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd])

  // Filter events for the current week
  const weekEvents = useMemo(() => {
    return events.filter(event => {
      const eventDate = new Date(event.startTime)
      return eventDate >= weekStart && eventDate <= weekEnd
    })
  }, [events, weekStart, weekEnd])

  // Get scheduled tasks for the week
  const scheduledTasks = useMemo(() => {
    return taskState.tasks.filter(task => 
      task.scheduledSlots.some(slot => {
        const slotDate = new Date(slot.startTime)
        return slotDate >= weekStart && slotDate <= weekEnd
      })
    )
  }, [taskState.tasks, weekStart, weekEnd])

  const handleDateClick = (date: Date) => {
    setSelectedDate(isSameDay(date, selectedDate || new Date()) ? undefined : date)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Week Header */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {/* Time column header */}
        <div className="w-16 flex-shrink-0 border-r border-gray-200"></div>
        
        {/* Day headers */}
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className={`flex-1 min-w-0 border-r border-gray-200 last:border-r-0 ${
              isToday(day) ? 'bg-primary-50' : ''
            }`}
          >
            <button
              onClick={() => handleDateClick(day)}
              className={`w-full p-3 text-center hover:bg-gray-100 transition-colors ${
                selectedDate && isSameDay(day, selectedDate) ? 'bg-primary-100' : ''
              } ${isToday(day) ? 'bg-primary-50 hover:bg-primary-100' : ''}`}
            >
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {format(day, 'EEE')}
              </div>
              <div className={`text-lg font-semibold mt-1 ${
                isToday(day) ? 'text-primary-600' : 'text-gray-900'
              }`}>
                {format(day, 'd')}
              </div>
            </button>
          </div>
        ))}
      </div>

      {/* Week Grid */}
      <div className="flex-1 overflow-auto">
        <div className="relative">
          <TimeGrid />
          
          {/* Day Columns */}
          <div className="flex">
            {/* Time labels column */}
            <div className="w-16 flex-shrink-0 border-r border-gray-200">
              {Array.from({ length: 24 }, (_, hour) => (
                <div
                  key={hour}
                  className="h-16 border-b border-gray-100 flex items-start justify-end pr-2 pt-1"
                >
                  {hour > 0 && (
                    <span className="text-xs text-gray-500">
                      {format(new Date().setHours(hour, 0, 0, 0), 'HH:mm')}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Day columns with events */}
            {weekDays.map((day, dayIndex) => (
              <div
                key={day.toISOString()}
                className="flex-1 min-w-0 border-r border-gray-200 last:border-r-0 relative"
              >
                {/* Hour grid lines */}
                {Array.from({ length: 24 }, (_, hour) => (
                  <div
                    key={hour}
                    className={`h-16 border-b border-gray-100 ${
                      isToday(day) ? 'bg-primary-25' : ''
                    }`}
                  />
                ))}

                {/* Current time indicator */}
                {isToday(day) && <CurrentTimeIndicator />}

                {/* Events for this day */}
                {weekEvents
                  .filter(event => isSameDay(new Date(event.startTime), day))
                  .map(event => (
                    <CalendarEvent
                      key={event.id}
                      event={event}
                      dayIndex={dayIndex}
                      totalDays={7}
                    />
                  ))}

                {/* Scheduled tasks for this day */}
                {scheduledTasks
                  .filter(task => 
                    task.scheduledSlots.some(slot => 
                      isSameDay(new Date(slot.startTime), day)
                    )
                  )
                  .map(task => 
                    task.scheduledSlots
                      .filter(slot => isSameDay(new Date(slot.startTime), day))
                      .map(slot => (
                        <TaskSlot
                          key={`${task.id}-${slot.id}`}
                          task={task}
                          slot={slot}
                          dayIndex={dayIndex}
                          totalDays={7}
                        />
                      ))
                  )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Current time indicator component
const CurrentTimeIndicator: React.FC = () => {
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  const topPosition = (minutes / (24 * 60)) * (24 * 64) // 64px per hour

  return (
    <div
      className="absolute left-0 right-0 z-10 pointer-events-none"
      style={{ top: `${topPosition}px` }}
    >
      <div className="flex items-center">
        <div className="w-2 h-2 bg-red-500 rounded-full -ml-1"></div>
        <div className="flex-1 h-0.5 bg-red-500"></div>
      </div>
    </div>
  )
}

// Task slot component for scheduled tasks
interface TaskSlotProps {
  task: Task
  slot: any // ScheduledSlot type
  dayIndex: number
  totalDays: number
}

const TaskSlot: React.FC<TaskSlotProps> = ({ task, slot, dayIndex, totalDays }) => {
  const startTime = new Date(slot.startTime)
  const endTime = new Date(slot.endTime)
  const startMinutes = startTime.getHours() * 60 + startTime.getMinutes()
  const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60)
  
  const topPosition = (startMinutes / (24 * 60)) * (24 * 64)
  const height = (duration / (24 * 60)) * (24 * 64)

  const priorityColors = {
    low: 'bg-green-100 border-green-300 text-green-800',
    medium: 'bg-yellow-100 border-yellow-300 text-yellow-800',
    high: 'bg-orange-100 border-orange-300 text-orange-800',
    critical: 'bg-red-100 border-red-300 text-red-800',
  }

  return (
    <div
      className={`absolute left-1 right-1 border-l-4 rounded-r-md p-2 cursor-pointer hover:shadow-md transition-shadow ${
        priorityColors[task.priority]
      } ${task.isBlocking ? 'border-l-8' : ''}`}
      style={{
        top: `${topPosition}px`,
        height: `${Math.max(height, 32)}px`,
        zIndex: 20,
      }}
      title={`${task.title} (${format(startTime, 'HH:mm')} - ${format(endTime, 'HH:mm')})`}
    >
      <div className="text-sm font-medium truncate">{task.title}</div>
      {height > 40 && (
        <div className="text-xs opacity-75 mt-1">
          {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
        </div>
      )}
    </div>
  )
}

export default WeekView