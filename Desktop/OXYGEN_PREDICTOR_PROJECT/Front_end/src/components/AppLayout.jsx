import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSessionActive, SESSION_EVENT, SESSION_KEY, SESSION_REVOKED_AT_KEY } from '../authSession.js'
import Footer from './Footer.jsx'
import SidebarMenu from './SidebarMenu.jsx'
import TopMenu from './TopMenu.jsx'

export default function AppLayout({ children }) {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 1024
  })

  useEffect(() => {
    function enforceActiveSession() {
      if (!isSessionActive()) {
        navigate('/login', { replace: true })
      }
    }

    function handleStorage(event) {
      if (event.key === SESSION_KEY || event.key === SESSION_REVOKED_AT_KEY) {
        enforceActiveSession()
      }
    }

    enforceActiveSession()
    window.addEventListener(SESSION_EVENT, enforceActiveSession)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(SESSION_EVENT, enforceActiveSession)
      window.removeEventListener('storage', handleStorage)
    }
  }, [navigate])

  useEffect(() => {
    function handleResize() {
      setSidebarOpen(window.innerWidth >= 1024)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function handleNavigate() {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f6f9fd] pb-[57px] pt-[73px] text-slate-900">
      <TopMenu
        isSidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
      />
      <div className="flex h-[calc(100vh-130px)] min-h-0 flex-col overflow-hidden lg:flex-row">
        <SidebarMenu isOpen={sidebarOpen} onNavigate={handleNavigate} />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 md:px-5">
          <div className="mx-auto min-w-0 max-w-[1540px]">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
