import React, { useState } from 'react'

const preferenceItems = [
  { label: 'Topbar notifications', detail: 'Show clinical and model alerts in the notification bell.' },
  { label: 'High-risk sound cue', detail: 'Play a short cue when a high-risk prediction is created.' },
  { label: 'Auto-refresh dashboard', detail: 'Refresh patient summaries and model metrics during active sessions.' },
]

const defaultPreferences = {
  'Topbar notifications': true,
  'High-risk sound cue': true,
  'Auto-refresh dashboard': false,
}

const defaultThresholds = {
  lowMax: 39,
  highMin: 70,
}

const defaultUsers = [
  { id: 'USR-001', name: 'Joel Munyaneza', email: 'munyanezajoel3@gmail.com', role: 'Super user' },
  { id: 'USR-002', name: 'Anesthetist', email: 'anesthetist@hospital.local', role: 'Clinician' },
  { id: 'USR-003', name: 'Nurse Supervisor', email: 'nurse.supervisor@hospital.local', role: 'Reviewer' },
  { id: 'USR-004', name: 'Model Admin', email: 'model.admin@hospital.local', role: 'Administrator' },
]

const roleOptions = ['Super user', 'Administrator', 'Clinician', 'Reviewer', 'Viewer']

function notify(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('app-notification', { detail: { message, type } }))
}

