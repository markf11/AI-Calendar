import '@testing-library/jest-dom'
import React from 'react'
import { vi } from 'vitest'

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => React.createElement('div', props, children),
  },
  AnimatePresence: ({ children }: any) => children,
}))

// Mock react-beautiful-dnd
vi.mock('react-beautiful-dnd', () => ({
  DragDropContext: ({ children }: any) => children,
  Droppable: ({ children }: any) => children({ innerRef: vi.fn(), droppableProps: {}, placeholder: null }, {}),
  Draggable: ({ children }: any) => children({ innerRef: vi.fn(), draggableProps: {}, dragHandleProps: {} }, {}),
}))

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn((date, formatStr) => {
    if (formatStr === 'EEEE, MMMM d, yyyy') return 'Monday, January 1, 2024'
    if (formatStr === 'MMMM yyyy') return 'January 2024'
    if (formatStr === 'EEE') return 'Mon'
    if (formatStr === 'd') return '1'
    if (formatStr === 'HH:mm') return '09:00'
    return '2024-01-01'
  }),
  isToday: vi.fn(() => false),
  isSameDay: vi.fn(() => false),
  isSameMonth: vi.fn(() => true),
  startOfWeek: vi.fn(() => new Date('2024-01-01')),
  endOfWeek: vi.fn(() => new Date('2024-01-07')),
  startOfMonth: vi.fn(() => new Date('2024-01-01')),
  endOfMonth: vi.fn(() => new Date('2024-01-31')),
  eachDayOfInterval: vi.fn(() => [
    new Date('2024-01-01'),
    new Date('2024-01-02'),
    new Date('2024-01-03'),
    new Date('2024-01-04'),
    new Date('2024-01-05'),
    new Date('2024-01-06'),
    new Date('2024-01-07'),
  ]),
}))

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock window.confirm
global.confirm = vi.fn(() => true)