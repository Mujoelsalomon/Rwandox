import React, { useState } from 'react'

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

export default function SystemAdministrationContent() {
  const [activeAdminPanel, setActiveAdminPanel] = useState(null)
  const [users, setUsers] = useState(defaultUsers)
  const [editingUserId, setEditingUserId] = useState(null)

  function openAdminPanel(title) {
    if (title === 'User access') {
      setActiveAdminPanel((current) => (current === 'users' ? null : 'users'))
      return
    }
    if (title === 'Audit logs') {
      setActiveAdminPanel((current) => (current === 'audit' ? null : 'audit'))
      return
    }
    if (title === 'Model registry') {
      setActiveAdminPanel((current) => (current === 'model' ? null : 'model'))
      return
    }

    if (title === 'Maintenance') {
      setActiveAdminPanel((current) => (current === 'maintenance' ? null : 'maintenance'))
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
    <div className="settings-content-18 min-w-0 space-y-5">
      <section className="min-w-0 rounded-[16px] border border-[#e2eaf5] bg-white px-5 py-5 shadow-[0_10px_28px_rgba(13,28,61,0.07)] md:px-6">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-black uppercase tracking-[0.22em] text-[#1768f2]">System administration</p>
            <h1 className="mt-2 break-words text-[24px] font-black leading-8 text-[#071b49]">
              Administrative controls
            </h1>
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
          <AdminAction
            title="Audit logs"
            detail="view recent users activitues"
            isActive={activeAdminPanel === 'audit'}
            onClick={() => openAdminPanel('Audit logs')}
          />
          <AdminAction
            title="Model registry"
            detail="Manage active and archived model artifacts."
            isActive={activeAdminPanel === 'model'}
            onClick={() => openAdminPanel('Model registry')}
          />
          <AdminAction
            title="Maintenance"
            detail="Check API, database, and sync status."
            isActive={activeAdminPanel === 'maintenance'}
            onClick={() => openAdminPanel('Maintenance')}
          />
        </div>

        {activeAdminPanel === 'users' && (
          <UsersTable
            users={users}
            editingUserId={editingUserId}
            onEdit={setEditingUserId}
            onRoleChange={updateUserRole}
          />
        )}
        {activeAdminPanel === 'audit' && (
          <AuditLogs />
        )}
        {activeAdminPanel === 'model' && (
          <ModelRegistry />
        )}
        {activeAdminPanel === 'maintenance' && (
          <Maintenance />
        )}
      </section>
    </div>
  )
}

  function ModelRegistry() {
    const stored = JSON.parse(localStorage.getItem('postop_o2_models') || '[]')
    const models = stored.length
      ? stored
      : [
          { id: 'M-001', name: 'postop-o2-v1', version: '1.0.0', uploadedAt: '2026-05-12T10:00:00Z', status: 'active' },
          { id: 'M-002', name: 'postop-o2-v2', version: '2.0.0', uploadedAt: '2026-05-13T09:12:00Z', status: 'archived' },
        ]

    function exportCsv() {
      const header = ['Model ID', 'Name', 'Version', 'Uploaded At', 'Status']
      const rows = models.map((m) => [m.id, m.name, m.version, m.uploadedAt, m.status])
      const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `model_registry_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'')}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }

    return (
      <div className="mt-5 min-w-0 overflow-hidden rounded-[14px] border border-[#d9e5f3] bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-black text-[#071b49]">Model registry</h2>
            <p className="mt-1 text-[13px] font-semibold text-[#64799e]">Manage active and archived model artifacts.</p>
          </div>
          <div>
            <button onClick={exportCsv} className="rounded bg-[#1768f2] px-3 py-2 text-white font-bold">Export CSV</button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead className="bg-white text-[12px] font-black uppercase tracking-[0.12em] text-[#64799e]">
              <tr>
                <th className="px-4 py-3">Model ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Uploaded At</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id} className="border-t border-[#edf2f8]">
                  <td className="px-4 py-3 text-[14px] font-extrabold text-[#071b49]">{m.id}</td>
                  <td className="px-4 py-3 text-[14px] font-semibold text-[#53668a]">{m.name}</td>
                  <td className="px-4 py-3 text-[14px] font-semibold text-[#53668a]">{m.version}</td>
                  <td className="px-4 py-3 text-[14px] font-semibold text-[#53668a]">{new Date(m.uploadedAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-[14px] font-semibold text-[#53668a]">{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function Maintenance() {
    const [status, setStatus] = useState({ api: 'ok', db: 'ok', sync: 'ok' })

    function refresh() {
      // placeholder: toggle statuses to simulate check
      setStatus((s) => ({ api: s.api === 'ok' ? 'degraded' : 'ok', db: s.db, sync: s.sync === 'ok' ? 'syncing' : 'ok' }))
    }

    return (
      <div className="mt-5 min-w-0 overflow-hidden rounded-[14px] border border-[#d9e5f3] bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-black text-[#071b49]">Maintenance</h2>
            <p className="mt-1 text-[13px] font-semibold text-[#64799e]">Check API, database, and sync status.</p>
          </div>
          <div>
            <button onClick={refresh} className="rounded bg-[#1768f2] px-3 py-2 text-white font-bold">Refresh</button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded border p-3">
            <p className="text-sm font-black text-[#64799e]">API</p>
            <p className="mt-1 font-extrabold">{status.api}</p>
          </div>
          <div className="rounded border p-3">
            <p className="text-sm font-black text-[#64799e]">Database</p>
            <p className="mt-1 font-extrabold">{status.db}</p>
          </div>
          <div className="rounded border p-3">
            <p className="text-sm font-black text-[#64799e]">Sync</p>
            <p className="mt-1 font-extrabold">{status.sync}</p>
          </div>
        </div>
      </div>
    )
  }

  function AuditLogs() {
    const stored = JSON.parse(localStorage.getItem('postop_o2_audit') || '[]')
    const [logs] = useState(stored.length ? stored : [
      { id: 1, name: 'Joel Munyaneza', userId: 'USR-001', time: '2026-05-13T16:30:00Z', action: 'Logged in' },
      { id: 2, name: 'Anesthetist', userId: 'USR-002', time: '2026-05-13T16:40:00Z', action: 'Viewed patient record' },
      { id: 3, name: 'Model Admin', userId: 'USR-004', time: '2026-05-13T16:50:00Z', action: 'Updated model registry' },
    ])

    function exportCsv() {
      if (!logs || logs.length === 0) return
      const header = ['Name', 'User ID', 'Time', 'Action']
      const rows = logs.map((l) => [l.name, l.userId, l.time, l.action])
      const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit_logs_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'')}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }

    return (
      <div className="mt-5 min-w-0 overflow-hidden rounded-[14px] border border-[#d9e5f3] bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-black text-[#071b49]">Audit logs</h2>
            <p className="mt-1 text-[13px] font-semibold text-[#64799e]">Recent user activity and system events.</p>
          </div>
          <div>
            <button onClick={exportCsv} className="rounded bg-[#1768f2] px-3 py-2 text-white font-bold">Export CSV</button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead className="bg-white text-[12px] font-black uppercase tracking-[0.12em] text-[#64799e]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-[#edf2f8]">
                  <td className="px-4 py-3 text-[14px] font-extrabold text-[#071b49]">{l.name}</td>
                  <td className="px-4 py-3 text-[14px] font-semibold text-[#53668a]">{l.userId}</td>
                  <td className="px-4 py-3 text-[14px] font-semibold text-[#53668a]">{new Date(l.time).toLocaleString()}</td>
                  <td className="px-4 py-3 text-[14px] font-semibold text-[#53668a]">{l.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
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
          <h2 className="text-[20px] font-black text-[#071b49]">User management</h2>
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
