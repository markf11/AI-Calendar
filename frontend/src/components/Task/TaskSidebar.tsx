import React, { useState, useCallback, useEffect } from 'react'
import { useTask } from '../../contexts/TaskContext'
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd'
import TaskItem from './TaskItem'
import QuickTaskForm from './QuickTaskForm'
import TaskEditModal from './TaskEditModal'
import { motion, AnimatePresence } from 'framer-motion'
import { Task } from '../../types'

const TaskSidebar: React.FC = () => {
  const { state, updateTask } = useTask()
  const { unscheduledTasks, projects, isLoading } = state
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showQuickForm, setShowQuickForm] = useState(false)
  const [filterProject, setFilterProject] = useState<string>('all')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Filter tasks by project and search query
  const filteredTasks = unscheduledTasks.filter(task => {
    // Project filter
    const projectMatch = filterProject === 'all' || 
      (filterProject === 'none' && !task.projectId) ||
      task.projectId === filterProject

    // Search filter
    const searchMatch = !searchQuery || 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase())

    return projectMatch && searchMatch
  })

  // Group tasks by priority
  const tasksByPriority = {
    critical: filteredTasks.filter(task => task.priority === 'critical'),
    high: filteredTasks.filter(task => task.priority === 'high'),
    medium: filteredTasks.filter(task => task.priority === 'medium'),
    low: filteredTasks.filter(task => task.priority === 'low'),
  }

  // Listen for keyboard shortcut events
  useEffect(() => {
    const handleOpenQuickTaskForm = () => setShowQuickForm(true)
    
    document.addEventListener('openQuickTaskForm', handleOpenQuickTaskForm)
    return () => document.removeEventListener('openQuickTaskForm', handleOpenQuickTaskForm)
  }, [])

  const handleDragEnd = useCallback((result: DropResult) => {
    const { destination, source, draggableId } = result

    // If dropped outside a droppable area
    if (!destination) return

    // If dropped in the same position
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return
    }

    // Handle drag to calendar (would be implemented when calendar supports drops)
    if (destination.droppableId === 'calendar') {
      // This would trigger scheduling the task at a specific time
      console.log('Task dropped on calendar:', draggableId)
      return
    }

    // Handle reordering within priority groups
    // For now, we'll just log the action as the backend would handle priority changes
    console.log('Task reordered:', {
      taskId: draggableId,
      from: source,
      to: destination
    })
  }, [])

  if (isCollapsed) {
    return (
      <aside 
        className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-4"
        aria-label="Collapsed task sidebar"
        data-testid="task-sidebar"
      >
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          aria-label="Expand task sidebar"
          aria-expanded="false"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div className="mt-4 text-xs text-gray-500 transform -rotate-90 whitespace-nowrap" aria-hidden="true">
          Tasks ({unscheduledTasks.length})
        </div>
      </aside>
    )
  }

  return (
    <aside 
      className="w-80 bg-white border-r border-gray-200 flex flex-col"
      aria-label="Task sidebar"
      data-testid="task-sidebar"
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 id="task-sidebar-title" className="text-lg font-semibold text-gray-900">Unscheduled Tasks</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500" aria-label={`${unscheduledTasks.length} unscheduled tasks`}>
              {unscheduledTasks.length}
            </span>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 rounded hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              aria-label="Collapse sidebar"
              aria-expanded="true"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Quick Add Button */}
        <button
          onClick={() => setShowQuickForm(true)}
          className="w-full btn btn-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          aria-describedby="task-sidebar-title"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Task
        </button>

        {/* Search */}
        <div className="mt-3">
          <label htmlFor="task-search" className="sr-only">Search tasks</label>
          <div className="relative">
            <input
              id="task-search"
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 pl-8 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              data-testid="task-search"
              aria-label="Search tasks"
            />
            <svg 
              className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Project Filter */}
        <div className="mt-3">
          <label htmlFor="project-filter" className="sr-only">Filter by project</label>
          <select
            id="project-filter"
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            aria-label="Filter tasks by project"
          >
            <option value="all">All Projects</option>
            <option value="none">No Project</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Task Form */}
      <AnimatePresence>
        {showQuickForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-gray-200 overflow-hidden"
          >
            <QuickTaskForm onClose={() => setShowQuickForm(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task List */}
      <div className="flex-1 overflow-auto" role="region" aria-labelledby="task-sidebar-title">
        {isLoading ? (
          <div className="p-4 text-center" role="status" aria-live="polite">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" aria-hidden="true"></div>
            <p className="text-sm text-gray-500 mt-2">Loading tasks...</p>
          </div>
        ) : unscheduledTasks.length === 0 ? (
          <div className="p-4 text-center text-gray-500" role="status">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">No unscheduled tasks</p>
            <p className="text-xs mt-1">All your tasks are scheduled!</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="p-2">
              {/* Critical Priority Tasks */}
              {tasksByPriority.critical.length > 0 && (
                <TaskPrioritySection
                  title="Critical"
                  tasks={tasksByPriority.critical}
                  color="red"
                  droppableId="critical"
                  onEditTask={setEditingTask}
                />
              )}

              {/* High Priority Tasks */}
              {tasksByPriority.high.length > 0 && (
                <TaskPrioritySection
                  title="High Priority"
                  tasks={tasksByPriority.high}
                  color="orange"
                  droppableId="high"
                  onEditTask={setEditingTask}
                />
              )}

              {/* Medium Priority Tasks */}
              {tasksByPriority.medium.length > 0 && (
                <TaskPrioritySection
                  title="Medium Priority"
                  tasks={tasksByPriority.medium}
                  color="yellow"
                  droppableId="medium"
                  onEditTask={setEditingTask}
                />
              )}

              {/* Low Priority Tasks */}
              {tasksByPriority.low.length > 0 && (
                <TaskPrioritySection
                  title="Low Priority"
                  tasks={tasksByPriority.low}
                  color="green"
                  droppableId="low"
                  onEditTask={setEditingTask}
                />
              )}
            </div>
          </DragDropContext>
        )}
      </div>

      {/* Task Edit Modal */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={(updatedTask) => {
            updateTask(updatedTask.id, updatedTask)
            setEditingTask(null)
          }}
        />
      )}
    </aside>
  )
}

interface TaskPrioritySectionProps {
  title: string
  tasks: Task[]
  color: 'red' | 'orange' | 'yellow' | 'green'
  droppableId: string
  onEditTask: (task: Task) => void
}

const TaskPrioritySection: React.FC<TaskPrioritySectionProps> = ({ 
  title, 
  tasks, 
  color, 
  droppableId,
  onEditTask
}) => {
  const colorClasses: Record<string, string> = {
    red: 'text-red-600 border-red-200',
    orange: 'text-orange-600 border-orange-200',
    yellow: 'text-yellow-600 border-yellow-200',
    green: 'text-green-600 border-green-200',
  }

  const sectionId = `priority-section-${droppableId}`

  return (
    <div className="mb-4" role="group" aria-labelledby={sectionId}>
      <h3 id={sectionId} className={`text-sm font-medium mb-2 pb-1 border-b ${colorClasses[color]}`}>
        {title} ({tasks.length})
      </h3>
      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`space-y-2 min-h-2 ${
              snapshot.isDraggingOver ? 'bg-gray-50 rounded-lg p-2' : ''
            }`}
            role="list"
            aria-label={`${title} tasks`}
          >
            {tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={snapshot.isDragging ? 'transform rotate-2' : ''}
                    role="listitem"
                  >
                    <TaskItem 
                      task={task} 
                      onEdit={() => onEditTask(task)}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}

export default TaskSidebar