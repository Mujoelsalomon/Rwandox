import React, { useEffect, useState } from 'react'
import { getSession, updateSession } from '../authSession.js'
import { API_BASE_URL } from '../config/api.js'

function notify(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('app-notification', { detail: { message, type } }))
}

export default function ProfileContent() {
  const [profile, setProfile] = useState(() => normalizeUser(getSession()))
  const [form, setForm] = useState(() => normalizeUser(getSession()))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canEditRole = Boolean(profile.is_staff || profile.is_superuser)

  useEffect(() => {
    let active = true

    async function loadProfile() {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' })
        const data = await response.json()
        if (!active) return
        if (!response.ok) throw new Error(data.error || 'Could not load profile.')

        const nextProfile = normalizeUser(data.user)
        setProfile(nextProfile)
        setForm(nextProfile)
        updateSession(nextProfile)
        setError('')
      } catch (profileError) {
        console.error(profileError)
        if (active) setError('Could not refresh profile from the backend. Showing saved session details.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadProfile()
    return () => {
      active = false
    }
  }, [])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function discardChanges() {
    setForm(profile)
    setError('')
    notify('Profile changes were discarded.', 'warning')
  }

  async function saveProfile(event) {
    event.preventDefault()
    const name = form.name.trim()
    const email = form.email.trim().toLowerCase()

    if (!name || !email) {
      setError('Name and email are required.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          email,
          ...(canEditRole ? { role: form.role } : {}),
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Could not save profile.')
        return
      }

      const nextProfile = normalizeUser(data.user)
      setProfile(nextProfile)
      setForm(nextProfile)
      updateSession(nextProfile)
      notify('Profile updated successfully.', 'success')
    } catch (saveError) {
      console.error(saveError)
      setError('Could not connect to the backend while saving your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container-fluid min-w-0 px-0">
      <section className="card border-0 shadow-sm rounded-4 mb-3 rounded-[16px] border border-[#e2eaf5] bg-white px-5 py-5 md:px-6">
        <p className="text-primary fw-bold text-uppercase small mb-2 text-[13px] font-black tracking-[0.22em]">Profile</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="fw-black break-words text-[30px] font-black leading-[34px] text-[#071b49]">
              Active user profile
            </h1>
            <p className="text-secondary mt-2 max-w-[760px] text-[16px] leading-7">
              View your account identity and update your profile details.
            </p>
          </div>
          <div className="flex h-20 w-20 shrink-0 items-end justify-center overflow-hidden rounded-full bg-gradient-to-b from-[#eef3fa] to-[#cdd8e8] ring-4 ring-[#dbeafe]">
            <div className="mb-2 h-12 w-12 rounded-full bg-[#24334f]" />
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="card border-0 shadow-sm rounded-4 min-w-0 rounded-[16px] border border-[#e2eaf5] bg-white px-5 py-5 md:px-6">
          <h2 className="h4 fw-bold text-[22px] font-black text-[#071b49]">Account details</h2>
          <div className="mt-4 grid gap-3">
            <ProfileField label="Name" value={profile.name} />
            <ProfileField label="User ID" value={profile.id ? `USR-${String(profile.id).padStart(3, '0')}` : 'Not available'} />
            <ProfileField label="Username" value={profile.username} />
            <ProfileField label="Role" value={profile.role} />
            <ProfileField label="Email" value={profile.email} />
          </div>
        </div>

        <form onSubmit={saveProfile} className="card border-0 shadow-sm rounded-4 min-w-0 rounded-[16px] border border-[#e2eaf5] bg-white px-5 py-5 md:px-6">
          <h2 className="h4 fw-bold text-[22px] font-black text-[#071b49]">Edit profile</h2>
          <div className="mt-4 grid gap-4">
            <label className="block">
              <span className="form-label mb-2 block text-[14px] font-black text-[#071b49]">Full name</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                className="form-control form-control-lg min-h-12 w-full rounded-[12px] border border-[#cbd8e8] bg-white px-4 text-[15px] font-semibold text-[#071b49] outline-none transition focus:border-[#1768f2] focus:ring-2 focus:ring-[#bfdbfe]"
              />
            </label>
            <label className="block">
              <span className="form-label mb-2 block text-[14px] font-black text-[#071b49]">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                className="form-control form-control-lg min-h-12 w-full rounded-[12px] border border-[#cbd8e8] bg-white px-4 text-[15px] font-semibold text-[#071b49] outline-none transition focus:border-[#1768f2] focus:ring-2 focus:ring-[#bfdbfe]"
              />
            </label>
            <ReadOnlyInput label="User ID" value={profile.id ? `USR-${String(profile.id).padStart(3, '0')}` : 'Not available'} />
            {canEditRole ? (
              <label className="block">
                <span className="form-label mb-2 block text-[14px] font-black text-[#071b49]">Role</span>
                <select
                  value={form.role}
                  onChange={(event) => updateField('role', event.target.value)}
                  className="form-select form-select-lg min-h-12 w-full rounded-[12px] border border-[#cbd8e8] bg-white px-4 text-[15px] font-semibold text-[#071b49] outline-none transition focus:border-[#1768f2] focus:ring-2 focus:ring-[#bfdbfe]"
                >
                  <option value="Clinician">Clinician</option>
                  <option value="Administrator">Administrator</option>
                  {profile.is_superuser && <option value="Superuser">Superuser</option>}
                </select>
              </label>
            ) : (
              <ReadOnlyInput label="Role" value={profile.role} />
            )}
          </div>

          {loading && (
            <p className="alert alert-info rounded-4 mt-4 px-4 py-3 text-[14px] font-bold">
              Loading current profile...
            </p>
          )}

          {error && (
            <p className="alert alert-danger rounded-4 mt-4 px-4 py-3 text-[14px] font-bold" role="alert">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={discardChanges}
              className="btn btn-dark fw-bold min-h-12 rounded-full px-6 py-3 text-[15px] font-extrabold text-white"
            >
              Discard changes
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-success fw-bold min-h-12 rounded-full px-6 py-3 text-[15px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function ProfileField({ label, value }) {
  return (
    <div className="card bg-light border-0 rounded-4 min-w-0 rounded-[12px] border border-[#d9e5f3] px-4 py-3">
      <p className="card-text text-secondary text-[13px] font-bold">{label}</p>
      <p className="mt-1 break-words text-[15px] font-extrabold text-[#071b49]">{value || 'Not available'}</p>
    </div>
  )
}

function ReadOnlyInput({ label, value }) {
  return (
    <label className="block">
      <span className="form-label mb-2 block text-[14px] font-black text-[#071b49]">{label}</span>
      <input
        type="text"
        value={value}
        readOnly
        className="form-control form-control-lg bg-light min-h-12 w-full rounded-[12px] border border-[#d9e5f3] px-4 text-[15px] font-semibold text-[#64799e] outline-none"
      />
    </label>
  )
}

function normalizeUser(user) {
  return {
    id: user?.id || '',
    username: user?.username || '',
    name: user?.name || user?.username || 'Anesthetist',
    role: user?.role || 'Clinician',
    email: user?.email || '',
    is_staff: Boolean(user?.is_staff),
    is_superuser: Boolean(user?.is_superuser),
  }
}
