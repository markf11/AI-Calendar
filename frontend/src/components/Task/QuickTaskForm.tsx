import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTask } from '../../contexts/TaskContext'
import { Task } from '../../types'
import { v4 as uuidv4 } from 'uuid'
import { addMinutes, format } from 'date-fns'

interface QuickTaskFormProps {
  onClose: () => void
}

interface TaskFormData {
  title: string
  duration: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  deadline?: string
  isHardDeadline: boolean
  isBlocking: boolean
  projectId?: string
  description?: string
}

const QuickTaskForm: React.FC<QuickTaskFormProps> = ({ onClose }) => {
  const { addTask, state } = useTask()
  const { projects, unscheduledTasks } = state
  const [isExpanded, setIsExpanded] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])

  // Smart defaults based on user patterns
  const getSmartDefaults = () => {
    const recentTasks = unscheduledTasks.slice(-5)
    const commonDuration = recentTasks.length > 0 
      ? Math.round(recentTasks.reduce((sum, task) => sum + task.duration, 0) / recentTasks.length / 15) * 15
      : 60
    
    const commonPriority = recentTasks.length > 0
      ? recentTasks.reduce((acc, task) => {
          acc[task.priority] = (acc[task.priority] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      : { medium: 1 }
    
    const mostCommonPriority = Object.entries(commonPriority)
      .sort(([,a], [,b]) => b - a)[0]?.[0] as 'low' | 'medium' | 'high' | 'critical' || 'medium'

    return {
      duration: Math.max(15, Math.min(commonDuration, 120)), // Between 15 min and 2 hours
      priority: mostCommonPriority,
    }
  }

  const smartDefaults = getSmartDefaults()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<TaskFormData>({
    defaultValues: {
      priority: smartDefaults.priority,
      duration: smartDefaults.duration,
      isHardDeadline: false,
      isBlocking: false,
    },
  })

  const watchedTitle = watch('title')
  const watchedDuration = watch('duration')

  const watchedDeadline = watch('deadline')

  // Generate task suggestions based on title input
  useEffect(() => {
    if (watchedTitle && watchedTitle.length > 2) {
      const commonTasks = [
        'Review and respond to emails',
        'Prepare presentation slides',
        'Write project documentation',
        'Schedule team meeting',
        'Update project status',
        'Research competitor analysis',
        'Code review and testing',
        'Client follow-up call',
        'Budget planning session',
        'Design mockup creation'
      ]
      
      const filtered = commonTasks.filter(task => 
        task.toLowerCase().includes(watchedTitle.toLowerCase()) ||
        watchedTitle.toLowerCase().includes(task.split(' ')[0].toLowerCase())
      ).slice(0, 3)
      
      setSuggestions(filtered)
    } else {
      setSuggestions([])
    }
  }, [watchedTitle])

  // Smart duration suggestions based on task type
  const getDurationSuggestions = (title: string) => {
    const keywords = title.toLowerCase()
    if (keywords.includes('email') || keywords.includes('quick') || keywords.includes('check')) {
      return [15, 30, 45]
    }
    if (keywords.includes('meeting') || keywords.includes('call')) {
      return [30, 60, 90]
    }
    if (keywords.includes('write') || keywords.includes('document') || keywords.includes('report')) {
      return [60, 90, 120]
    }
    if (keywords.includes('research') || keywords.includes('analysis')) {
      return [90, 120, 180]
    }
    return [30, 60, 90, 120]
  }

  const durationSuggestions = watchedTitle ? getDurationSuggestions(watchedTitle) : [30, 60, 90, 120]

  const onSubmit = async (data: TaskFormData) => {
    try {
      const newTask: Task = {
        id: uuidv4(),
        userId: 'current-user', // This would come from auth context
        title: data.title,
        description: data.description,
        duration: data.duration,
        priority: data.priority,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        isHardDeadline: data.isHardDeadline,
        isBlocking: data.isBlocking,
        projectId: data.projectId || undefined,
        dependencies: [],
        dependents: [],
        status: 'pending',
        completedMinutes: 0,
        remainingMinutes: data.duration,
        scheduledSlots: [],
        completionHistory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      addTask(newTask)
      reset()
      onClose()
    } catch (error) {
      console.error('Error creating task:', error)
    }
  }

  const handleCancel = () => {
    reset()
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      handleCancel()
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(onSubmit)()
    }
  }

  return (
    <div className="p-4 bg-gray-50" onKeyDown={handleKeyDown}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Add New Task</h3>
        <div className="text-xs text-gray-500">
          <kbd className="px-1 py-0.5 bg-gray-200 rounded">Esc</kbd> to cancel • 
          <kbd className="px-1 py-0.5 bg-gray-200 rounded ml-1">⌘Enter</kbd> to save
        </div>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {/* Title */}
        <div>
          <input
            {...register('title', { required: 'Task title is required' })}
            type="text"
            placeholder="What needs to be done?"
            className="w-full input text-sm"
            autoFocus
          />
          {errors.title && (
            <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>
          )}
          
          {/* Task Suggestions */}
          {suggestions.length > 0 && (
            <div className="mt-2 space-y-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setValue('title', suggestion)}
                  className="block w-full text-left text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Duration and Priority Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Duration
            </label>
            <div className="space-y-2">
              <input
                {...register('duration', { 
                  required: 'Duration is required',
                  min: { value: 5, message: 'Minimum 5 minutes' },
                  max: { value: 480, message: 'Maximum 8 hours' }
                })}
                type="number"
                min="5"
                max="480"
                step="5"
                className="w-full input text-sm"
              />
              
              {/* Duration Quick Buttons */}
              <div className="flex flex-wrap gap-1">
                {durationSuggestions.map(duration => (
                  <button
                    key={duration}
                    type="button"
                    onClick={() => setValue('duration', duration)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      watchedDuration === duration
                        ? 'bg-primary-100 text-primary-700 border border-primary-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {duration}m
                  </button>
                ))}
              </div>
            </div>
            {errors.duration && (
              <p className="text-red-500 text-xs mt-1">{errors.duration.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select {...register('priority')} className="w-full input text-sm">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Based on your recent tasks
            </p>
          </div>
        </div>

        {/* Expand/Collapse Button */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
        >
          <svg 
            className={`w-4 h-4 mr-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {isExpanded ? 'Less options' : 'More options'}
        </button>

        {/* Expanded Options */}
        {isExpanded && (
          <div className="space-y-3 pt-2 border-t border-gray-200">
            {/* Project Selection */}
            {projects.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Project
                </label>
                <select {...register('projectId')} className="w-full input text-sm">
                  <option value="">No project</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Deadline */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Deadline (optional)
              </label>
              <input
                {...register('deadline')}
                type="datetime-local"
                className="w-full input text-sm"
              />
            </div>

            {/* Deadline Type */}
            {watchedDeadline && (
              <div className="flex items-center">
                <input
                  {...register('isHardDeadline')}
                  type="checkbox"
                  id="isHardDeadline"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="isHardDeadline" className="ml-2 text-sm text-gray-700">
                  Hard deadline (must be completed by this time)
                </label>
              </div>
            )}

            {/* Blocking Task */}
            <div className="flex items-center">
              <input
                {...register('isBlocking')}
                type="checkbox"
                id="isBlocking"
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="isBlocking" className="ml-2 text-sm text-gray-700">
                Blocking task (cannot be split into smaller chunks)
              </label>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Additional details about this task..."
                className="w-full input text-sm resize-none"
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-2 pt-2">
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary text-sm"
          >
            {isSubmitting ? 'Adding...' : 'Add Task'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default QuickTaskForm