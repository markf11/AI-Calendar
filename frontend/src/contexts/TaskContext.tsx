import React, { createContext, useContext, useReducer, useCallback } from 'react'
import { Task, Project } from '../types'

interface TaskState {
  tasks: Task[]
  projects: Project[]
  unscheduledTasks: Task[]
  selectedTaskId: string | null
  isLoading: boolean
  error: string | null
}

type TaskAction =
  | { type: 'SET_TASKS'; payload: Task[] }
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: { id: string; updates: Partial<Task> } }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: { id: string; updates: Partial<Project> } }
  | { type: 'DELETE_PROJECT'; payload: string }
  | { type: 'SELECT_TASK'; payload: string | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }

const initialState: TaskState = {
  tasks: [],
  projects: [],
  unscheduledTasks: [],
  selectedTaskId: null,
  isLoading: false,
  error: null,
}

function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case 'SET_TASKS': {
      const tasks = action.payload
      const unscheduledTasks = tasks.filter(task => 
        task.status === 'pending' || (task.status === 'scheduled' && task.scheduledSlots.length === 0)
      )
      return { ...state, tasks, unscheduledTasks }
    }
    case 'ADD_TASK': {
      const newTask = action.payload
      const tasks = [...state.tasks, newTask]
      const unscheduledTasks = newTask.status === 'pending' || 
        (newTask.status === 'scheduled' && newTask.scheduledSlots.length === 0)
        ? [...state.unscheduledTasks, newTask]
        : state.unscheduledTasks
      return { ...state, tasks, unscheduledTasks }
    }
    case 'UPDATE_TASK': {
      const { id, updates } = action.payload
      const tasks = state.tasks.map(task =>
        task.id === id ? { ...task, ...updates } : task
      )
      const unscheduledTasks = tasks.filter(task => 
        task.status === 'pending' || (task.status === 'scheduled' && task.scheduledSlots.length === 0)
      )
      return { ...state, tasks, unscheduledTasks }
    }
    case 'DELETE_TASK': {
      const tasks = state.tasks.filter(task => task.id !== action.payload)
      const unscheduledTasks = state.unscheduledTasks.filter(task => task.id !== action.payload)
      return { ...state, tasks, unscheduledTasks }
    }
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload }
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] }
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(project =>
          project.id === action.payload.id
            ? { ...project, ...action.payload.updates }
            : project
        ),
      }
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(project => project.id !== action.payload),
      }
    case 'SELECT_TASK':
      return { ...state, selectedTaskId: action.payload }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    default:
      return state
  }
}

interface TaskContextType {
  state: TaskState
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  setProjects: (projects: Project[]) => void
  addProject: (project: Project) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void
  selectTask: (taskId: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  getTasksByProject: (projectId: string) => Task[]
  getProjectById: (projectId: string) => Project | undefined
  focusTaskSidebar: () => void
}

const TaskContext = createContext<TaskContextType | undefined>(undefined)

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(taskReducer, initialState)

  const setTasks = useCallback((tasks: Task[]) => {
    dispatch({ type: 'SET_TASKS', payload: tasks })
  }, [])

  const addTask = useCallback((task: Task) => {
    dispatch({ type: 'ADD_TASK', payload: task })
  }, [])

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    dispatch({ type: 'UPDATE_TASK', payload: { id, updates } })
  }, [])

  const deleteTask = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TASK', payload: id })
  }, [])

  const setProjects = useCallback((projects: Project[]) => {
    dispatch({ type: 'SET_PROJECTS', payload: projects })
  }, [])

  const addProject = useCallback((project: Project) => {
    dispatch({ type: 'ADD_PROJECT', payload: project })
  }, [])

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    dispatch({ type: 'UPDATE_PROJECT', payload: { id, updates } })
  }, [])

  const deleteProject = useCallback((id: string) => {
    dispatch({ type: 'DELETE_PROJECT', payload: id })
  }, [])

  const selectTask = useCallback((taskId: string | null) => {
    dispatch({ type: 'SELECT_TASK', payload: taskId })
  }, [])

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading })
  }, [])

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error })
  }, [])

  const getTasksByProject = useCallback((projectId: string) => {
    return state.tasks.filter(task => task.projectId === projectId)
  }, [state.tasks])

  const getProjectById = useCallback((projectId: string) => {
    return state.projects.find(project => project.id === projectId)
  }, [state.projects])

  const focusTaskSidebar = useCallback(() => {
    const sidebar = document.querySelector('[data-testid="task-sidebar"]') as HTMLElement
    if (sidebar) {
      const firstFocusable = sidebar.querySelector('button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])') as HTMLElement
      if (firstFocusable) {
        firstFocusable.focus()
      }
    }
  }, [])

  const value: TaskContextType = {
    state,
    setTasks,
    addTask,
    updateTask,
    deleteTask,
    setProjects,
    addProject,
    updateProject,
    deleteProject,
    selectTask,
    setLoading,
    setError,
    getTasksByProject,
    getProjectById,
    focusTaskSidebar,
  }

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  )
}

export function useTask() {
  const context = useContext(TaskContext)
  if (context === undefined) {
    throw new Error('useTask must be used within a TaskProvider')
  }
  return context
}