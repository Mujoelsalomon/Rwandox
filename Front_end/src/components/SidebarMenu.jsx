import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { canAccessTraining, getSession, isAdminSession, SESSION_EVENT } from '../authSession.js'

const sidebarItems = [
  { labelKey: 'dashboard', to: '/dashboard', icon: 'grid' },
  { labelKey: 'newPrediction', to: '/new-prediction', icon: 'plus' },
  { labelKey: 'predictionHistory', to: '/prediction-history', icon: 'history' },
  { labelKey: 'modelTraining', to: '/train', icon: 'barChart', trainingOnly: true },
  { labelKey: 'systemAdministration', to: '/system-administration', icon: 'shield', adminOnly: true },
  { labelKey: 'settings', to: '/settings', icon: 'settings' },
]

export default function SidebarMenu({ isOpen, onNavigate, widthStyle }) {
  const { t } = useTranslation()
  const location = useLocation()
  const [session, setSession] = useState(() => getSession())

  useEffect(() => {
    function handleSessionChange() {
      setSession(getSession())
    }

    window.addEventListener(SESSION_EVENT, handleSessionChange)
    return () => window.removeEventListener(SESSION_EVENT, handleSessionChange)
  }, [])

  const visibleSidebarItems = sidebarItems.filter((item) => {
    if (item.adminOnly) return isAdminSession(session)
    if (item.trainingOnly) return canAccessTraining(session)
    return true
  })

  return (
    <aside
      style={isOpen ? widthStyle : { '--sidebar-width': '92px' }}
      className={`sidebar sidebar-scrollbar sidebar-scrollbar-visible nav flex-column shrink-0 transition-all duration-300 ${
        isOpen
          ? 'fixed bottom-[57px] left-0 right-0 top-[88px] z-40 w-full overflow-y-scroll bg-gradient-to-b from-[#06295e] to-[#001b42] p-3 shadow-[0_18px_38px_rgba(4,23,58,0.22)] sm:p-4 lg:static lg:h-full lg:w-[var(--sidebar-width)] lg:overflow-y-scroll lg:p-3'
          : 'hidden w-full overflow-y-scroll bg-gradient-to-b from-[#06295e] to-[#001b42] p-0 shadow-[0_18px_38px_rgba(4,23,58,0.22)] lg:block lg:h-full lg:w-[var(--sidebar-width)] lg:overflow-y-scroll lg:p-3'
      }`}
    >
      <div className="flex min-h-full flex-col">
        <nav className="grid grid-cols-2 gap-2 pr-1 sm:grid-cols-3 lg:flex lg:flex-none lg:flex-col lg:space-y-2">
          {visibleSidebarItems.map((item) => (
            item.to ? (
              <Link
                key={item.labelKey}
                to={item.to}
                title={t(item.labelKey)}
                onClick={onNavigate}
                className={`nav-link body-text flex h-12 items-center rounded-[8px] px-3 font-semibold transition sm:h-14 lg:h-[60px] lg:px-4 ${
                  isOpen ? 'gap-3 lg:gap-5' : 'justify-center gap-0'
                } ${
                  location.pathname === item.to
                    ? 'bg-[#1265dc] text-white shadow-[0_10px_24px_rgba(18,101,220,0.35)]'
                    : 'text-white hover:bg-[#0f60d7]'
                }`}
              >
                <Icon name={item.icon} className="h-6 w-6 shrink-0 lg:h-7 lg:w-7" />
                <span className={`truncate ${isOpen ? 'block' : 'lg:hidden'}`}>{t(item.labelKey)}</span>
              </Link>
            ) : (
              <div
                key={item.labelKey}
                title={t(item.labelKey)}
                onClick={onNavigate}
                className={`body-text flex h-12 min-w-0 cursor-pointer items-center rounded-[8px] px-3 font-semibold transition sm:h-14 lg:h-[60px] lg:px-4 ${
                  isOpen ? 'gap-3 lg:gap-5' : 'justify-center gap-0'
                } ${
                  'text-white hover:bg-[#0d3c78]'
                }`}
              >
                <Icon name={item.icon} className="h-6 w-6 shrink-0 lg:h-7 lg:w-7" />
                <span className={`min-w-0 truncate ${isOpen ? 'block' : 'lg:hidden'}`}>{t(item.labelKey)}</span>
              </div>
            )
          ))}
        </nav>
      </div>
    </aside>
  )
}

function Icon({ name, className = '' }) {
  const common = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    viewBox: '0 0 24 24',
  }

  const paths = {
    grid: (
      <>
        <rect x="4" y="4" width="6" height="6" />
        <rect x="14" y="4" width="6" height="6" />
        <rect x="4" y="14" width="6" height="6" />
        <rect x="14" y="14" width="6" height="6" />
      </>
    ),
    plus: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
      </>
    ),
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 5v6h6" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    barChart: (
      <>
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M22 20V8" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
      </>
    ),
    chevronRight: <path d="m9 18 6-6-6-6" />,
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
  }

  return <svg {...common}>{paths[name]}</svg>
}
