import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { CalendarProvider } from './contexts/CalendarContext'
import { TaskProvider } from './contexts/TaskContext'
import Layout from './components/Layout/Layout'
import CalendarPage from './pages/CalendarPage'
import { useFocusManagement } from './hooks/useFocusManagement'
import './App.css'

function App() {
  // Initialize focus management (creates skip links)
  useFocusManagement()

  return (
    <CalendarProvider>
      <TaskProvider>
        <div className="App">
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<CalendarPage />} />
              <Route path="calendar" element={<CalendarPage />} />
            </Route>
          </Routes>
        </div>
      </TaskProvider>
    </CalendarProvider>
  )
}

export default App