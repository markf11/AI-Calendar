import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import { Task, Project } from '../../types'
import { useTask } from '../../contexts/TaskContext'
import { format } from 'date-fns'

interface TaskEditModalProps {
  task: Task
  onClose: () => void
  onSave: (task: Task) => void
}

interface TaskFormData {
  title: string
  description?: string
  duration: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  deadline?: string
  isHardDeadline: boolean
  isBlocking: boolean
  projectId?: string
}

const TaskEditModal: React.FC<TaskEditModalProps> = ({ task, onClose, onSave }) => {
  const { state } = useTask()
  const { projects } = state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
  } = useForm<TaskFormData>({
    defaultValues: {
      title: task.title,
      description: task.description || '',
      duration: task.duration,
      priority: task.priority,
      deadline: task.deadline ? format(new Date(task.deadline), "yyyy-MM-dd'T'HH:mm") : '',
      isHardDeadline: task.isHardDeadline,
      isBlocking: task.isBlocking,
      projectId: task.projectId || '',
    },
  })

  const watchedDeadline = watch('deadline')

  // Reset form when task changes
  useEffect(() => {
    reset({
      title: task.title,
      description: task.description || '',
      duration: task.duration,
      priority: task.priority,
      deadline: task.deadline ? format(new Date(task.deadline), "yyyy-MM-dd'T'HH:mm") : '',
      isHardDeadline: task.isHardDeadline,
      isBlocking: task.isBlocking,
      projectId: task.projectId || '',
    })
  }, [task, reset])

  const onSubmit = async (data: TaskFormData) => {
    try {
      const updatedTask: Task = {
        ...task,
        title: data.title,
        description: data.description || undefined,
        duration: data.duration,
        priority: data.priority,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        isHardDeadline: data.isHardDeadline,
        isBlocking: data.isBlocking,
        projectId: data.projectId || undefined,
        remainingMinutes: data.duration - task.completedMinutes,
        updatedAt: new Date(),
      }

      onSave(updatedTask)
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  const handleCancel = () => {
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        onClose()
      }
    } else {
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    return `${mins}m`
  }

  const priorityColors = {
    low: 'bg-green-50 border-green-200 text-green-800',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    high: 'bg-orange-50 border-orange-200 text-orange-800',
    critical: 'bg-red-50 border-red-200 text-red-800',
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={handleCancel}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-lg shadow-xl"
            onKeyDown={handleKeyDown}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Edit Task</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Created {format(new Date(task.createdAt), 'MMM d, yyyy')}
                  {task.completedMinutes > 0 && (
                    <span className="ml-2">
                      • {formatDuration(task.completedMinutes)} completed
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={handleCancel}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Title *
                </label>
                <input
                  {...register('title', { required: 'Task title is required' })}
                  type="text"
                  className="w-full input"
                  placeholder="What needs to be done?"
                />
                {errors.title && (
                  <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  {...register('description')}
                  rows={3}
                  className="w-full input resize-none"
                  placeholder="Additional details about this task..."
                />
              </div>

              {/* Duration and Priority */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration *
                  </label>
                  <div className="relative">
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
                      className="w-full input pr-16"
                    />
                    <span className="absolute right-3 top-2.5 text-sm text-gray-500">
                      minutes
                    </span>
                  </div>
                  {errors.duration && (
                    <p className="text-red-500 text-sm mt-1">{errors.duration.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select {...register('priority')} className="w-full input">
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="critical">Critical Priority</option>
                  </select>
                </div>
              </div>

              {/* Project */}
              {projects.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project
                  </label>
                  <select {...register('projectId')} className="w-full input">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deadline
                </label>
                <input
                  {...register('deadline')}
                  type="datetime-local"
                  className="w-full input"
                />
              </div>

              {/* Deadline Type and Blocking */}
              <div className="space-y-3">
                {watchedDeadline && (
                  <div className="flex items-center">
                    <input
                      {...register('isHardDeadline')}
                      type="checkbox"
                      id="isHardDeadline"
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="isHardDeadline" className="ml-3 text-sm text-gray-700">
                      <span className="font-medium">Hard deadline</span>
                      <span className="text-gray-500 block">Must be completed by this time</span>
                    </label>
                  </div>
                )}

                <div className="flex items-center">
                  <input
                    {...register('isBlocking')}
                    type="checkbox"
                    id="isBlocking"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="isBlocking" className="ml-3 text-sm text-gray-700">
                    <span className="font-medium">Blocking task</span>
                    <span className="text-gray-500 block">Cannot be split into smaller chunks</span>
                  </label>
                </div>
              </div>

              {/* Task Progress */}
              {task.completedMinutes > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Progress</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Completed: {formatDuration(task.completedMinutes)}</span>
                      <span>Remaining: {formatDuration(task.remainingMinutes)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(task.completedMinutes / task.duration) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Dependencies */}
              {(task.dependencies.length > 0 || task.dependents.length > 0) && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Dependencies</h4>
                  {task.dependencies.length > 0 && (
                    <p className="text-sm text-gray-600 mb-1">
                      Depends on {task.dependencies.length} task{task.dependencies.length > 1 ? 's' : ''}
                    </p>
                  )}
                  {task.dependents.length > 0 && (
                    <p className="text-sm text-gray-600">
                      {task.dependents.length} task{task.dependents.length > 1 ? 's' : ''} depend on this
                    </p>
                  )}
                </div>
              )}
            </form>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-600 hover:text-red-700 text-sm font-medium transition-colors"
              >
                Delete Task
              </button>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit(onSubmit)}
                  disabled={isSubmitting}
                  className="btn btn-primary"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 flex items-center justify-center p-4"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowDeleteConfirm(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Task</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete "{task.title}"? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Handle delete - would call deleteTask from context
                    console.log('Delete task:', task.id)
                    setShowDeleteConfirm(false)
                    onClose()
                  }}
                  className="btn bg-red-600 text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  )
}

export default TaskEditModal