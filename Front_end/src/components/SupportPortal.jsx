import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL, getSession, isAdminSession } from '../authSession.js'

const SUPPORT_TICKETS_URL = `${API_BASE_URL}/api/support/tickets/`
const priorityClasses = {
  low: 'bg-[#dcfce7] text-[#166534]',
  medium: 'bg-[#dbeafe] text-[#1d4ed8]',
  high: 'bg-[#ffedd5] text-[#c2410c]',
  critical: 'bg-[#fee2e2] text-[#991b1b]',
}
const statusClasses = {
  open: 'bg-[#ffedd5] text-[#c2410c]',
  in_progress: 'bg-[#dbeafe] text-[#1d4ed8]',
  resolved: 'bg-[#dcfce7] text-[#166534]',
  closed: 'bg-[#e5e7eb] text-[#374151]',
}
const categoryOptions = [
  ['technical', 'Technical Issue'],
  ['prediction', 'Prediction Concern'],
  ['training', 'Model Training Issue'],
  ['login', 'Login / Authentication Problem'],
  ['upload', 'Data Upload Problem'],
  ['safety', 'Patient Safety Concern'],
  ['feedback', 'General Feedback'],
]
const priorityOptions = [
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
  ['critical', 'Critical'],
]
const statusOptions = [
  ['open', 'Open'],
  ['in_progress', 'In Progress'],
  ['resolved', 'Resolved'],
  ['closed', 'Closed'],
]

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
      setMessage('Support ticket saved successfully.')
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

function SupportTicketForm({ currentUser, loading, onSubmit }) {
  const initialForm = useMemo(() => ({
    full_name: currentUser?.name || '',
    email: currentUser?.email || '',
    role: currentUser?.role || '',
    department: '',
    category: '',
    priority: 'medium',
    subject: '',
    message: '',
    attachment: null,
  }), [currentUser])
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(false)

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
    setSent(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const ok = await onSubmit(form)
    if (ok) {
      setSent(true)
      setForm({ ...initialForm, subject: '', message: '', category: '', priority: 'medium', attachment: null })
      event.target.reset()
    }
  }

  return (
    <section className="card border-0 shadow-sm rounded-4 mb-4 rounded-[16px] border border-[#d9e5f3] bg-white px-5 py-5 md:px-6">
      <h2 className="section-title font-black text-[#071b49]">Create Support Request</h2>
      <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 lg:grid-cols-3">
          <TextField error={errors.full_name} label="Full Name" name="full_name" required value={form.full_name} onChange={updateField} />
          <TextField error={errors.email} label="Email" name="email" required type="email" value={form.email} onChange={updateField} />
          <TextField label="Role" name="role" value={form.role} onChange={updateField} />
          <TextField label="Department" name="department" value={form.department} onChange={updateField} />
          <SelectField error={errors.category} label="Issue Category" name="category" options={categoryOptions} required value={form.category} onChange={updateField} />
          <SelectField error={errors.priority} label="Priority Level" name="priority" options={priorityOptions} required value={form.priority} onChange={updateField} />
        </div>

        <TextField error={errors.subject} label="Subject" name="subject" required value={form.subject} onChange={updateField} />
        <TextAreaField error={errors.message} label="Message" name="message" required value={form.message} onChange={updateField} />

        <label className="block">
          <span className="form-label mb-2 block text-[14px] font-bold text-[#49617f]">Attachment Upload</span>
          <input
            className="form-control min-h-[48px] rounded-[10px] border border-[#c7d8eb] bg-white px-4 py-2 text-[15px] font-semibold text-[#071b49]"
            type="file"
            onChange={(event) => updateField('attachment', event.target.files?.[0] || null)}
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="submit"
            disabled={loading}
            className="btn-text btn btn-success min-h-12 rounded-[10px] px-6 py-3 font-extrabold text-white disabled:opacity-70"
          >
            {sent ? 'Sent' : loading ? 'Sending...' : 'Send Support Ticket'}
          </button>
        </div>
      </form>
    </section>
  )
}

