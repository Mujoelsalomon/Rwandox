import { getSession } from '../authSession.js'
import { API_BASE_URL } from './api.js'

/**
 * Get authorization headers for API requests
 */
export function getAuthHeaders(extraHeaders = {}) {
  const session = getSession()
  return {
    Authorization: `Bearer ${session?.token || ''}`,
    'X-User-Email': session?.email || '',
    'X-User-Username': session?.username || '',
    ...extraHeaders,
  }
}

/**
 * Fetch wrapper with automatic auth headers and credentials
 */
export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  const {
    method = 'GET',
    headers = {},
    body = null,
    ...otherOptions
  } = options

  const mergedHeaders = {
    ...getAuthHeaders(),
    ...headers,
  }

  // Add Content-Type for POST/PATCH if body is present and not FormData
  if (body && !(body instanceof FormData) && !mergedHeaders['Content-Type']) {
    mergedHeaders['Content-Type'] = 'application/json'
  }

  const config = {
    method,
    headers: mergedHeaders,
    credentials: 'include',
    ...otherOptions,
  }

  if (body) {
    config.body = body instanceof FormData ? body : JSON.stringify(body)
  }

  return fetch(url, config)
}

/**
 * Convenience methods
 */
export const apiGet = (endpoint, options) => apiFetch(endpoint, { ...options, method: 'GET' })
export const apiPost = (endpoint, body, options) => apiFetch(endpoint, { ...options, method: 'POST', body })
export const apiPatch = (endpoint, body, options) => apiFetch(endpoint, { ...options, method: 'PATCH', body })
export const apiDelete = (endpoint, options) => apiFetch(endpoint, { ...options, method: 'DELETE' })
