import React from 'react'

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

export default function SupportStatusBadge({ label, type = 'status', value }) {
  const classes = type === 'priority'
    ? priorityClasses[value] || priorityClasses.medium
    : statusClasses[value] || statusClasses.open

  return (
    <span className={`risk-badge-text inline-flex rounded-full px-3 py-2 font-black uppercase tracking-[0.08em] ${classes}`}>
      {label || value}
    </span>
  )
}
