import React, { useState } from 'react'
import SupportStatusBadge from './SupportStatusBadge.jsx'

const statusOptions = [
  ['open', 'Open'],
  ['in_progress', 'In Progress'],
  ['resolved', 'Resolved'],
  ['closed', 'Closed'],
]

export default function SupportTicketDetails({ isAdmin, loading, onClose, onUpdate, ticket }) {
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

function Detail({ label, value }) {
  return (
    <div className="rounded-[10px] border border-[#d9e5f3] bg-white px-4 py-3">
      <p className="small-text font-bold text-[#64799e]">{label}</p>
      <p className="body-text mt-1 break-words font-extrabold text-[#071b49]">{value}</p>
    </div>
  )
}

function formatDate(value) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}
