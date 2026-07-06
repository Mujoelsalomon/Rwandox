import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { API_BASE_URL, getSession, SESSION_EVENT } from '../authSession.js'

const HELP_ICON_POSITION_KEY = 'postop-o2-help-icon-position'
const HELP_ICON_SIZE = 44
const FOOTER_CLEARANCE = 78

export default function Footer() {
  const [facility, setFacility] = useState(null)
  const [helpPosition, setHelpPosition] = useState(() => loadHelpIconPosition() || defaultHelpIconPosition())
  const [aboutOpen, setAboutOpen] = useState(false)
  const dragRef = useRef(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const s = getSession() || {}
        const resp = await fetch(`${API_BASE_URL}/api/settings/facility/`, {
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${s.token || ''}`,
            'X-User-Email': s.email || '',
            'X-User-Username': s.username || '',
          },
        })
        const data = await resp.json().catch(() => ({}))
        if (!mounted) return
        setFacility(data.facility || null)
      } catch (err) {
        // ignore and keep fallback
      }
    }

    load()

    function onSessionChange() {
      load()
    }
    window.addEventListener(SESSION_EVENT, onSessionChange)
    return () => {
      mounted = false
      window.removeEventListener(SESSION_EVENT, onSessionChange)
    }
  }, [])

  useEffect(() => {
    function keepHelpIconInView() {
      setHelpPosition((position) => {
        const nextPosition = clampHelpIconPosition(position || defaultHelpIconPosition())
        saveHelpIconPosition(nextPosition)
        return nextPosition
      })
    }

    window.addEventListener('resize', keepHelpIconInView)
    return () => window.removeEventListener('resize', keepHelpIconInView)
  }, [])

  const { t } = useTranslation()

  const fullLocationText = facility ? `${facility.name}, ${facility.district}, ${facility.provinceOrCity}` : t('facilityNotConfigured', 'Facility not configured')
  const shortName = facility?.name ? (facility.name.length > 30 ? `${facility.name.slice(0, 30)}…` : facility.name) : ''
  const shortLocationText = facility ? `${shortName}, ${facility.district}` : t('facilityNotConfigured', 'Facility not configured')

  function startHelpIconDrag(event) {
    if (event.button !== undefined && event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function dragHelpIcon(event) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) drag.moved = true

    const nextPosition = clampHelpIconPosition({
      left: drag.left + deltaX,
      top: drag.top + deltaY,
    })
    setHelpPosition(nextPosition)
    saveHelpIconPosition(nextPosition)
  }

  function stopHelpIconDrag(event) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    suppressClickRef.current = drag.moved
    dragRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  function handleHelpIconClick(event) {
    if (!suppressClickRef.current) return
    event.preventDefault()
    suppressClickRef.current = false
  }

  const helpIconStyle = {
    alignItems: 'center',
    background: '#0b63ce',
    border: '2px solid rgba(255,255,255,0.9)',
    borderRadius: '9999px',
    boxShadow: '0 10px 24px rgba(11,99,206,0.35)',
    color: '#ffffff',
    display: 'flex',
    height: `${HELP_ICON_SIZE}px`,
    justifyContent: 'center',
    left: `${helpPosition.left}px`,
    position: 'fixed',
    top: `${helpPosition.top}px`,
    touchAction: 'none',
    userSelect: 'none',
    width: `${HELP_ICON_SIZE}px`,
    zIndex: 2147483647,
  }

  return (
    <>
      <Link
        to="/support"
        aria-label={t('supportPortal')}
        title={t('supportPortal')}
        className={`transition hover:bg-[#084da3] hover:text-white focus:outline-none focus:ring-4 focus:ring-[#93c5fd] ${dragRef.current ? 'cursor-grabbing' : 'cursor-grab'}`}
        draggable="false"
        onClick={handleHelpIconClick}
        onPointerCancel={stopHelpIconDrag}
        onPointerDown={startHelpIconDrag}
        onPointerMove={dragHelpIcon}
        onPointerUp={stopHelpIconDrag}
        style={helpIconStyle}
      >
        <HelpIcon className="h-6 w-6" />
      </Link>
      <footer className="navbar fixed-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-[#d4e157] bg-gradient-to-r from-[#d9f99d] via-[#bef264] to-[#facc15] px-4 py-2 shadow-[0_-8px_24px_rgba(77,124,15,0.16)] backdrop-blur md:px-5">
        <div className="container-fluid grid min-h-10 grid-cols-[auto_1fr] items-center gap-3 text-center">
          <div className="justify-self-start">
            <button
              type="button"
              aria-expanded={aboutOpen}
              aria-label="About us"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/80 bg-[#1f3b08] px-4 text-white shadow-[0_8px_20px_rgba(31,59,8,0.22)] transition hover:bg-[#365314] focus:outline-none focus:ring-4 focus:ring-[#86efac]"
              onClick={() => setAboutOpen((open) => !open)}
              title="About us"
            >
              <AboutIcon className="h-6 w-6" />
              <span className="text-[14px] font-black sm:text-[15px]">About us</span>
            </button>
          </div>
          <p className="justify-self-end text-[15px] font-bold text-[#365314] sm:text-[17px]">
            ML-powered risk assessment for postoperative oxygen needs
          </p>
        </div>
      </footer>
      {aboutOpen && (
        <div
          className="fixed inset-0 z-[2147483646] flex items-end justify-center bg-black/20 px-4 pb-20"
          onClick={() => setAboutOpen(false)}
          role="presentation"
        >
          <section
            aria-label="About us"
            className="w-full max-w-[720px] rounded-[14px] border border-[#bbf7d0] bg-white p-5 text-left shadow-[0_20px_60px_rgba(15,23,42,0.25)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] font-black uppercase tracking-[0.12em] text-[#166534]">About us</p>
                <h2 className="mt-1 text-[20px] font-black text-[#071b49]">Project information</h2>
              </div>
              <button
                type="button"
                aria-label="Close about us"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d9e5f3] bg-[#f8fbff] text-[#071b49]"
                onClick={() => setAboutOpen(false)}
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <InfoTile label="Developed by" value="Joel Munyaneza" />
              <InfoTile label="Telephone" value="+250782112057" />
              <InfoTile label={t('footerLocationLabel', 'Location:').replace(':', '')} value={fullLocationText} />
            </div>
            <p className="mt-4 rounded-[10px] bg-[#f0fdf4] px-4 py-3 text-[14px] font-bold leading-6 text-[#365314]">
              ML-powered risk assessment for postoperative oxygen needs
            </p>
          </section>
        </div>
      )}
    </>
  )
}

function loadHelpIconPosition() {
  if (typeof window === 'undefined') return null
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HELP_ICON_POSITION_KEY) || 'null')
    if (!parsed || typeof parsed !== 'object') return null
    return clampHelpIconPosition(parsed)
  } catch {
    return null
  }
}

function defaultHelpIconPosition() {
  if (typeof window === 'undefined') return { left: 8, top: 8 }
  return clampHelpIconPosition({
    left: (window.innerWidth - HELP_ICON_SIZE) / 2,
    top: window.innerHeight - FOOTER_CLEARANCE - HELP_ICON_SIZE,
  })
}

function saveHelpIconPosition(position) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(HELP_ICON_POSITION_KEY, JSON.stringify(position))
}

function clampHelpIconPosition(position) {
  if (typeof window === 'undefined') return position
  const margin = 8
  const maxLeft = Math.max(margin, window.innerWidth - HELP_ICON_SIZE - margin)
  const maxTop = Math.max(margin, window.innerHeight - HELP_ICON_SIZE - margin)
  return {
    left: Math.min(maxLeft, Math.max(margin, Number(position.left) || margin)),
    top: Math.min(maxTop, Math.max(margin, Number(position.top) || margin)),
  }
}

function HelpIcon({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.4"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.3 2.3 0 0 1 4.4 1c0 1.5-1.1 2.1-1.8 2.7-.5.4-.7.8-.7 1.3" />
      <path d="M12 17h.01" />
    </svg>
  )
}

function AboutIcon({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.3"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <path d="M12 7h.01" />
    </svg>
  )
}

function CloseIcon({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.3"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-[10px] border border-[#d9e5f3] bg-[#f8fbff] px-4 py-3">
      <p className="text-[12px] font-black uppercase tracking-[0.08em] text-[#64799e]">{label}</p>
      <p className="mt-1 break-words text-[15px] font-extrabold text-[#071b49]">{value}</p>
    </div>
  )
}
