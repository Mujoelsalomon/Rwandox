import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { clearCurrentSession, getSession, SESSION_EVENT } from '../authSession.js'
import LanguageSelector from './LanguageSelector.jsx'
import postopO2Logo from '../assets/postop-o2-ai-logo.svg'

export default function TopMenu({ isSidebarOpen, onToggleSidebar }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false)
  const [notificationBellRinging, setNotificationBellRinging] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [session, setSession] = useState(() => getSession())
  const profileMenuRef = useRef(null)
  const notificationMenuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false)
      }
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(event.target)) {
        setNotificationMenuOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false)
        setNotificationMenuOpen(false)
      }
    }

    function handleAppNotification(event) {
      const message = event.detail?.message || t('notifications')
      const type = event.detail?.type || 'info'
      setNotifications((items) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          message,
          type,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        ...items,
      ])
      setNotificationMenuOpen(true)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('app-notification', handleAppNotification)
    window.addEventListener(SESSION_EVENT, handleSessionChange)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('app-notification', handleAppNotification)
      window.removeEventListener(SESSION_EVENT, handleSessionChange)
    }
  }, [t])

  function handleSessionChange() {
    setSession(getSession())
  }

  function handleLogout() {
    clearCurrentSession()
    setProfileMenuOpen(false)
    navigate('/login')
  }

  function handleViewProfile() {
    setProfileMenuOpen(false)
    navigate('/profile')
  }

  function handleAccountSettings() {
    setProfileMenuOpen(false)
    navigate('/settings')
  }

  return (
    <header className="navbar navbar-expand !fixed left-0 right-0 !top-0 z-50 flex h-[88px] items-center border-b border-[#84cc16] bg-gradient-to-r from-[#ccff00] via-[#a3ff12] to-[#39ff14] px-4 py-0 shadow-[0_8px_28px_rgba(57,255,20,0.18)] backdrop-blur md:px-6">
      <div className="container-fluid grid h-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-0 md:gap-5">
        <div className="flex items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-white shadow-sm ring-1 ring-white/70 md:h-14 md:w-14">
            <img
              src={postopO2Logo}
              alt="A Machine Learning Model for Predicting Postoperative Oxygen Requirement Among Surgical Patients in Rwanda"
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        <div className="flex min-w-0 justify-center px-1 text-center sm:px-3">
          <span className="block max-w-[980px] text-[15px] font-black leading-tight text-[#225000] sm:text-[18px] lg:text-[22px] xl:text-[24px]">
            {t('appName')}
          </span>
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-3 md:gap-5">
          <button
            type="button"
            aria-label={isSidebarOpen ? t('collapseSidebar') : t('expandSidebar')}
            aria-expanded={isSidebarOpen}
            onClick={onToggleSidebar}
            className="btn btn-light flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f2f6fc] text-[#172a53] transition hover:bg-[#e7eef8]"
          >
            <Icon name="menu" className="h-6 w-6" />
          </button>
          <div className="hidden lg:block">
            <LanguageSelector compact />
          </div>
          <div ref={notificationMenuRef} className="relative">
            <button
              type="button"
              aria-label={t('notifications')}
              aria-expanded={notificationMenuOpen}
              aria-haspopup="menu"
              onClick={() => {
                setNotificationBellRinging(true)
                window.setTimeout(() => setNotificationBellRinging(false), 650)
                setNotificationMenuOpen((open) => !open)
              }}
              className="btn btn-light position-relative flex h-10 w-10 items-center justify-center rounded-full text-[#172a53] transition hover:bg-[#f2f6fc]"
            >
              <Icon
                name="bell"
                className={`h-6 w-6 ${notificationBellRinging ? 'animate-[bell-ring_0.65s_ease-in-out]' : ''}`}
              />
              {notifications.length > 0 && (
                <span className="risk-badge-text absolute right-0.5 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1768f2] px-1 font-bold text-white sm:right-1">
                  {notifications.length}
                </span>
              )}
            </button>

            {notificationMenuOpen && (
              <div
                role="menu"
                className="dropdown-menu show fixed left-2 right-2 top-[96px] max-h-[calc(100vh-112px)] overflow-y-auto rounded-[14px] border border-[#e2eaf5] bg-white py-2 shadow-[0_18px_42px_rgba(13,28,61,0.16)] sm:left-auto sm:right-24 sm:w-[360px] md:absolute md:left-auto md:right-0 md:top-[58px]"
              >
                <div className="flex items-center justify-between border-b border-[#edf2f8] px-4 pb-2">
                  <p className="small-text font-extrabold text-[#14234a]">{t('notifications')}</p>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setNotifications([])}
                      className="small-text font-bold text-[#1768f2] hover:text-[#0f4eb2]"
                    >
                      {t('clear')}
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <p className="small-text px-4 py-5 text-[#526383]">{t('noNotifications')}</p>
                ) : (
                  <div className="py-1">
                    {notifications.map((item) => (
                      <div key={item.id} className="flex gap-3 px-4 py-3 hover:bg-[#f6f9fd]">
                        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${getNotificationDotClass(item.type)}`} />
                        <div className="min-w-0">
                          <p className="small-text break-words font-bold text-[#14234a]">{item.message}</p>
                          <p className="small-text mt-0.5 text-[#526383]">{item.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div ref={profileMenuRef} className="relative flex h-full items-center overflow-visible">
            <button
              type="button"
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              onClick={() => setProfileMenuOpen((open) => !open)}
              className="btn btn-link text-decoration-none !flex h-16 min-w-0 items-center gap-2 overflow-visible rounded-2xl px-1 py-1 leading-none transition hover:bg-[#f6f9fd] md:gap-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#eef3fa] to-[#cdd8e8] p-2 ring-2 ring-white shadow-sm md:h-11 md:w-11">
                <Icon name="user" className="h-full w-full text-[#24334f]" />
              </div>
            </button>

            {profileMenuOpen && (
              <div
                role="menu"
                className="dropdown-menu show fixed left-2 right-2 top-[96px] max-h-[calc(100vh-112px)] overflow-y-auto rounded-[14px] border border-[#e2eaf5] bg-white py-1 shadow-[0_18px_42px_rgba(13,28,61,0.16)] sm:left-4 sm:right-4 md:absolute md:left-auto md:right-0 md:top-[58px] md:w-[260px]"
              >
                <div className="border-b border-[#edf2f8] px-4 py-3">
                  <p className="small-text truncate font-extrabold text-[#0d1c3d]">{session?.name || 'Anesthetist'}</p>
                  <p className="small-text mt-0.5 truncate text-[#526383]">{session?.role || 'Clinician'}</p>
                </div>
                <div className="px-4 py-3 lg:hidden">
                  <LanguageSelector />
                </div>
                <MenuAction icon="user" title={t('viewProfile')} onClick={handleViewProfile} />
                <MenuAction icon="settings" title={t('accountSettings')} bordered onClick={handleAccountSettings} />
                <MenuAction icon="logout" title={t('logout')} bordered onClick={handleLogout} />
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes bell-ring {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(18deg); }
          30% { transform: rotate(-16deg); }
          45% { transform: rotate(12deg); }
          60% { transform: rotate(-8deg); }
          75% { transform: rotate(4deg); }
        }
      `}</style>
    </header>
  )
}

function MenuAction({ icon, title, detail, bordered = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`dropdown-item flex min-h-[54px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#f6f9fd] focus:bg-[#f6f9fd] focus:outline-none ${bordered ? 'border-t border-[#edf2f8]' : ''}`}
    >
      <Icon name={icon} className="h-5 w-5 shrink-0 text-[#172a53]" />
      <div className="min-w-0">
        <p className="small-text break-words font-extrabold text-[#14234a] sm:truncate">{title}</p>
        {detail && <p className="small-text mt-0.5 break-words text-[#526383] sm:truncate">{detail}</p>}
      </div>
    </button>
  )
}

function getNotificationDotClass(type) {
  if (type === 'error') return 'bg-[#ef4444]'
  if (type === 'success') return 'bg-[#22c55e]'
  if (type === 'warning') return 'bg-[#facc15]'
  return 'bg-[#1768f2]'
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
    menu: (
      <>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </>
    ),
    chevronDown: <path d="m6 9 6 6 6-6" />,
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="7" ry="3" />
        <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
        <path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
      </>
    ),
    sync: (
      <>
        <path d="M3 12a9 9 0 0 1 15-6.7" />
        <path d="M18 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-15 6.7" />
        <path d="M6 21v-5h5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </>
    ),
  }

  return <svg {...common}>{paths[name]}</svg>
}
