import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSelector from './LanguageSelector.jsx'
import { logoutFromAllDevices, API_BASE_URL, getSession, isAdminSession, updateSession } from '../authSession.js'
import FACILITIES from '../data/rwandaFacilities.js'

const defaultPreferences = {
  'High-risk patient alerts': true,
  'Prediction completion alerts': true,
  'System update alerts': false,
}

const defaultThresholds = {
  lowMax: 39,
  highMin: 70,
}

const notificationItems = [
  {
    label: 'High-risk patient alerts',
    detail: 'Notify the account when a generated prediction identifies a high-risk patient.',
  },
  {
    label: 'Prediction completion alerts',
    detail: 'Notify the account when upload or form-based prediction has completed.',
  },
  {
    label: 'System update alerts',
    detail: 'Notify the account about application updates, maintenance, and service notices.',
  },
]

function notify(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('app-notification', { detail: { message, type } }))
}

function recorded(value) {
  return value === undefined || value === null || value === '' ? 'Not recorded' : value
}

function recordedList(value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Not recorded'
  return recorded(value)
}

function formatSessionDate(value) {
  const date = new Date(value || '')
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString()
}

export default function SettingsContent() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [enabled, setEnabled] = useState(defaultPreferences)
  const [thresholds, setThresholds] = useState(defaultThresholds)
  const [selectedRisk, setSelectedRisk] = useState('amber')
  const [currentFacility, setCurrentFacility] = useState(null)
  const [facilityChooserOpen, setFacilityChooserOpen] = useState(false)
  const [facilitySearch, setFacilitySearch] = useState('')
  const [selectedFacilityId, setSelectedFacilityId] = useState(null)
  const [savingFacilityId, setSavingFacilityId] = useState('')
  const session = getSession()
  const isAdmin = isAdminSession(session)
  const personalInformation = [
    { label: 'Full name', value: recorded(session?.name || session?.full_name || session?.username) },
    { label: 'Email', value: recorded(session?.email) },
    { label: 'User ID', value: recorded(session?.user_id || session?.id || session?.username) },
  ]
  const roleInformation = [
    { label: 'Current role', value: recorded(session?.role) },
    { label: 'Access level', value: recorded(session?.access_level) },
    { label: 'Admin permissions', value: recordedList(session?.permissions) },
    { label: 'Workspace', value: 'A Machine Learning Model for Predicting Postoperative Oxygen Requirement Among Surgical Patients in Rwanda' },
  ]
  const loginSecurity = [
    { label: 'Change password', value: 'Update the password used to access this account.', action: true },
    { label: 'Two-factor authentication', value: recorded(session?.two_factor_status) },
    { label: 'Last login date', value: formatSessionDate(session?.last_login || session?.loggedInAt) },
    { label: 'Login activity', value: recorded(session?.login_activity || 'Current browser session') },
    { label: 'Logout from all devices', value: 'End active sessions on other devices.', action: true, danger: true },
  ]

  useEffect(() => {
    loadSelectedFacility()
  }, [])

  async function loadSelectedFacility() {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/settings/facility/`, { credentials: 'include' })
      const data = await resp.json().catch(() => ({}))
      if (resp.ok) {
        setCurrentFacility(data.facility || null)
        setSelectedFacilityId(data.facility?.id || null)
      }
    } catch (err) {
      // ignore
    }
  }

  function authHeaders() {
    const s = getSession()
    return {
      Accept: 'application/json',
      Authorization: `Bearer ${s?.token || ''}`,
      'X-User-Email': s?.email || '',
      'X-User-Username': s?.username || '',
    }
  }

  function filteredFacilities() {
    const q = String(facilitySearch || '').trim().toLowerCase()
    if (!q) return FACILITIES
    return FACILITIES.filter((facility) => {
      return [facility.name, facility.district, facility.facilityType, facility.provinceOrCity].join(' ').toLowerCase().includes(q)
    })
  }

  async function chooseFacility(facilityId) {
    if (!isAdmin || !facilityId) return
    setSelectedFacilityId(facilityId)
    setSavingFacilityId(facilityId)
    try {
      const resp = await fetch(`${API_BASE_URL}/api/settings/facility/`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ facility_id: facilityId }),
      })
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(data.error || 'Failed to save facility setting')
      setCurrentFacility(data.facility || null)
      setSelectedFacilityId(data.facility?.id || facilityId)
      setFacilityChooserOpen(false)
      try { updateSession({ selectedFacility: data.facility }) } catch (_) {}
      notify('Facility setting saved successfully.', 'success')
    } catch (err) {
      notify(err.message || 'Failed to save facility setting.', 'error')
    } finally {
      setSavingFacilityId('')
    }
  }

  function toggle(label) {
    setEnabled((current) => ({ ...current, [label]: !current[label] }))
  }

  function discardChanges() {
    setEnabled(defaultPreferences)
    setThresholds(defaultThresholds)
    setSelectedRisk('amber')
    notify('Settings changes were discarded.', 'warning')
  }

  function saveChanges() {
    notify('Settings changes saved.', 'success')
  }

  function handleSecurityAction(label) {
    if (label === 'Logout from all devices') {
      logoutFromAllDevices()
      notify('Logged out from all devices. Sign in again to continue.', 'warning')
      navigate('/login', { replace: true })
      return
    }

    notify(`${label} selected.`, 'info')
  }

  function updateLowMax(value) {
    const next = clampThreshold(value, 5, thresholds.highMin - 2)
    setThresholds((current) => ({ ...current, lowMax: next }))
  }

  function updateHighMin(value) {
    const next = clampThreshold(value, thresholds.lowMax + 2, 95)
    setThresholds((current) => ({ ...current, highMin: next }))
  }

  function updateModerateMax(value) {
    const next = clampThreshold(value, thresholds.lowMax + 1, 94)
    setThresholds((current) => ({ ...current, highMin: next + 1 }))
  }

  function selectRisk(tone) {
    setSelectedRisk(tone)
    notify(`${riskLabel(tone)} threshold selected.`, 'info')
  }

  return (
    <div className="settings-content-18 container-fluid min-w-0 px-0">
      <section className="card border-0 shadow-sm rounded-4 mb-3 rounded-[16px] border border-[#e2eaf5] bg-white px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="small-text text-primary fw-bold text-uppercase mb-2 font-black tracking-[0.22em]">{t('accountSettings')}</p>
            <h1 className="page-title fw-black break-words font-black text-[#071b49]">
              {t('accountSettingsTitle')}
            </h1>
            <p className="body-text text-secondary mt-2 max-w-[760px]">
              {t('accountSettingsIntro')}
            </p>
          </div>
          <LanguageSelector />
        </div>
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-2">
        <AccountPanel title={t('personalInformation')}>
          {personalInformation.map((item) => (
            <ReadOnlyField key={item.label} {...item} />
          ))}
        </AccountPanel>

        <AccountPanel title={t('role')}>
          {roleInformation.map((item) => (
            <ReadOnlyField key={item.label} {...item} />
          ))}
        </AccountPanel>

        <AccountPanel title="Facility">
          <FacilityField
            currentFacility={currentFacility}
            isAdmin={isAdmin}
            isOpen={facilityChooserOpen}
            onToggle={() => setFacilityChooserOpen((open) => !open)}
          />
          {isAdmin && facilityChooserOpen && (
            <div className="rounded-[12px] border border-[#d9e5f3] bg-[#f8fbff] p-3">
              <input
                type="search"
                value={facilitySearch}
                onChange={(event) => setFacilitySearch(event.target.value)}
                placeholder="Search facilities by name, district, facility type..."
                className="form-control mb-3 w-full rounded-[8px] border border-[#c9d8eb] px-3 py-2"
              />
              <div className="max-h-52 overflow-auto rounded-[8px] border border-[#d9e5f3] bg-white p-2">
                {filteredFacilities().map((facility) => {
                  const isSelected = selectedFacilityId === facility.id
                  const isSaving = savingFacilityId === facility.id
                  return (
                    <button
                      key={facility.id}
                      type="button"
                      disabled={Boolean(savingFacilityId)}
                      onClick={() => chooseFacility(facility.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-[8px] px-3 py-2 text-left transition disabled:opacity-70 ${isSelected ? 'bg-white ring-2 ring-offset-1 ring-[#1768f2]' : 'hover:bg-[#f8fbff]'}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-extrabold text-[#071b49]">{facility.name}</span>
                        <span className="block text-[13px] text-[#53668a]">{facility.facilityType} - {facility.district}, {facility.provinceOrCity}</span>
                      </span>
                      <span className="shrink-0 text-[13px] font-black text-[#53668a]">{isSaving ? 'Saving...' : isSelected ? 'Selected' : 'Select'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </AccountPanel>
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <AccountPanel title={t('loginSecurity')}>
          {loginSecurity.map((item) => (
            <SecurityField key={item.label} onAction={handleSecurityAction} {...item} />
          ))}
        </AccountPanel>

        <AccountPanel title={t('notificationPreferences')}>
          <div className="grid gap-3">
            {notificationItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => toggle(item.label)}
                className="flex w-full min-w-0 items-center justify-between gap-4 rounded-[12px] border border-[#d9e5f3] bg-[#f8fbff] px-4 py-4 text-left transition hover:border-[#b8cce6] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#1768f2]"
              >
                <span className="min-w-0">
                  <span className="block break-words text-[16px] font-extrabold text-[#071b49]">{item.label}</span>
                  <span className="mt-1 block break-words text-[14px] leading-5 text-[#53668a]">{item.detail}</span>
                </span>
                <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled[item.label] ? 'bg-[#1768f2]' : 'bg-[#cbd5e1]'}`}>
                  <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${enabled[item.label] ? 'left-6' : 'left-1'}`} />
                </span>
              </button>
            ))}
          </div>
        </AccountPanel>
      </section>

      <section className="card border-0 shadow-sm rounded-4 mb-3 min-w-0 rounded-[16px] border border-[#e2eaf5] bg-white px-5 py-5 md:px-6">
        <h2 className="section-title h4 fw-bold font-black text-[#071b49]">{t('riskThresholds')}</h2>
        <p className="small-text text-secondary mt-1 font-semibold">
          {t('riskThresholdsIntro')}
        </p>
        <ThresholdGraph selectedRisk={selectedRisk} thresholds={thresholds} />
        <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-3">
          <ThresholdCard
            isSelected={selectedRisk === 'green'}
            label="Low risk maximum"
            onSelect={() => selectRisk('green')}
            rangeText={`0-${thresholds.lowMax}%`}
            tone="green"
            value={thresholds.lowMax}
            min={5}
            max={thresholds.highMin - 2}
            onChange={updateLowMax}
            compactLabel="Max"
          />
          <ThresholdCard
            isSelected={selectedRisk === 'amber'}
            label="Moderate risk"
            onSelect={() => selectRisk('amber')}
            rangeText={`${thresholds.lowMax + 1}-${thresholds.highMin - 1}%`}
            tone="amber"
            value={thresholds.highMin - 1}
            min={thresholds.lowMax + 1}
            max={94}
            onChange={updateModerateMax}
            compactLabel="End"
          />
          <ThresholdCard
            isSelected={selectedRisk === 'red'}
            label="High risk starts at"
            onSelect={() => selectRisk('red')}
            rangeText={`${thresholds.highMin}-100%`}
            tone="red"
            value={thresholds.highMin}
            min={thresholds.lowMax + 2}
            max={95}
            onChange={updateHighMin}
            compactLabel="Start"
          />
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-3 flex flex-col gap-3 border-t border-[#d9e5f3] bg-[#eef5fb]/95 px-3 py-4 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-0">
        <button
          type="button"
          onClick={discardChanges}
          className="btn-text btn btn-dark fw-bold min-h-12 w-full rounded-full px-6 py-3 text-center font-extrabold text-white sm:w-auto sm:min-w-[180px]"
        >
          {t('discardChanges')}
        </button>
        <button
          type="button"
          onClick={saveChanges}
          className="btn-text btn btn-success fw-bold min-h-12 w-full rounded-full px-6 py-3 text-center font-extrabold text-white sm:w-auto sm:min-w-[170px]"
        >
          {t('saveChanges')}
        </button>
      </div>
    </div>
  )
}

function AccountPanel({ children, title }) {
  return (
    <div className="card border-0 shadow-sm rounded-4 mb-3 min-w-0 rounded-[16px] border border-[#e2eaf5] bg-white px-5 py-5 md:px-6">
      <h2 className="section-title h4 fw-bold font-black text-[#071b49]">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </div>
  )
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="card bg-light border-0 rounded-4 min-w-0 rounded-[12px] border border-[#d9e5f3] px-4 py-3">
      <p className="small-text card-text text-secondary font-bold">{label}</p>
      <p className="small-text mt-1 break-words font-extrabold text-[#071b49]">{value}</p>
    </div>
  )
}

function FacilityField({ currentFacility, isAdmin, isOpen, onToggle }) {
  const value = currentFacility ? `${currentFacility.name}, ${currentFacility.district}` : 'Not configured'

  if (!isAdmin) return <ReadOnlyField label="Current facility" value={value} />

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={onToggle}
      className="card bg-light btn border-0 rounded-4 flex min-w-0 items-center justify-between gap-3 rounded-[12px] border border-[#d9e5f3] px-4 py-3 text-left transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#1768f2]"
    >
      <span className="min-w-0">
        <span className="small-text card-text block text-secondary font-bold">Current facility</span>
        <span className="small-text mt-1 block break-words font-extrabold text-[#071b49]">{value}</span>
      </span>
      <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[12px] font-black text-[#1768f2] shadow-sm">
        {isOpen ? 'Close' : 'Change'}
      </span>
    </button>
  )
}

function SecurityField({ action = false, danger = false, label, onAction, value }) {
  if (!action) return <ReadOnlyField label={label} value={value} />

  return (
    <button
      type="button"
      onClick={() => onAction(label)}
      className={`card btn min-w-0 rounded-[12px] border px-4 py-3 text-left transition hover:bg-white focus:outline-none focus:ring-2 ${
        danger
          ? 'border-[#fecaca] bg-[#fff5f5] hover:border-[#ef4444] focus:ring-[#ef4444]'
          : 'border-[#d9e5f3] bg-[#f8fbff] hover:border-[#b8cce6] focus:ring-[#1768f2]'
      }`}
    >
      <p className={`small-text font-bold ${danger ? 'text-[#b91c1c]' : 'text-[#6c7f9f]'}`}>{label}</p>
      <p className="small-text mt-1 break-words font-extrabold text-[#071b49]">{value}</p>
    </button>
  )
}

function ThresholdGraph({ selectedRisk, thresholds }) {
  const lowWidth = thresholds.lowMax + 1
  const moderateWidth = thresholds.highMin - thresholds.lowMax - 1
  const highWidth = 100 - thresholds.highMin

  return (
    <div className="card bg-light rounded-4 mt-5 rounded-[14px] border border-[#d9e5f3] px-4 py-4">
      <div className="mb-3 flex min-w-0 items-center gap-0">
        <RiskLegend isSelected={selectedRisk === 'green'} label={`Low 0-${thresholds.lowMax}%`} tone="green" width={lowWidth} />
        <RiskLegend isSelected={selectedRisk === 'amber'} label={`Moderate ${thresholds.lowMax + 1}-${thresholds.highMin - 1}%`} tone="amber" width={moderateWidth} />
        <RiskLegend isSelected={selectedRisk === 'red'} label={`High ${thresholds.highMin}-100%`} tone="red" width={highWidth} />
      </div>
      <div className="flex h-8 min-w-0 overflow-hidden rounded-full border border-white shadow-inner">
        <div className="bg-[#22c55e]" style={{ width: `${lowWidth}%` }} title="Low risk" />
        <div className="bg-[#facc15]" style={{ width: `${moderateWidth}%` }} title="Moderate risk" />
        <div className="bg-[#ef4444]" style={{ width: `${highWidth}%` }} title="High risk" />
      </div>
      <div className="relative mt-2 h-6 text-[12px] font-black text-[#64799e]">
        <span className="absolute left-0">0%</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${lowWidth}%` }}>{thresholds.lowMax}%</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${thresholds.highMin}%` }}>{thresholds.highMin}%</span>
        <span className="absolute right-0">100%</span>
      </div>
    </div>
  )
}

function RiskLegend({ isSelected, label, tone, width }) {
  return (
    <span className="flex min-w-0 justify-center px-1" style={{ width: `${width}%` }}>
      <span className={`risk-badge-text inline-flex max-w-full items-center gap-2 rounded-full px-3 py-2 text-center font-extrabold ${
        isSelected ? `${riskSoftClass(tone)} ring-2 ring-offset-1 ${riskRingClass(tone)}` : 'bg-white text-[#53668a]'
      }`}>
        <span className={`h-3 w-3 shrink-0 rounded-full ${dotClass(tone)}`} />
        <span className="min-w-0 truncate">{label}</span>
      </span>
    </span>
  )
}

function ThresholdCard({ isSelected = false, label, rangeText, tone, value, min, max, onChange, onSelect, compactLabel }) {
  const isEditable = typeof onChange === 'function'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect?.()
      }}
      className={`card min-w-0 cursor-pointer rounded-[12px] border px-4 py-4 transition hover:bg-white focus:outline-none focus:ring-2 ${riskBorderClass(tone)} ${
        isSelected ? `${riskSoftClass(tone)} ${riskRingClass(tone)} ring-2 ring-offset-1` : 'bg-[#f8fbff]'
      }`}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="body-text break-words font-extrabold text-[#071b49]">{label}</p>
          <p className="small-text mt-1 font-semibold text-[#53668a]">{rangeText}</p>
        </div>

        {isEditable ? (
          <label className="flex w-full min-w-0 items-center gap-2 sm:w-auto" aria-label={`${label} percentage`}>
            <span className="shrink-0 text-[12px] font-black uppercase text-[#64799e]">{compactLabel}</span>
            <input
              type="number"
              min={min}
              max={max}
              value={value}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onChange(event.target.value)}
              className="form-control h-10 w-full min-w-0 rounded-[10px] border border-[#c9d8eb] bg-white px-3 text-center text-[15px] font-extrabold text-[#071b49] outline-none transition focus:border-[#1768f2] focus:ring-2 focus:ring-[#b8d3ff] sm:w-[78px]"
            />
            <span className="shrink-0 text-[15px] font-black text-[#53668a]">%</span>
          </label>
        ) : (
          <span className={`h-3 w-3 shrink-0 rounded-full ${dotClass(tone)}`} />
        )}
      </div>

      {isEditable && (
        <div className="mt-3 flex items-center gap-3">
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onChange(event.target.value)}
            className={`min-w-0 flex-1 ${rangeAccentClass(tone)}`}
            aria-label={`${label} slider`}
          />
          <span className={`h-3 w-3 shrink-0 rounded-full ${dotClass(tone)}`} />
        </div>
      )}
    </div>
  )
}

function clampThreshold(value, min, max) {
  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) return min
  return Math.min(max, Math.max(min, Math.round(numericValue)))
}

function dotClass(tone) {
  if (tone === 'red') return 'bg-[#ef4444]'
  if (tone === 'amber') return 'bg-[#f59e0b]'
  return 'bg-[#22c55e]'
}

function riskLabel(tone) {
  if (tone === 'red') return 'High risk'
  if (tone === 'amber') return 'Moderate risk'
  return 'Low risk'
}

function riskBorderClass(tone) {
  if (tone === 'red') return 'border-[#fecaca] hover:border-[#ef4444] focus:ring-[#ef4444]'
  if (tone === 'amber') return 'border-[#fde68a] hover:border-[#f59e0b] focus:ring-[#f59e0b]'
  return 'border-[#bbf7d0] hover:border-[#22c55e] focus:ring-[#22c55e]'
}

function riskSoftClass(tone) {
  if (tone === 'red') return 'bg-[#fff1f2] !text-[#991b1b]'
  if (tone === 'amber') return 'bg-[#fffbeb] !text-[#7c2d12]'
  return 'bg-[#f0fdf4] !text-[#14532d]'
}

function riskRingClass(tone) {
  if (tone === 'red') return 'ring-[#ef4444]'
  if (tone === 'amber') return 'ring-[#f59e0b]'
  return 'ring-[#22c55e]'
}

function rangeAccentClass(tone) {
  if (tone === 'red') return 'accent-[#ef4444]'
  if (tone === 'amber') return 'accent-[#f59e0b]'
  return 'accent-[#22c55e]'
}
