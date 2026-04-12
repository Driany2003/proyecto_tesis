import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-slate-900/30 transition-opacity duration-300 md:hidden ${
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setSidebarOpen(false)}
      />
      <Sidebar
        variant="desktop"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <Sidebar
        variant="mobile"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen((o) => !o)}
        />
        <main className="flex-1 overflow-auto">
          <div className="px-6 pt-8 pb-6 sm:px-8 sm:pt-10 lg:px-10 lg:pt-10 page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
