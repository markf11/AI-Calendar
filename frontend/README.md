# Momentum Calendar Frontend

This is the React frontend for the Momentum Calendar application, implementing the core calendar interface as specified in task 10.1.

## Features Implemented

### Core Calendar Interface (Task 10.1)

✅ **Responsive Calendar Component with Multiple Views**
- Day View: Detailed single-day view with hourly time slots
- Week View: 7-day view with visual time grid (default view)
- Month View: Monthly overview with event/task indicators

✅ **Visual Differentiation Between Event Types**
- Firm Events: Solid colors with thick left border (from external calendars)
- Flexible Events: Lighter colors with dashed border (AI-scheduled)
- Task Slots: Color-coded by priority with visual blocking indicators

✅ **Smooth Transition Animations**
- Framer Motion integration for view transitions
- Smooth calendar updates during rescheduling
- Loading states and error handling with animations

✅ **Component Tests**
- Calendar component tests
- WeekView component tests  
- CalendarEvent component tests
- Test setup with Vitest and React Testing Library

## Architecture

### Component Structure
```
src/
├── components/
│   ├── Calendar/
│   │   ├── Calendar.tsx          # Main calendar container
│   │   ├── WeekView.tsx          # Week view implementation
│   │   ├── DayView.tsx           # Day view implementation
│   │   ├── MonthView.tsx         # Month view implementation
│   │   ├── CalendarEvent.tsx     # Event display component
│   │   └── TimeGrid.tsx          # Time grid overlay
│   ├── Layout/
│   │   ├── Layout.tsx            # Main layout wrapper
│   │   └── Header.tsx            # Navigation header
│   └── Task/
│       ├── TaskSidebar.tsx       # Persistent task sidebar
│       ├── TaskItem.tsx          # Individual task display
│       └── QuickTaskForm.tsx     # Quick task creation
├── contexts/
│   ├── CalendarContext.tsx       # Calendar state management
│   └── TaskContext.tsx           # Task state management
├── pages/
│   └── CalendarPage.tsx          # Main calendar page
└── types/
    └── index.ts                  # TypeScript type definitions
```

### Key Features

1. **Multi-View Calendar**
   - Keyboard shortcuts (1/2/3 for view switching)
   - Navigation controls (prev/next/today)
   - Responsive design for different screen sizes

2. **Visual Event Differentiation**
   - Firm events: Solid colors, cannot be moved by AI
   - Flexible events: Dashed borders, AI-schedulable
   - Priority-based task coloring
   - Source indicators (Google, Microsoft, Momentum)

3. **Interactive Features**
   - Event selection and highlighting
   - Date selection and navigation
   - Drag-and-drop ready structure
   - Keyboard accessibility

4. **Real-time Updates**
   - Context-based state management
   - Smooth animations for schedule changes
   - Loading states and error handling

## Technology Stack

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **React Query** for data fetching
- **React Router** for navigation
- **React Hook Form** for form handling
- **Date-fns** for date manipulation
- **Vitest** for testing

## Requirements Satisfied

This implementation satisfies the following requirements from the design document:

- **8.1**: Multi-day view as central focus ✅
- **8.5**: Calm color palette and uncluttered design ✅  
- **1.5**: Visual differentiation between firm and flexible events ✅
- **4.3**: Real-time visual feedback for schedule updates ✅

## Next Steps

The calendar interface is ready for integration with:
- Backend API services
- WebSocket connections for real-time updates
- Drag-and-drop functionality
- Task scheduling integration
- User authentication

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```