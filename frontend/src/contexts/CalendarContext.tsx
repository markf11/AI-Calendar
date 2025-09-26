import React, { createContext, useContext, useReducer, useCallback } from 'react'
import { CalendarView, CalendarViewState, CalendarEvent } from '../types'

interface CalendarState extends CalendarViewState {
  events: CalendarEvent[]
  isLoading: boolean
  error: string | null
  selectedEventId: string | null
}

type CalendarAction =
  | { type: 'SET_VIEW'; payload: CalendarView }
  | { type: 'SET_CURRENT_DATE'; payload: Date }
  | { type: 'SET_SELECTED_DATE'; payload: Date | undefined }
  | { type: 'SET_EVENTS'; payload: CalendarEvent[] }
  | { type: 'ADD_EVENT'; payload: CalendarEvent }
  | { type: 'UPDATE_EVENT'; payload: { id: string; updates: Partial<CalendarEvent> } }
  | { type: 'DELETE_EVENT'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SELECT_EVENT'; payload: string | null }

const initialState: CalendarState = {
  view: 'week',
  currentDate: new Date(),
  selectedDate: undefined,
  events: [],
  isLoading: false,
  error: null,
  selectedEventId: null,
}

function calendarReducer(state: CalendarState, action: CalendarAction): CalendarState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, view: action.payload }
    case 'SET_CURRENT_DATE':
      return { ...state, currentDate: action.payload }
    case 'SET_SELECTED_DATE':
      return { ...state, selectedDate: action.payload }
    case 'SET_EVENTS':
      return { ...state, events: action.payload }
    case 'ADD_EVENT':
      return { ...state, events: [...state.events, action.payload] }
    case 'UPDATE_EVENT':
      return {
        ...state,
        events: state.events.map(event =>
          event.id === action.payload.id
            ? { ...event, ...action.payload.updates }
            : event
        ),
      }
    case 'DELETE_EVENT':
      return {
        ...state,
        events: state.events.filter(event => event.id !== action.payload),
      }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'SELECT_EVENT':
      return { ...state, selectedEventId: action.payload }
    default:
      return state
  }
}

interface CalendarContextType {
  state: CalendarState
  setView: (view: CalendarView) => void
  setCurrentDate: (date: Date) => void
  setSelectedDate: (date: Date | undefined) => void
  navigateDate: (direction: 'prev' | 'next') => void
  goToToday: () => void
  selectEvent: (eventId: string | null) => void
  addEvent: (event: CalendarEvent) => void
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void
  deleteEvent: (id: string) => void
  setEvents: (events: CalendarEvent[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined)

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(calendarReducer, initialState)

  const setView = useCallback((view: CalendarView) => {
    dispatch({ type: 'SET_VIEW', payload: view })
  }, [])

  const setCurrentDate = useCallback((date: Date) => {
    dispatch({ type: 'SET_CURRENT_DATE', payload: date })
  }, [])

  const setSelectedDate = useCallback((date: Date | undefined) => {
    dispatch({ type: 'SET_SELECTED_DATE', payload: date })
  }, [])

  const navigateDate = useCallback((direction: 'prev' | 'next') => {
    const { view, currentDate } = state
    const newDate = new Date(currentDate)
    
    switch (view) {
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
        break
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
        break
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
        break
    }
    
    dispatch({ type: 'SET_CURRENT_DATE', payload: newDate })
  }, [state.view, state.currentDate])

  const goToToday = useCallback(() => {
    dispatch({ type: 'SET_CURRENT_DATE', payload: new Date() })
  }, [])

  const selectEvent = useCallback((eventId: string | null) => {
    dispatch({ type: 'SELECT_EVENT', payload: eventId })
  }, [])

  const addEvent = useCallback((event: CalendarEvent) => {
    dispatch({ type: 'ADD_EVENT', payload: event })
  }, [])

  const updateEvent = useCallback((id: string, updates: Partial<CalendarEvent>) => {
    dispatch({ type: 'UPDATE_EVENT', payload: { id, updates } })
  }, [])

  const deleteEvent = useCallback((id: string) => {
    dispatch({ type: 'DELETE_EVENT', payload: id })
  }, [])

  const setEvents = useCallback((events: CalendarEvent[]) => {
    dispatch({ type: 'SET_EVENTS', payload: events })
  }, [])

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading })
  }, [])

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error })
  }, [])

  const value: CalendarContextType = {
    state,
    setView,
    setCurrentDate,
    setSelectedDate,
    navigateDate,
    goToToday,
    selectEvent,
    addEvent,
    updateEvent,
    deleteEvent,
    setEvents,
    setLoading,
    setError,
  }

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  )
}

export function useCalendar() {
  const context = useContext(CalendarContext)
  if (context === undefined) {
    throw new Error('useCalendar must be used within a CalendarProvider')
  }
  return context
}