import React from 'react'
import SupportStatusBadge from './SupportStatusBadge.jsx'

export default function SupportTicketTable({ error, loading, onSelectTicket, tickets }) {
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
                <td className="px-4 py-3 text-[#334766]">{formatDate(ticket.created_at)}</td>
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

function formatDate(value) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
