import React from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import TaskSidebar from '../Task/TaskSidebar'

const Layout: React.FC = () => {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Task Sidebar - Persistent */}
      <TaskSidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header />
        
        {/* Main Content */}
        <main className="flex-1 overflow-hidden" id="main-content" role="main" aria-label="Calendar and task management">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout