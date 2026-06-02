import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSessionActive, SESSION_EVENT, SESSION_KEY, SESSION_REVOKED_AT_KEY } from '../authSession.js'
import Footer from './Footer.jsx'
import SidebarMenu from './SidebarMenu.jsx'
import TopMenu from './TopMenu.jsx'
import { useResizableSidebar } from './useResizableSidebar.js'

export default function AppLayout({ children }) {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 1024
  })
  const {
    maxSidebarWidth,
    minSidebarWidth,
    onSidebarResizeKeyDown,
    onSidebarResizeStart,
    sidebarWidth,
    sidebarWidthStyle,
  } = useResizableSidebar(setSidebarOpen)

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
    <div className="container-fluid flex h-screen flex-col overflow-hidden bg-[#f6f9fd] pb-[72px] pt-[88px] text-slate-900 px-0">
      <TopMenu
        isSidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <SidebarMenu isOpen={sidebarOpen} onNavigate={handleNavigate} widthStyle={sidebarWidthStyle} />
        <div
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          aria-valuemax={maxSidebarWidth}
          aria-valuemin={minSidebarWidth}
          aria-valuenow={sidebarWidth}
          className="sidebar-resize-handle hidden lg:block"
          onKeyDown={onSidebarResizeKeyDown}
          onPointerDown={onSidebarResizeStart}
          role="separator"
          tabIndex={0}
          title="Drag to resize sidebar"
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-8 pt-4 md:px-5">
          <div className="container-fluid mx-auto min-w-0 max-w-[1540px] px-0">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
