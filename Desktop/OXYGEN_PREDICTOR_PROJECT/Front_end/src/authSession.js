export const SESSION_KEY = 'postop_o2_session'
export const SESSION_REVOKED_AT_KEY = 'postop_o2_session_revoked_at'
export const SESSION_EVENT = 'postop-o2-session-changed'
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function getSession() {
  try {
    return JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

export function createSession(user) {
  const revokedAt = window.localStorage.getItem(SESSION_REVOKED_AT_KEY) || ''
  const session = {
    ...user,
    token: createLocalSessionToken(),
    loggedInAt: new Date().toISOString(),
    revokedAt,
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  notifySessionChanged()
  return session
}

export function clearCurrentSession() {
  fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {})
  window.localStorage.removeItem(SESSION_KEY)
  notifySessionChanged()
}

export function logoutFromAllDevices() {
  const revokedAt = new Date().toISOString()
  fetch(`${API_URL}/auth/logout-all`, {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {})
  window.localStorage.setItem(SESSION_REVOKED_AT_KEY, revokedAt)
  window.localStorage.removeItem(SESSION_KEY)
  notifySessionChanged()
  return revokedAt
}

export function isSessionActive(session = getSession()) {
  if (!session?.loggedInAt) return false

  const revokedAt = window.localStorage.getItem(SESSION_REVOKED_AT_KEY)
  if (!revokedAt) return true

  return Date.parse(session.loggedInAt) > Date.parse(revokedAt)
}

export function notifySessionChanged() {
  window.dispatchEvent(new Event(SESSION_EVENT))
}

function createLocalSessionToken() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