function SupportTicketTable({ error, loading, onSelectTicket, tickets }) {
  return (
    <section className="card border-0 shadow-sm rounded-4 overflow-hidden rounded-[16px] border border-[#d9e5f3] bg-white">
      <div className="border-b border-[#e5edf7] px-5 py-4 md:px-6">
        <h2 className="section-title font-black text-[#071b49]">Support Tickets</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="table table-hover align-middle mb-0 min-w-[980px]">
          <thead className="table-light">
            <tr className="table-header text-uppercase text-secondary">
              <th className="px-4 py-3">Ticket ID</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted By</th>
              <th className="px-4 py-3">Date Submitted</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-5 font-bold text-[#53668a]" colSpan="8">Loading support tickets...</td>
              </tr>
            ) : error ? (
              <tr>
                <td className="px-4 py-5 font-bold text-[#92400e]" colSpan="8">{error}</td>
              </tr>
            ) : tickets.length > 0 ? tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td className="px-4 py-3 font-black text-[#071b49]">#{ticket.id}</td>
                <td className="px-4 py-3 font-bold text-[#071b49]">{ticket.subject}</td>
                <td className="px-4 py-3 text-[#334766]">{ticket.category_display}</td>
                <td className="px-4 py-3"><SupportStatusBadge type="priority" value={ticket.priority} label={ticket.priority_display} /></td>
                <td className="px-4 py-3"><SupportStatusBadge value={ticket.status} label={ticket.status_display} /></td>
                <td className="px-4 py-3 text-[#334766]">{ticket.full_name}</td>
                <td className="px-4 py-3 text-[#334766]">{formatSubmittedDate(ticket.created_at)}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onSelectTicket(ticket)}
                    className="btn-text btn btn-outline-primary rounded-[10px] px-4 py-2 font-extrabold"
                  >
                    View
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td className="px-4 py-5 font-bold text-[#53668a]" colSpan="8">No support tickets found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SupportTicketDetails({ isAdmin, loading, onClose, onUpdate, ticket }) {
  const [status, setStatus] = useState(ticket.status)
  const [adminResponse, setAdminResponse] = useState(ticket.admin_response || '')

  async function handleSave() {
    await onUpdate(ticket.id, { status, admin_response: adminResponse })
  }

  return (
    <div
      className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center px-3 py-4"
      style={{ zIndex: 1050, backgroundColor: 'rgba(4, 18, 43, 0.55)' }}
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="card border-0 shadow-lg rounded-4 w-100" style={{ maxWidth: 900, maxHeight: '92vh', overflow: 'auto' }}>
        <div className="card-body p-4 p-lg-5">
          <div className="d-flex justify-content-between gap-3">
            <div>
              <p className="small-text text-primary fw-bold text-uppercase mb-2 font-extrabold tracking-[0.14em]">Ticket #{ticket.id}</p>
              <h2 className="section-title font-black text-[#071b49]">{ticket.subject}</h2>
            </div>
            <button type="button" className="btn btn-light rounded-circle fw-bold align-self-start" onClick={onClose} aria-label="Close support ticket">
              &times;
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Detail label="Submitted By" value={ticket.full_name} />
            <Detail label="Email" value={ticket.email} />
            <Detail label="Role" value={ticket.role || 'Not provided'} />
            <Detail label="Department" value={ticket.department || 'Not provided'} />
            <Detail label="Category" value={ticket.category_display} />
            <div>
              <p className="small-text font-bold text-[#64799e]">Priority</p>
              <div className="mt-2"><SupportStatusBadge type="priority" value={ticket.priority} label={ticket.priority_display} /></div>
            </div>
            <div>
              <p className="small-text font-bold text-[#64799e]">Status</p>
              <div className="mt-2"><SupportStatusBadge value={ticket.status} label={ticket.status_display} /></div>
            </div>
            <Detail label="Date Submitted" value={formatDate(ticket.created_at)} />
          </div>

          <section className="mt-4 rounded-[12px] border border-[#d9e5f3] bg-[#f8fbff] p-4">
            <h3 className="card-title font-black text-[#071b49]">Message</h3>
            <p className="body-text mt-2 whitespace-pre-wrap font-semibold text-[#334766]">{ticket.message}</p>
            {ticket.attachment && (
              <a className="mt-3 inline-block font-bold text-[#1768f2] underline" href={ticket.attachment} target="_blank" rel="noreferrer">
                View attachment
              </a>
            )}
          </section>

          <section className="mt-4 rounded-[12px] border border-[#d9e5f3] bg-white p-4">
            <h3 className="card-title font-black text-[#071b49]">Admin Response</h3>
            {isAdmin ? (
              <div className="mt-3 grid gap-3">
                <label>
                  <span className="form-label mb-2 block text-[14px] font-bold text-[#49617f]">Status</span>
                  <select className="form-select rounded-[10px]" value={status} onChange={(event) => setStatus(event.target.value)}>
                    {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label>
                  <span className="form-label mb-2 block text-[14px] font-bold text-[#49617f]">Response</span>
                  <textarea className="form-control min-h-[120px] rounded-[10px]" value={adminResponse} onChange={(event) => setAdminResponse(event.target.value)} />
                </label>
                <button type="button" disabled={loading} onClick={handleSave} className="btn-text btn btn-primary w-fit rounded-[10px] px-5 py-2 font-extrabold text-white disabled:opacity-70">
                  {loading ? 'Saving...' : 'Save Response'}
                </button>
              </div>
            ) : (
              <p className="body-text mt-2 whitespace-pre-wrap font-semibold text-[#334766]">{ticket.admin_response || 'No admin response yet.'}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function SupportStatusBadge({ label, type = 'status', value }) {
  const classes = type === 'priority'
    ? priorityClasses[value] || priorityClasses.medium
    : statusClasses[value] || statusClasses.open

  return (
    <span className={`risk-badge-text inline-flex rounded-full px-3 py-2 font-black uppercase tracking-[0.08em] ${classes}`}>
      {label || value}
    </span>
  )
}

function TextField({ error, label, name, onChange, required = false, type = 'text', value }) {
  return (
    <label className="block">
      <span className="form-label mb-2 block text-[14px] font-bold text-[#49617f]">{label}{required ? ' *' : ''}</span>
      <input
        className="form-control min-h-[48px] rounded-[10px] border border-[#c7d8eb] bg-white px-4 text-[15px] font-semibold text-[#071b49]"
        type={type}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
      />
      {error && <span className="small-text mt-1 block font-bold text-[#b91c1c]">{error}</span>}
    </label>
  )
}

function TextAreaField({ error, label, name, onChange, required = false, value }) {
  return (
    <label className="block">
      <span className="form-label mb-2 block text-[14px] font-bold text-[#49617f]">{label}{required ? ' *' : ''}</span>
      <textarea
        className="form-control min-h-[132px] rounded-[10px] border border-[#c7d8eb] bg-white px-4 py-3 text-[15px] font-semibold text-[#071b49]"
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
      />
      {error && <span className="small-text mt-1 block font-bold text-[#b91c1c]">{error}</span>}
    </label>
  )
}

function SelectField({ error, label, name, onChange, options, required = false, value }) {
  return (
    <label className="block">
      <span className="form-label mb-2 block text-[14px] font-bold text-[#49617f]">{label}{required ? ' *' : ''}</span>
      <select
        className="form-select min-h-[48px] rounded-[10px] border border-[#c7d8eb] bg-white px-4 text-[15px] font-semibold text-[#071b49]"
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>{labelText}</option>
        ))}
      </select>
      {error && <span className="small-text mt-1 block font-bold text-[#b91c1c]">{error}</span>}
    </label>
  )
}

function Detail({ label, value }) {
  return (
    <div className="rounded-[10px] border border-[#d9e5f3] bg-white px-4 py-3">
      <p className="small-text font-bold text-[#64799e]">{label}</p>
      <p className="body-text mt-1 break-words font-extrabold text-[#071b49]">{value}</p>
    </div>
  )
}

function validateForm(form) {
  const errors = {}
  const requiredFields = ['full_name', 'email', 'category', 'priority', 'subject', 'message']
  requiredFields.forEach((field) => {
    if (!String(form[field] || '').trim()) errors[field] = 'This field is required.'
  })
  return errors
}

function formatDate(value) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatSubmittedDate(value) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
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
    return 'Support request was saved. The administrator can review it in the support portal.'
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
    return 'Support ticket was saved for administrator review.'
  }
  return message
}

function isSmtpConfigurationError(message) {
  return /smtp|gmail|5\.7\.0|authentication required|application-specific password|support\.google\.com/i.test(String(message || ''))
}
