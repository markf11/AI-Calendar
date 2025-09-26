import React, { useMemo } from 'react'
import { useCalendar } from '../../contexts/CalendarContext'
import { useTask } from '../../contexts/TaskContext'
import { format, isSameDay, isToday } from 'date-fns'
import CalendarEvent from './CalendarEvent'
import TimeGrid from './TimeGrid'
import { CalendarEvent as CalendarEventType } from '../../types'

const DayView: React.FC = () => {
  const { state: calendarState } = useCalendar()
  const { state: taskState } = useTask()
  const { currentDate, events } = calendarState

  // Filter events for the current day
  const dayEvents = useMemo(() => {
    return events.filter(event => {
      const eventDate = new Date(event.startTime)
      return isSameDay(eventDate, currentDate)
    })
  }, [events, currentDate])

  // Get scheduled tasks for the day
  const scheduledTasks = useMemo(() => {
    return taskState.tasks.filter(task => 
      task.scheduledSlots.some(slot => {
        const slotDate = new Date(slot.startTime)
        return isSameDay(slotDate, currentDate)
      })
    )
  }, [taskState.tasks, currentDate])

  return (
    <div className="flex flex-col h-full">
      {/* Day Header */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {/* Time column header */}
        <div className="w-16 flex-shrink-0 border-r border-gray-200"></div>
        
        {/* Day header */}
        <div className={`flex-1 ${isToday(currentDate) ? 'bg-primary-50' : ''}`}>
          <div className="p-4 text-center">
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              {format(currentDate, 'EEEE')}
            </div>
            <div className={`text-2xl font-bold mt-1 ${
              isToday(currentDate) ? 'text-primary-600' : 'text-gray-900'
            }`}>
              {format(currentDate, 'MMMM d, yyyy')}
            </div>
          </div>
        </div>
      </div>

      {/* Day Grid */}
      <div className="flex-1 overflow-auto">
        <div className="relative">
          <TimeGrid />
          
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

            {/* Day column with events */}
            <div className="flex-1 relative">
              {/* Hour grid lines */}
              {Array.from({ length: 24 }, (_, hour) => (
                <div
                  key={hour}
                  className={`h-16 border-b border-gray-100 ${
                    isToday(currentDate) ? 'bg-primary-25' : ''
                  }`}
                />
              ))}

              {/* Current time indicator */}
              {isToday(currentDate) && <CurrentTimeIndicator />}

              {/* Events for this day */}
              {dayEvents.map(event => (
                <CalendarEvent
                  key={event.id}
                  event={event}
                  dayIndex={0}
                  totalDays={1}
                />
              ))}

              {/* Scheduled tasks for this day */}
              {scheduledTasks.map(task => 
                task.scheduledSlots
                  .filter(slot => isSameDay(new Date(slot.startTime), currentDate))
                  .map(slot => (
                    <TaskSlot
                      key={`${task.id}-${slot.id}`}
                      task={task}
                      slot={slot}
                      dayIndex={0}
                      totalDays={1}
                    />
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Current time indicator component (same as WeekView)
const CurrentTimeIndicator: React.FC = () => {
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  const topPosition = (minutes / (24 * 60)) * (24 * 64)

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

// Task slot component (same as WeekView)
interface TaskSlotProps {
  task: any // Task type
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
      className={`absolute left-2 right-2 border-l-4 rounded-r-md p-3 cursor-pointer hover:shadow-md transition-shadow ${
        priorityColors[task.priority]
      } ${task.isBlocking ? 'border-l-8' : ''}`}
      style={{
        top: `${topPosition}px`,
        height: `${Math.max(height, 40)}px`,
        zIndex: 20,
      }}
      title={`${task.title} (${format(startTime, 'HH:mm')} - ${format(endTime, 'HH:mm')})`}
    >
      <div className="text-sm font-medium truncate">{task.title}</div>
      {height > 50 && (
        <div className="text-xs opacity-75 mt-1">
          {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
        </div>
      )}
      {height > 70 && task.description && (
        <div className="text-xs opacity-60 mt-1 line-clamp-2">
          {task.description}
        </div>
      )}
    </div>
  )
}

export default DayView