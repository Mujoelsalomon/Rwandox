import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { API_BASE_URL, getSession, SESSION_EVENT } from '../authSession.js'

export default function Footer() {
  const [facility, setFacility] = useState(null)

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

  const { t } = useTranslation()

  const fullLocationText = facility ? `${facility.name}, ${facility.district}, ${facility.provinceOrCity}` : t('facilityNotConfigured', 'Facility not configured')
  const shortName = facility?.name ? (facility.name.length > 30 ? `${facility.name.slice(0, 30)}…` : facility.name) : ''
  const shortLocationText = facility ? `${shortName}, ${facility.district}` : t('facilityNotConfigured', 'Facility not configured')

  return (
    <footer className="navbar fixed-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-[#d4e157] bg-gradient-to-r from-[#d9f99d] via-[#bef264] to-[#facc15] px-4 py-2 shadow-[0_-8px_24px_rgba(77,124,15,0.16)] backdrop-blur md:px-5">
      <div className="container-fluid flex min-h-10 flex-col items-center justify-between gap-2 text-center xl:flex-row xl:text-left">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px] font-extrabold text-[#1f3b08] sm:text-[14px] xl:justify-start">
          <span>Developed by Joel Munyaneza</span>
          <span>Tel: +250782112057</span>
          <span className="flex items-center gap-1">
            <span className="hidden sm:inline">{t('footerLocationLabel', 'Location:')}</span>
            <span className="inline-block sm:hidden">{t('footerLocationLabelShort', 'Loc:')}</span>
            <span className="ml-1 max-w-[220px] truncate sm:max-w-none" title={fullLocationText}>{fullLocationText}</span>
            <span className="ml-1 sm:hidden max-w-[160px] truncate" title={fullLocationText}>{shortLocationText}</span>
          </span>
        </div>
        <p className="text-[14px] font-bold text-[#365314] sm:text-[16px]">
          ML-powered risk assessment for postoperative oxygen needs
        </p>
      </div>
    </footer>
  )
}
