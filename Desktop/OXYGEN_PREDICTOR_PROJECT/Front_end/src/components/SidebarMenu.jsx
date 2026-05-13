import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const sidebarItems = [
  { label: 'Dashboard', to: '/', icon: 'grid' },
  { label: 'New Prediction', to: '/new-prediction', icon: 'plus' },
  { label: 'Patient Records', to: '/patients', icon: 'user' },
  { label: 'Prediction History', to: '/prediction-history', icon: 'history' },
  { label: 'System Administration', to: '/system-administration', icon: 'shield' },
  { label: 'Settings', to: '/settings', icon: 'settings' },
]

export default function SidebarMenu({ isOpen, onNavigate }) {
  const location = useLocation()
  const [profileOpen, setProfileOpen] = useState(false)

  function toggleProfile() {
    setProfileOpen((s) => !s)
  }

  return (
    <aside
      className={`shrink-0 transition-all duration-300 ${
        isOpen
          ? 'fixed bottom-[57px] left-0 right-0 top-[73px] z-40 w-full overflow-y-auto bg-gradient-to-b from-[#06295e] to-[#001b42] p-3 shadow-[0_18px_38px_rgba(4,23,58,0.22)] sm:p-4 lg:static lg:h-full lg:w-[292px] lg:overflow-hidden lg:p-3'
          : 'hidden w-full bg-gradient-to-b from-[#06295e] to-[#001b42] p-0 shadow-[0_18px_38px_rgba(4,23,58,0.22)] lg:block lg:h-full lg:w-[92px] lg:overflow-hidden lg:p-3'
      }`}
    >
      <div className="flex h-full min-h-0 flex-col">
        <nav className="grid min-h-0 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:flex lg:flex-1 lg:flex-col lg:space-y-2 lg:overflow-y-auto">
          {sidebarItems.map((item) => (
            item.to ? (
              <Link
                key={item.label}
                to={item.to}
                title={item.label}
                onClick={onNavigate}
                className={`flex h-12 items-center rounded-[8px] px-3 text-[20px] font-semibold transition sm:h-14 lg:h-[60px] lg:px-4 ${
                  isOpen ? 'gap-3 lg:gap-5' : 'justify-center gap-0'
                } ${
                  location.pathname === item.to
                    ? 'bg-[#1265dc] text-white shadow-[0_10px_24px_rgba(18,101,220,0.35)]'
                    : 'text-white hover:bg-[#0f60d7]'
                }`}
              >
                <Icon name={item.icon} className="h-6 w-6 shrink-0 lg:h-7 lg:w-7" />
                <span className={`truncate ${isOpen ? 'block' : 'lg:hidden'}`}>{item.label}</span>
              </Link>
            ) : (
              <div
                key={item.label}
                title={item.label}
                onClick={onNavigate}
                className={`flex h-12 min-w-0 cursor-pointer items-center rounded-[8px] px-3 text-[20px] font-semibold transition sm:h-14 lg:h-[60px] lg:px-4 ${
                  isOpen ? 'gap-3 lg:gap-5' : 'justify-center gap-0'
                } ${
                  'text-white hover:bg-[#0d3c78]'
                }`}
              >
                <Icon name={item.icon} className="h-6 w-6 shrink-0 lg:h-7 lg:w-7" />
                <span className={`min-w-0 truncate ${isOpen ? 'block' : 'lg:hidden'}`}>{item.label}</span>
              </div>
            )
          ))}
        </nav>

        <div className={`mt-3 shrink-0 rounded-[8px] bg-[#0c438c] p-0 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] ${isOpen ? 'lg:block' : 'lg:hidden'}`}>
          <button
            type="button"
            aria-expanded={profileOpen}
            onClick={toggleProfile}
            className="w-full p-3 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-full bg-[#dbe6f5]">
                <div className="flex h-full w-full items-end justify-center bg-gradient-to-b from-[#eef3fa] to-[#cdd8e8]">
                  <div className="mb-1 h-8 w-8 rounded-full bg-[#24334f]" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[20px] font-extrabold">Anesthetist</p>
                <p className="text-[20px] text-[#d7e8ff]">Clinician</p>
              </div>
              <Icon name={profileOpen ? 'chevronRight' : 'chevronRight'} className="h-5 w-5" />
            </div>
          </button>

          {profileOpen && (
            <div className="border-t border-white/10 bg-[#083a85] p-3">
              <Link to="/settings" onClick={onNavigate} className="block py-2 text-sm text-white hover:underline">
                Account settings
              </Link>
              <button
                type="button"
                onClick={() => {
                  window.localStorage.removeItem('postop_o2_session')
                  window.location.href = '/login'
                }}
                className="mt-2 w-full rounded bg-[#155fbf] px-3 py-2 text-left text-sm font-semibold text-white"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
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
  }

  return <svg {...common}>{paths[name]}</svg>
}
