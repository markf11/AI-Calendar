import React, { useState } from 'react'
import { format } from 'date-fns'
import { Task } from '../../types'
import { useTask } from '../../contexts/TaskContext'

interface TaskItemProps {
  task: Task
  onEdit?: () => void
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onEdit }) => {
  const { updateTask, deleteTask, getProjectById } = useTask()
  const [isExpanded, setIsExpanded] = useState(false)
  
  const project = task.projectId ? getProjectById(task.projectId) : undefined

  const priorityColors = {
    low: 'bg-green-50 border-green-200 text-green-800',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    high: 'bg-orange-50 border-orange-200 text-orange-800',
    critical: 'bg-red-50 border-red-200 text-red-800',
  }

  const priorityIcons = {
    low: '↓',
    medium: '→',
    high: '↑',
    critical: '⚠',
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    return `${mins}m`
  }

  const handleComplete = () => {
    updateTask(task.id, { 
      status: 'completed',
      completedAt: new Date(),
      completedMinutes: task.duration 
    })
  }

  const handleEdit = () => {
    if (onEdit) {
      onEdit()
    }
  }

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      deleteTask(task.id)
    }
  }

  return (
    <div className={`card border-l-4 p-3 cursor-pointer hover:shadow-md transition-all duration-200 ${
      priorityColors[task.priority]
    } ${task.isBlocking ? 'border-l-8' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Task Title and Priority */}
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-lg" title={`${task.priority} priority`}>
              {priorityIcons[task.priority]}
            </span>
            <h4 className="font-medium text-gray-900 truncate">{task.title}</h4>
            {task.isBlocking && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full" title="Cannot be split">
                Blocking
              </span>
            )}
          </div>

          {/* Project and Duration */}
          <div className="flex items-center space-x-3 text-sm text-gray-600 mb-2">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDuration(task.duration)}
            </span>
            
            {project && (
              <span 
                className="flex items-center px-2 py-1 rounded-full text-xs"
                style={{ backgroundColor: project.color + '20', color: project.color }}
              >
                <div 
                  className="w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: project.color }}
                />
                {project.name}
              </span>
            )}
          </div>

          {/* Deadline */}
          {task.deadline && (
            <div className="flex items-center text-sm text-gray-600 mb-2">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className={task.isHardDeadline ? 'font-medium text-red-600' : ''}>
                {format(new Date(task.deadline), 'MMM d, yyyy')}
                {task.isHardDeadline && ' (Hard)'}
              </span>
            </div>
          )}

          {/* Dependencies */}
          {task.dependencies.length > 0 && (
            <div className="flex items-center text-sm text-gray-500 mb-2">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Depends on {task.dependencies.length} task{task.dependencies.length > 1 ? 's' : ''}
            </div>
          )}

          {/* Description (when expanded) */}
          {isExpanded && task.description && (
            <p className="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded">
              {task.description}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1 ml-2">
          <button
            onClick={handleComplete}
            className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors"
            title="Mark as complete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
          
          <button
            onClick={handleEdit}
            className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors"
            title="Edit task"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-gray-100 text-gray-600 transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg 
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors"
            title="Delete task"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default TaskItem