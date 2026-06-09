import React, { useEffect, useState } from 'react'
import { API_BASE_URL, getSession, isAdminSession } from '../authSession.js'
import SupportTicketDetails from './SupportTicketDetails.jsx'
import SupportTicketForm from './SupportTicketForm.jsx'
import SupportTicketTable from './SupportTicketTable.jsx'

const SUPPORT_TICKETS_URL = `${API_BASE_URL}/api/support/tickets/`

export default function SupportPortal() {
  const [tickets, setTickets] = useState([])
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [ticketLoadError, setTicketLoadError] = useState('')
  const session = getSession()
  const isAdmin = isAdminSession(session)

  useEffect(() => {
    loadTickets()
  }, [])

  async function loadTickets() {
    setLoading(true)
    setTicketLoadError('')
    try {
      const response = await fetch(SUPPORT_TICKETS_URL, {
        credentials: 'include',
        headers: authHeaders(),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || data.error || 'Could not load support tickets.')
      setTickets(Array.isArray(data) ? data : data.results || [])
    } catch (error) {
      setTicketLoadError('Support ticket history is temporarily unavailable. New support requests can still be sent when the support service is available.')
      setTickets([])
    } finally {
      setLoading(false)
    }
  }

  async function submitTicket(form) {
    setSubmitting(true)
    setMessage('')
    setError('')
    try {
      const body = new FormData()
      Object.entries(form).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') body.append(key, value)
      })
      const response = await fetch(SUPPORT_TICKETS_URL, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(false),
        body,
      })
      const data = await readJsonResponse(response)
      if (!response.ok) throw new Error(formatApiError(data))
      await loadTickets()
      if (data.email_delivery_error) {
        setMessage('Support ticket saved. Email delivery is not configured yet, so the administrator should review it in the support portal.')
      } else {
        setMessage('Support ticket sent successfully.')
      }
      return true
    } catch (error) {
      setError(supportRequestErrorMessage(error))
      return false
    } finally {
      setSubmitting(false)
    }
  }

  async function updateTicket(ticketId, updates) {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const body = new FormData()
      Object.entries(updates).forEach(([key, value]) => body.append(key, value ?? ''))
      const response = await fetch(`${SUPPORT_TICKETS_URL}${ticketId}/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: authHeaders(false),
        body,
      })
      const data = await readJsonResponse(response)
      if (!response.ok) throw new Error(formatApiError(data))
      setSelectedTicket(data)
      setMessage('Support ticket updated successfully.')
      await loadTickets()
    } catch (error) {
      setError(supportRequestErrorMessage(error, 'Could not update support ticket.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container-fluid min-w-0 px-0">
      <section className="card border-0 shadow-sm rounded-4 mb-4 rounded-[16px] border border-[#d9e5f3] bg-white px-5 py-5 md:px-6">
        <p className="small-text text-primary fw-bold text-uppercase mb-2 font-extrabold tracking-[0.14em]">Support Portal</p>
        <h1 className="page-title fw-black mb-2 text-[#071b49]">Support Portal</h1>
        <p className="body-text mb-0 mt-2 max-w-[850px] font-semibold text-[#53668a]">
          Submit technical issues, prediction concerns, model feedback, or system support requests.
        </p>
      </section>

      {message && <div className="alert alert-success rounded-4 fw-bold">{message}</div>}
      {error && <div className="alert alert-danger rounded-4 fw-bold">{error}</div>}

      <SupportTicketForm currentUser={session} loading={submitting} onSubmit={submitTicket} />
      <SupportTicketTable error={ticketLoadError} loading={loading} tickets={tickets} onSelectTicket={setSelectedTicket} />

      {selectedTicket && (
        <SupportTicketDetails
          isAdmin={isAdmin}
          loading={saving}
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={updateTicket}
        />
      )}
    </div>
  )
}

async function readJsonResponse(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

function supportRequestErrorMessage(error, fallback = 'Could not send the support ticket email.') {
  if (isSmtpConfigurationError(error?.message)) {
    return 'Support request was received, but the support email account needs SMTP setup. The administrator can review the ticket in the support portal.'
  }
  if (error?.message && error.message !== 'Failed to fetch') {
    return error.message
  }
  return `${fallback} Please confirm the backend server is running and try again.`
}

function authHeaders(includeJson = true) {
  const session = getSession()
  return {
    ...(includeJson ? { Accept: 'application/json' } : { Accept: 'application/json' }),
    Authorization: `Bearer ${session?.token || ''}`,
    'X-User-Email': session?.email || '',
    'X-User-Username': session?.username || '',
  }
}

function formatApiError(data) {
  if (!data || typeof data !== 'object') return 'Request failed.'
  const message = data.detail || data.error || Object.entries(data)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
    .join(' ')
  if (isSmtpConfigurationError(message)) {
    return 'Support email account needs SMTP setup. The ticket was not emailed automatically.'
  }
  return message
}

function isSmtpConfigurationError(message) {
  return /smtp|gmail|5\.7\.0|authentication required|application-specific password|support\.google\.com/i.test(String(message || ''))
}