export default function SettingsContent() {
  const [enabled, setEnabled] = useState(defaultPreferences)
  const [thresholds, setThresholds] = useState(defaultThresholds)
  const [activeAdminPanel, setActiveAdminPanel] = useState(null)
  const [users, setUsers] = useState(defaultUsers)
  const [editingUserId, setEditingUserId] = useState(null)

  function toggle(label) {
    setEnabled((current) => ({ ...current, [label]: !current[label] }))
  }

  function discardChanges() {
    setEnabled(defaultPreferences)
    setThresholds(defaultThresholds)
    notify('Settings changes were discarded.', 'warning')
  }

  function saveChanges() {
    notify('Settings changes saved.', 'success')
  }

  function updateLowMax(value) {
    const next = clampThreshold(value, 5, thresholds.highMin - 2)
    setThresholds((current) => ({ ...current, lowMax: next }))
  }

  function updateHighMin(value) {
    const next = clampThreshold(value, thresholds.lowMax + 2, 95)
    setThresholds((current) => ({ ...current, highMin: next }))
  }

  function openAdminPanel(title) {
    if (title === 'User access') {
      setActiveAdminPanel((current) => (current === 'users' ? null : 'users'))
      return
    }

    notify(`${title} administration opened.`, 'info')
  }

  function updateUserRole(userId, role) {
    setUsers((current) => current.map((user) => (user.id === userId ? { ...user, role } : user)))
    setEditingUserId(null)
    notify('User role updated.', 'success')
  }

  return (
    <div className="min-w-0 space-y-5">
      <section className="rounded-[16px] border border-[#e2eaf5] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.07)] md:px-6">
        <p className="text-[13px] font-black uppercase tracking-[0.22em] text-[#1768f2]">System settings</p>
        <div className="mt-2">
          <div className="min-w-0">
            <h1 className="break-words text-[30px] font-black leading-[34px] text-[#071b49]">
              Clinical workspace settings
            </h1>
            <p className="mt-2 max-w-[760px] text-[16px] leading-7 text-[#53668a]">
              Configure notification behavior, risk thresholds, model preferences, and account details for the oxygen prediction workflow.
            </p>
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
        <div className="min-w-0 rounded-[16px] border border-[#e2eaf5] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.07)] md:px-6">
          <h2 className="text-[22px] font-black text-[#071b49]">Notification preferences</h2>
          <div className="mt-4 space-y-3">
            {preferenceItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => toggle(item.label)}
                className="flex w-full min-w-0 items-center justify-between gap-4 rounded-[12px] border border-[#d9e5f3] bg-[#f8fbff] px-4 py-4 text-left transition hover:border-[#b8cce6]"
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
        </div>

        <div className="min-w-0 rounded-[16px] border border-[#e2eaf5] bg-white px-4 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.07)] sm:px-5 md:px-6">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="break-words text-[22px] font-black text-[#071b49]">Risk thresholds</h2>
              <p className="mt-1 text-[14px] font-semibold leading-5 text-[#64799e]">
                Adjust probability bands used across prediction views.
              </p>
            </div>
          </div>

          <div className="mt-4 grid min-w-0 gap-3">
            <ThresholdCard
              label="Low risk maximum"
              rangeText={`0-${thresholds.lowMax}%`}
              tone="green"
              value={thresholds.lowMax}
              min={5}
              max={thresholds.highMin - 2}
              onChange={updateLowMax}
              compactLabel="Max"
            />
            <ThresholdCard
              label="Moderate risk"
              rangeText={`${thresholds.lowMax + 1}-${thresholds.highMin - 1}%`}
              tone="amber"
            />
            <ThresholdCard
              label="High risk starts at"
              rangeText={`${thresholds.highMin}-100%`}
              tone="red"
              value={thresholds.highMin}
              min={thresholds.lowMax + 2}
              max={95}
              onChange={updateHighMin}
              compactLabel="Start"
            />
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-5 lg:grid-cols-2">
        <SettingsPanel title="Model defaults">
          <Field label="Default model" value="XGBoost postoperative oxygen model" />
          <Field label="Validation metric" value="AUC with calibration review" />
          <Field label="Decision support mode" value="Clinical review required before action" />
        </SettingsPanel>

        <SettingsPanel title="Account and hospital">
          <Field label="Role" value="Anesthetist - Clinician" />
          <Field label="Facility" value="Kibagabaga Level Two Teaching Hospital" />
          <Field label="Workspace" value="Post-op Oxygen Requirement Prediction" />
        </SettingsPanel>
      </section>

      <section className="min-w-0 rounded-[16px] border border-[#e2eaf5] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.07)] md:px-6">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-black uppercase tracking-[0.22em] text-[#1768f2]">System administration</p>
            <h2 className="mt-2 break-words text-[24px] font-black leading-8 text-[#071b49]">
              Administrative controls
            </h2>
            <p className="mt-2 max-w-[760px] text-[15px] font-semibold leading-6 text-[#64799e]">
              Manage access, audit visibility, model registry operations, and maintenance settings for the clinical prediction workspace.
            </p>
          </div>
        </div>

        <div className="mt-5 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AdminAction
            title="User access"
            detail="Review roles and account permissions."
            isActive={activeAdminPanel === 'users'}
            onClick={() => openAdminPanel('User access')}
          />
          <AdminAction title="Audit logs" detail="View recent settings and prediction activity." onClick={() => openAdminPanel('Audit logs')} />
          <AdminAction title="Model registry" detail="Manage active and archived model artifacts." onClick={() => openAdminPanel('Model registry')} />
          <AdminAction title="Maintenance" detail="Check API, database, and sync status." onClick={() => openAdminPanel('Maintenance')} />
        </div>

        {activeAdminPanel === 'users' && (
          <UsersTable
            users={users}
            editingUserId={editingUserId}
            onEdit={setEditingUserId}
            onRoleChange={updateUserRole}
          />
        )}
      </section>

      <div className="sticky bottom-0 z-10 -mx-3 flex flex-col gap-3 border-t border-[#d9e5f3] bg-[#eef5fb]/95 px-3 py-4 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-0">
        <button
          type="button"
          onClick={discardChanges}
          className="min-h-12 w-full rounded-full bg-[#dc2626] px-6 py-3 text-center text-[15px] font-extrabold leading-5 text-white shadow-[0_10px_24px_rgba(220,38,38,0.24)] transition hover:bg-[#b91c1c] focus:outline-none focus:ring-2 focus:ring-[#ef4444] sm:w-auto sm:min-w-[180px]"
        >
          Discard changes
        </button>
        <button
          type="button"
          onClick={saveChanges}
          className="min-h-12 w-full rounded-full bg-[#111b3b] px-6 py-3 text-center text-[15px] font-extrabold leading-5 text-white shadow-[0_10px_24px_rgba(17,27,59,0.22)] transition hover:bg-[#172653] focus:outline-none focus:ring-2 focus:ring-[#1768f2] sm:w-auto sm:min-w-[170px]"
        >
          Save changes
        </button>
      </div>
    </div>
  )
}

function SettingsPanel({ title, children }) {
  return (
    <div className="min-w-0 rounded-[16px] border border-[#e2eaf5] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.07)] md:px-6">
      <h2 className="text-[22px] font-black text-[#071b49]">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="min-w-0 rounded-[12px] border border-[#d9e5f3] bg-[#f8fbff] px-4 py-3">
      <p className="text-[13px] font-bold text-[#6c7f9f]">{label}</p>
      <p className="mt-1 break-words text-[15px] font-extrabold text-[#071b49]">{value}</p>
    </div>
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
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
  }

  return <svg {...common}>{paths[name]}</svg>
}

function AdminAction({ title, detail, isActive = false, onClick }) {
  return (
    <button
      type="button"
      className={`min-h-[112px] min-w-0 rounded-[12px] border px-4 py-4 text-left transition hover:border-[#b8cce6] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#1768f2] ${
        isActive
          ? 'border-[#1768f2] bg-white shadow-[0_12px_28px_rgba(23,104,242,0.14)]'
          : 'border-[#d9e5f3] bg-[#f8fbff]'
      }`}
      onClick={onClick}
    >
      <span className="block break-words text-[16px] font-extrabold text-[#071b49]">{title}</span>
      <span className="mt-2 block break-words text-[13px] font-semibold leading-5 text-[#64799e]">{detail}</span>
    </button>
  )
}

function UsersTable({ users, editingUserId, onEdit, onRoleChange }) {
  return (
    <div className="mt-5 min-w-0 overflow-hidden rounded-[14px] border border-[#d9e5f3] bg-white">
      <div className="flex min-w-0 flex-col gap-2 border-b border-[#e5edf7] bg-[#f8fbff] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-[20px] font-black text-[#071b49]">Users</h3>
          <p className="mt-1 text-[13px] font-semibold text-[#64799e]">Manage user roles and account permissions.</p>
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead className="bg-white text-[12px] font-black uppercase tracking-[0.12em] text-[#64799e]">
            <tr>
              <th className="px-4 py-3">Names</th>
              <th className="px-4 py-3">User ID</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3 text-right">Edit</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-[#edf2f8]">
                <td className="px-4 py-4 text-[14px] font-extrabold text-[#071b49]">{user.name}</td>
                <td className="px-4 py-4 text-[14px] font-semibold text-[#53668a]">{user.id}</td>
                <td className="px-4 py-4 text-[14px] font-semibold text-[#53668a]">{user.email}</td>
                <td className="px-4 py-4">
                  {editingUserId === user.id ? (
                    <RoleSelect value={user.role} onChange={(role) => onRoleChange(user.id, role)} />
                  ) : (
                    <span className="inline-flex rounded-full bg-[#eef5ff] px-3 py-1 text-[13px] font-extrabold text-[#1768f2]">
                      {user.role}
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 text-right">
                  <button
                    type="button"
                    aria-label={`Edit ${user.name} role`}
                    onClick={() => onEdit(editingUserId === user.id ? null : user.id)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f1f6fd] text-[#172a53] transition hover:bg-[#dbeafe] hover:text-[#1768f2] focus:outline-none focus:ring-2 focus:ring-[#1768f2]"
                  >
                    <Icon name="edit" className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-3 lg:hidden">
        {users.map((user) => (
          <div key={user.id} className="rounded-[12px] border border-[#e5edf7] bg-[#f8fbff] p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-[15px] font-extrabold text-[#071b49]">{user.name}</p>
                <p className="mt-1 break-words text-[13px] font-semibold text-[#64799e]">{user.email}</p>
                <p className="mt-1 text-[12px] font-black uppercase tracking-[0.12em] text-[#8aa0bf]">{user.id}</p>
              </div>
              <button
                type="button"
                aria-label={`Edit ${user.name} role`}
                onClick={() => onEdit(editingUserId === user.id ? null : user.id)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#172a53] shadow-sm transition hover:bg-[#dbeafe] hover:text-[#1768f2] focus:outline-none focus:ring-2 focus:ring-[#1768f2]"
              >
                <Icon name="edit" className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3">
              <p className="mb-2 text-[12px] font-black uppercase tracking-[0.12em] text-[#64799e]">Role</p>
              {editingUserId === user.id ? (
                <RoleSelect value={user.role} onChange={(role) => onRoleChange(user.id, role)} />
              ) : (
                <span className="inline-flex rounded-full bg-[#eef5ff] px-3 py-1 text-[13px] font-extrabold text-[#1768f2]">
                  {user.role}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RoleSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full min-w-[150px] rounded-[10px] border border-[#c9d8eb] bg-white px-3 text-[14px] font-extrabold text-[#071b49] outline-none transition focus:border-[#1768f2] focus:ring-2 focus:ring-[#b8d3ff] lg:w-auto"
    >
      {roleOptions.map((role) => (
        <option key={role} value={role}>{role}</option>
      ))}
    </select>
  )
}

function ThresholdCard({ label, rangeText, tone, value, min, max, onChange, compactLabel }) {
  const isEditable = typeof onChange === 'function'

  return (
    <div className="min-w-0 rounded-[12px] bg-[#f8fbff] px-4 py-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-[16px] font-extrabold text-[#071b49]">{label}</p>
          <p className="mt-1 text-[14px] font-semibold text-[#53668a]">{rangeText}</p>
        </div>

        {isEditable ? (
          <label className="flex w-full min-w-0 items-center gap-2 sm:w-auto" aria-label={`${label} percentage`}>
            <span className="shrink-0 text-[12px] font-black uppercase text-[#64799e]">{compactLabel}</span>
            <input
              type="number"
              min={min}
              max={max}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className="h-10 w-full min-w-0 rounded-[10px] border border-[#c9d8eb] bg-white px-3 text-center text-[15px] font-extrabold text-[#071b49] outline-none transition focus:border-[#1768f2] focus:ring-2 focus:ring-[#b8d3ff] sm:w-[78px]"
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
            onChange={(event) => onChange(event.target.value)}
            className="min-w-0 flex-1 accent-[#1768f2]"
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
