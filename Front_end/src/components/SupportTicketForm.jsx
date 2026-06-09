import React, { useMemo, useState } from 'react'

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

export default function SupportTicketForm({ currentUser, loading, onSubmit }) {
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

function validateForm(form) {
  const errors = {}
  const requiredFields = ['full_name', 'email', 'category', 'priority', 'subject', 'message']
  requiredFields.forEach((field) => {
    if (!String(form[field] || '').trim()) errors[field] = 'This field is required.'
  })
  return errors
}
