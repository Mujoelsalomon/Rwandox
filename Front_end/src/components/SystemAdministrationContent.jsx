import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LocalAccessQRCode from './LocalAccessQRCode.jsx'
import SupportPortal from './SupportPortal.jsx'
import { API_BASE_URL, getSession } from '../authSession.js'

const defaultUsers = []

const clinicalRoleOptions = ['Doctor', 'Nurse', 'Anesthetist', 'Researcher', 'Data manager']
const registrationRoleOptions = ['Administrator', ...clinicalRoleOptions]
const standardRoleOptions = ['Administrator', ...clinicalRoleOptions]

function roleOptionsForSession(session) {
  return session?.is_superuser ? ['Superuser', ...standardRoleOptions] : standardRoleOptions
}

function notify(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('app-notification', { detail: { message, type } }))
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function authHeaders(extra = {}) {
  const session = getSession()
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${session?.token || ''}`,
    'X-User-Email': session?.email || '',
    'X-User-Username': session?.username || '',
    ...extra,
  }
}

function formatUserDate(value) {
  if (!value) return 'Never'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString()
}

export default function SystemAdministrationContent() {
  const { t } = useTranslation()
  const [activeAdminPanel, setActiveAdminPanel] = useState(null)
  const [users, setUsers] = useState(defaultUsers)
  const [editingUserId, setEditingUserId] = useState(null)
  const [originalRole, setOriginalRole] = useState(null)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [error, setError] = useState('')
  const [activeSupportTicketCount, setActiveSupportTicketCount] = useState(0)
  const roleOptions = roleOptionsForSession(getSession())

  useEffect(() => {
    let active = true
    async function loadUsers() {
      setLoadingUsers(true)
      try {
        const resp = await fetch(`${API_BASE_URL}/api/admin/users/`, {
          credentials: 'include',
          headers: authHeaders(),
        })
        if (!active) return
        if (!resp.ok) throw new Error('Could not load users')
        const data = await resp.json()
        setUsers(Array.isArray(data.users) ? data.users : defaultUsers)
        setError('')
      } catch (e) {
        console.error(e)
        setError('Could not load users from backend. Using local defaults.')
        setUsers(defaultUsers)
      } finally {
        if (active) setLoadingUsers(false)
      }
    }
    loadUsers()
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    async function loadSupportTicketCount() {
      const session = getSession()
      try {
        const resp = await fetch(`${API_BASE_URL}/api/support/tickets/`, {
          credentials: 'include',
          headers: {
            ...authHeaders(),
          },
        })
        if (!active || !resp.ok) return
        const data = await resp.json()
        const tickets = Array.isArray(data) ? data : data.results || []
        const count = tickets.filter((ticket) => ['open', 'in_progress'].includes(ticket.status)).length
        if (active) setActiveSupportTicketCount(count)
      } catch (e) {
        console.error(e)
        if (active) setActiveSupportTicketCount(0)
      }
    }

    loadSupportTicketCount()
    return () => { active = false }
  }, [])

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
    if (title === 'QR-code access') {
      setActiveAdminPanel((current) => (current === 'qr' ? null : 'qr'))
      return
    }
    if (title === 'Support management') {
      setActiveAdminPanel((current) => (current === 'support' ? null : 'support'))
      return
    }

    notify(`${title} administration opened.`, 'info')
  }

  function draftUserRole(userId, role) {
    setUsers((current) => current.map((user) => (user.id === userId ? { ...user, role } : user)))
  }

  function handleEdit(userId) {
    if (editingUserId === userId) {
      setEditingUserId(null)
      setOriginalRole(null)
      return
    }
    const user = users.find((u) => u.id === userId)
    setOriginalRole(user ? user.role : null)
    setEditingUserId(userId)
  }

  function saveUserRole(userId) {
    const user = users.find((u) => u.id === userId)
    if (!user) {
      notify('Could not find user to save.', 'danger')
      return
    }

    ;(async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/auth/profile`, {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role }),
        })
        const data = await resp.json()
        if (!resp.ok) throw new Error(data.error || 'Save failed')
        setUsers((current) => current.map((u) => (u.id === data.user.id ? data.user : u)))
        setEditingUserId(null)
        setOriginalRole(null)
        notify('User role updated.', 'success')
      } catch (e) {
        console.error(e)
        notify('Could not save user role to backend.', 'danger')
      }
    })()
  }

  function discardUserRole(userId) {
    if (originalRole !== null) {
      setUsers((current) => current.map((user) => (user.id === userId ? { ...user, role: originalRole } : user)))
    }
    setEditingUserId(null)
    setOriginalRole(null)
    notify('User role changes discarded.', 'warning')
  }

  async function registerNewUser(form) {
    const resp = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(form),
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error || 'Could not register user.')

    setUsers((current) => {
      const exists = current.some((user) => user.id === data.user.id)
      return exists ? current.map((user) => (user.id === data.user.id ? data.user : user)) : [...current, data.user]
    })
    notify('New user registered.', 'success')
    return data.user
  }

  async function resetUserPassword(userId, password = '') {
    const resp = await fetch(`${API_BASE_URL}/api/admin/users/reset-password/`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id: userId, password }),
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error || 'Could not reset user password.')
    setUsers((current) => current.map((user) => (user.id === data.user.id ? data.user : user)))
    notify('Temporary password generated.', 'success')
    return data
  }

  async function updateUserStatus(userId, isActive) {
    const resp = await fetch(`${API_BASE_URL}/api/admin/users/status/`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id: userId, is_active: isActive }),
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error || 'Could not update user status.')
    setUsers((current) => current.map((user) => (user.id === data.user.id ? data.user : user)))
    notify(isActive ? 'User account activated.' : 'User account disabled.', 'success')
    return data.user
  }

  async function deleteUser(userId) {
    const resp = await fetch(`${API_BASE_URL}/api/admin/users/delete/`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id: userId }),
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error || 'Could not delete user.')
    setUsers((current) => current.filter((user) => user.id !== data.user.id))
    setEditingUserId(null)
    setOriginalRole(null)
    notify('User account deleted.', 'success')
    return data.user
  }

  return (
    <div className="settings-content-18 container-fluid min-w-0 px-0">
      <section className="card border-0 shadow-sm rounded-4 mb-3 min-w-0 rounded-[16px] border border-[#e2eaf5] bg-white px-5 py-5 md:px-6">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="small-text text-primary fw-bold text-uppercase mb-2 font-black tracking-[0.22em]">{t('systemAdministration')}</p>
            <h1 className="page-title fw-black mt-2 break-words font-black text-[#071b49]">
              {t('systemAdministrationTitle')}
            </h1>
            <p className="small-text text-secondary mt-2 max-w-[760px] font-semibold">
              {t('systemAdministrationIntro')}
            </p>
          </div>
        </div>

        <div className="mt-5 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <AdminAction
            title={t('userAccess')}
            detail={t('userAccessDetail')}
            icon="users"
            isActive={activeAdminPanel === 'users'}
            onClick={() => openAdminPanel('User access')}
          />
          <AdminAction
            title={t('auditLogs')}
            detail={t('auditLogsDetail')}
            icon="audit"
            isActive={activeAdminPanel === 'audit'}
            onClick={() => openAdminPanel('Audit logs')}
          />
          <AdminAction
            title={t('modelRegistry')}
            detail={t('modelRegistryDetail')}
            icon="database"
            isActive={activeAdminPanel === 'model'}
            onClick={() => openAdminPanel('Model registry')}
          />
          <AdminAction
            title={t('maintenance')}
            detail={t('maintenanceDetail')}
            icon="spanners"
            isActive={activeAdminPanel === 'maintenance'}
            onClick={() => openAdminPanel('Maintenance')}
          />
          <AdminAction
            title={t('qrCodeAccess')}
            detail={t('qrCodeAccessDetail')}
            icon="qr"
            isActive={activeAdminPanel === 'qr'}
            onClick={() => openAdminPanel('QR-code access')}
          />
          <AdminAction
            title="Support management"
            detail="Review incoming support tickets and admin follow-up."
            icon="mail"
            alertCount={activeSupportTicketCount}
            isActive={activeAdminPanel === 'support'}
            onClick={() => openAdminPanel('Support management')}
          />
        </div>

        {activeAdminPanel === 'users' && (
          <UsersTable
            users={users}
            loading={loadingUsers}
            editingUserId={editingUserId}
            roleOptions={roleOptions}
            onRegister={registerNewUser}
            onResetPassword={resetUserPassword}
            onUpdateStatus={updateUserStatus}
            onDeleteUser={deleteUser}
            onEdit={handleEdit}
            onRoleChange={draftUserRole}
            onSave={saveUserRole}
            onDiscard={discardUserRole}
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
        {activeAdminPanel === 'qr' && (
          <LocalAccessQRCode />
        )}
        {activeAdminPanel === 'support' && (
          <SupportManagement onActiveTicketCountChange={setActiveSupportTicketCount} />
        )}
      </section>
    </div>
  )
}

function SupportManagement({ onActiveTicketCountChange }) {
  return (
    <div className="mt-5 min-w-0">
      <section className="card border-0 shadow-sm rounded-4 mb-4 rounded-[14px] border border-[#d9e5f3] bg-white px-4 py-4">
        <h2 className="section-title font-black text-[#071b49]">Support management</h2>
        <p className="small-text mt-1 font-semibold text-[#64799e]">
          Review support tickets sent from the login form and support portal, update ticket status, and record admin responses.
        </p>
      </section>
      <SupportPortal managementOnly onActiveTicketCountChange={onActiveTicketCountChange} />
    </div>
  )
}

function normalizeRegistryModel(model) {
  const id = model.id ?? model.artifact_id ?? model.pk ?? model.model_id ?? ''
  const name = model.name || model.model_name || model.algorithm || model.model_type || 'Model artifact'
  const version = model.version || model.model_version || model.training_run_id || String(id || '')
  const uploadedAt = model.uploaded_at || model.created_at || model.trained_at || model.updated_at || ''
  const status = model.is_active ? 'active' : (model.status || 'available')

  return {
    id: String(id || version || name),
    name,
    version,
    uploadedAt,
    status,
  }
}

function formatRegistryDate(value) {
  const date = new Date(value || '')
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString()
}

  function ModelRegistry() {
    const { t } = useTranslation()
    const [models, setModels] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      let active = true

      async function loadModels() {
        setLoading(true)
        try {
          const resp = await fetch(`${API_BASE_URL}/models`, { credentials: 'include' })
          if (!active) return
          if (!resp.ok) throw new Error('Could not load model registry')
          const data = await resp.json()
          const registry = Array.isArray(data.models) ? data.models.map(normalizeRegistryModel) : []
          setModels(registry)
        } catch (e) {
          console.error(e)
          if (active) setModels([])
        } finally {
          if (active) setLoading(false)
        }
      }

      loadModels()
      return () => {
        active = false
      }
    }, [])

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
      <div className="card border-0 shadow-sm rounded-4 mt-5 min-w-0 overflow-hidden rounded-[14px] border border-[#d9e5f3] bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title font-black text-[#071b49]">{t('modelRegistry')}</h2>
            <p className="small-text mt-1 font-semibold text-[#64799e]">{t('modelRegistryDetail')}</p>
          </div>
          <div>
            <button onClick={exportCsv} disabled={!models.length} className="btn btn-primary fw-bold rounded px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60">{t('exportCsv')}</button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="table table-hover align-middle mb-0 w-full min-w-[720px] text-left">
            <thead className="table-header bg-white font-black uppercase tracking-[0.12em] text-[#64799e]">
              <tr>
                <th className="px-4 py-3">Model ID</th>
                <th className="px-4 py-3">{t('names')}</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Uploaded At</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-4 py-6 text-center text-[14px] font-semibold text-[#64799e]">Loading model registry...</td>
                </tr>
              ) : models.length ? (
                models.map((m) => (
                  <tr key={m.id} className="border-t border-[#edf2f8]">
                    <td className="px-4 py-3 text-[14px] font-extrabold text-[#071b49]">{m.id}</td>
                    <td className="px-4 py-3 text-[14px] font-semibold text-[#53668a]">{m.name}</td>
                    <td className="px-4 py-3 text-[14px] font-semibold text-[#53668a]">{m.version}</td>
                    <td className="px-4 py-3 text-[14px] font-semibold text-[#53668a]">{formatRegistryDate(m.uploadedAt)}</td>
                    <td className="px-4 py-3 text-[14px] font-semibold text-[#53668a]">{m.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-4 py-6 text-center text-[14px] font-semibold text-[#64799e]">No model artifacts available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function Maintenance() {
    const { t } = useTranslation()
    const [health, setHealth] = useState(null)
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState('')
    const [message, setMessage] = useState('')

    useEffect(() => {
      refreshSystemStatus()
    }, [])

    function authHeaders(extra = {}) {
      const session = getSession()
      return {
        Authorization: `Bearer ${session?.token || ''}`,
        'X-User-Email': session?.email || '',
        ...extra,
      }
    }

    async function requestMaintenance(path, options = {}) {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        credentials: 'include',
        ...options,
        headers: authHeaders(options.headers || {}),
      })
      if (options.raw) return response
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || data.message || 'Maintenance request failed.')
      return data
    }

    async function refreshSystemStatus() {
      setLoading(true)
      setMessage('')
      try {
        const data = await requestMaintenance('/api/admin/maintenance/health/')
        setHealth(data)
      } catch (error) {
        setMessage(error.message || 'Could not load maintenance status.')
      } finally {
        setLoading(false)
      }
    }

    async function updatePanel(path, key, label) {
      setActionLoading(label)
      setMessage('')
      try {
        const data = await requestMaintenance(path)
        setHealth((current) => ({ ...(current || {}), [key]: data }))
        setMessage(`${label} completed.`)
      } catch (error) {
        setMessage(error.message || `${label} failed.`)
      } finally {
        setActionLoading('')
      }
    }

    async function runAction(path, label, method = 'POST') {
      setActionLoading(label)
      setMessage('')
      try {
        const data = await requestMaintenance(path, { method })
        if (path.includes('reload-model')) {
          setHealth((current) => ({ ...(current || {}), model: data }))
        }
        setMessage(data.message || `${label} completed.`)
        if (!path.includes('reload-model')) refreshSystemStatus()
      } catch (error) {
        setMessage(error.message || `${label} failed.`)
      } finally {
        setActionLoading('')
      }
    }

    async function exportLogs() {
      setActionLoading('Export Model Logs')
      setMessage('')
      try {
        const response = await requestMaintenance('/api/admin/maintenance/export-logs/', { raw: true })
        if (!response.ok) throw new Error('Could not export model logs.')
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `model-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.txt`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
        setMessage('Model logs exported.')
      } catch (error) {
        setMessage(error.message || 'Could not export model logs.')
      } finally {
        setActionLoading('')
      }
    }

    const api = health?.api || {}
    const database = health?.database || {}
    const model = health?.model || {}
    const prediction = health?.prediction_service || {}
    const storage = health?.storage || {}
    const sync = health?.sync || {}

    return (
      <div className="card border-0 shadow-sm rounded-4 mt-5 min-w-0 overflow-hidden rounded-[14px] border border-[#d9e5f3] bg-white p-4">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="section-title font-black text-[#071b49]">{t('maintenance')}</h2>
            <p className="small-text mt-1 font-semibold text-[#64799e]">{t('maintenanceIntro')}</p>
          </div>
          <button onClick={refreshSystemStatus} disabled={loading} className="btn btn-primary fw-bold rounded px-4 py-2 text-white disabled:opacity-70">
            {loading ? t('refreshing') : t('refreshSystemStatus')}
          </button>
        </div>

        {message && (
          <div className="small-text mt-4 rounded-[10px] border border-[#d7e4f4] bg-[#f8fbff] px-4 py-3 font-bold text-[#071b49]">
            {message}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <HealthSummaryCard title={t('apiStatus')} status={api.status} value={api.label || api.status || 'Not checked'} />
          <HealthSummaryCard title={t('databaseStatus')} status={database.status} value={database.connection_result || 'Not checked'} />
          <HealthSummaryCard title={t('activeModelStatus')} status={model.status} value={model.model_loaded ? 'Loaded' : model.active_model_name || 'Not loaded'} />
          <HealthSummaryCard title={t('syncStatus')} status={sync.status} value={sync.label || 'Not checked'} />
          <HealthSummaryCard title={t('storageStatus')} status={storage.status} value={storage.available_storage_display || 'Not checked'} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <MaintenancePanel
            title="API Status"
            status={api.status}
            rows={[
              ['Status', api.label || statusLabel(api.status)],
              ['Backend URL', api.backend_url || 'Not available'],
              ['Response time', api.response_time_ms !== undefined ? `${api.response_time_ms} ms` : 'Not checked'],
              ['Last checked time', formatDateTime(api.last_checked)],
            ]}
            buttonLabel="Test API"
            loading={actionLoading === 'Test API'}
            onClick={() => updatePanel('/api/admin/maintenance/api-status/', 'api', 'Test API')}
          />
          <MaintenancePanel
            title="Database Status"
            status={database.status}
            rows={[
              ['Status', statusLabel(database.status)],
              ['Database type', database.database_type || 'Not available'],
              ['Database name', database.database_name || 'Not available'],
              ['Host', database.database_host || 'Not available'],
              ['Port', database.database_port || 'Not available'],
              ['Connection result', database.connection_result || 'Not checked'],
              ['Tables', database.table_count ?? 'Not available'],
              ['Migrations', database.migration_status || 'Not available'],
              ['Last successful connection', formatDateTime(database.last_successful_connection)],
            ]}
            buttonLabel="Test Database Connection"
            loading={actionLoading === 'Test Database Connection'}
            onClick={() => updatePanel('/api/admin/maintenance/database-status/', 'database', 'Test Database Connection')}
          />
          <MaintenancePanel
            title="Model Status"
            status={model.status}
            rows={[
              ['Active model name', model.active_model_name || 'No active model'],
              ['Model type', model.model_type || 'Not available'],
              ['Model loaded', model.model_loaded ? 'Yes' : 'No'],
              ['Last trained date', formatDateTime(model.last_trained_date)],
              ['Validation accuracy', formatMetric(model.validation_accuracy)],
              ['F1-score', formatMetric(model.f1_score)],
            ]}
            buttonLabel="Reload Active Model"
            loading={actionLoading === 'Reload Active Model'}
            onClick={() => runAction('/api/admin/maintenance/reload-model/', 'Reload Active Model')}
          />
          <MaintenancePanel
            title="Prediction Service"
            status={prediction.status}
            rows={[
              ['Prediction API status', prediction.prediction_api_status || statusLabel(prediction.status)],
              ['Last prediction date', formatDateTime(prediction.last_prediction_date)],
              ['Total predictions', prediction.total_predictions ?? 'Not available'],
            ]}
            buttonLabel="Run Test Prediction"
            loading={actionLoading === 'Run Test Prediction'}
            onClick={() => runAction('/api/admin/maintenance/test-prediction/', 'Run Test Prediction')}
          />
          <MaintenancePanel
            title="Storage Status"
            status={storage.status}
            rows={[
              ['Model folder status', storage.model_folder_status || 'Not checked'],
              ['Uploaded dataset folder status', storage.uploaded_dataset_folder_status || 'Not checked'],
              ['Log folder status', storage.log_folder_status || 'Not checked'],
              ['Available storage', storage.available_storage_display || 'Not available'],
            ]}
            buttonLabel="Check Storage"
            loading={actionLoading === 'Check Storage'}
            onClick={() => updatePanel('/api/admin/maintenance/storage-status/', 'storage', 'Check Storage')}
          />
        </div>

        <div className="mt-4 rounded-[14px] border border-[#d9e5f3] bg-[#f8fbff] p-4">
          <h3 className="card-title font-black text-[#071b49]">{t('maintenanceActions')}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MaintenanceAction label="Refresh Model Status" loading={loading} onClick={refreshSystemStatus} />
            <MaintenanceAction label="Reload Active Model" loading={actionLoading === 'Reload Active Model'} onClick={() => runAction('/api/admin/maintenance/reload-model/', 'Reload Active Model')} />
            <MaintenanceAction label="Clear Temporary Files" loading={actionLoading === 'Clear Temporary Files'} onClick={() => runAction('/api/admin/maintenance/clear-temp-files/', 'Clear Temporary Files')} />
            <MaintenanceAction label="Export Model Logs" loading={actionLoading === 'Export Model Logs'} onClick={exportLogs} />
            <MaintenanceAction label="Backup Database" loading={actionLoading === 'Backup Database'} onClick={() => runAction('/api/admin/maintenance/backup-database/', 'Backup Database')} />
            <MaintenanceAction label="Reset Failed Training Jobs" loading={actionLoading === 'Reset Failed Training Jobs'} onClick={() => runAction('/api/admin/maintenance/reset-failed-jobs/', 'Reset Failed Training Jobs')} />
          </div>
        </div>
      </div>
    )
  }

function HealthSummaryCard({ title, status, value }) {
  return (
    <div className="card rounded-[12px] border border-[#d9e5f3] bg-[#f8fbff] p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="table-header font-black uppercase tracking-[0.1em] text-[#64799e]">{title}</p>
        <StatusBadge status={status} />
      </div>
      <p className="body-text mt-3 break-words font-black text-[#071b49]">{value}</p>
    </div>
  )
}

function MaintenancePanel({ buttonLabel, loading, onClick, rows, status, title }) {
  const { t } = useTranslation()
  return (
    <section className="rounded-[14px] border border-[#d9e5f3] bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <h3 className="card-title font-black text-[#071b49]">{title}</h3>
        <StatusBadge status={status} />
      </div>
      <div className="mt-3 grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 rounded-[10px] bg-[#f8fbff] px-3 py-2 sm:grid-cols-[190px_minmax(0,1fr)]">
            <p className="table-header font-black uppercase tracking-[0.08em] text-[#64799e]">{label}</p>
            <p className="small-text break-words font-extrabold text-[#071b49]">{value ?? 'Not available'}</p>
          </div>
        ))}
      </div>
      <button onClick={onClick} disabled={loading} className="btn-text btn btn-outline-primary mt-4 w-full rounded-[10px] border px-4 py-2 font-extrabold disabled:opacity-70 sm:w-auto">
        {loading ? t('working') : buttonLabel}
      </button>
    </section>
  )
}

function MaintenanceAction({ label, loading, onClick }) {
  const { t } = useTranslation()
  return (
    <button onClick={onClick} disabled={loading} className="btn-text btn btn-light min-h-[48px] rounded-[10px] border border-[#cfe0f2] bg-white px-4 py-2 font-extrabold text-[#071b49] shadow-sm disabled:opacity-70">
      {loading ? t('working') : label}
    </button>
  )
}

function StatusBadge({ status }) {
  const tone = statusTone(status)
  return (
    <span className={`risk-badge-text shrink-0 rounded-full px-3 py-1 font-black uppercase tracking-[0.08em] ${tone.className}`}>
      {tone.label}
    </span>
  )
}

function statusTone(status) {
  const normalized = String(status || '').toLowerCase()
  if (['ok', 'ready', 'connected', 'success', 'completed'].includes(normalized)) {
    return { label: 'OK', className: 'bg-[#dcfce7] text-[#166534]' }
  }
  if (['failed', 'error', 'not connected', 'missing'].includes(normalized)) {
    return { label: 'Failed', className: 'bg-[#fee2e2] text-[#991b1b]' }
  }
  return { label: normalized ? 'Warning' : 'Pending', className: 'bg-[#fef3c7] text-[#92400e]' }
}

function statusLabel(status) {
  return statusTone(status).label
}

function formatDateTime(value) {
  if (!value) return 'Not available'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Not available'
  return parsed.toLocaleString()
}

function formatMetric(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 'Not available'
  const percent = numeric <= 1 ? numeric * 100 : numeric
  return `${Math.round(percent * 10) / 10}%`
}

  function AuditLogs() {
    const { t } = useTranslation()
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
      loadAuditLogs()
    }, [])

    function authHeaders(extra = {}) {
      const session = getSession()
      return {
        Authorization: `Bearer ${session?.token || ''}`,
        'X-User-Email': session?.email || '',
        ...extra,
      }
    }

    async function loadAuditLogs() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/audit-logs/`, {
          credentials: 'include',
          headers: authHeaders(),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load audit logs.')
        setLogs(Array.isArray(data.logs) ? data.logs : [])
      } catch (error) {
        setError(error.message || 'Could not load audit logs.')
      } finally {
        setLoading(false)
      }
    }

    async function exportCsv() {
      const response = await fetch(`${API_BASE_URL}/api/admin/audit-logs/export/`, {
        credentials: 'include',
        headers: authHeaders(),
      })
      if (!response.ok) {
        setError('Could not export audit logs.')
        return
      }
      const blob = await response.blob()
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
      <div className="card border-0 shadow-sm rounded-4 mt-5 min-w-0 overflow-hidden rounded-[14px] border border-[#d9e5f3] bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title font-black text-[#071b49]">{t('auditLogs')}</h2>
            <p className="small-text mt-1 font-semibold text-[#64799e]">{t('auditLogsDetail')}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadAuditLogs} disabled={loading} className="btn btn-outline-primary fw-bold rounded px-3 py-2">{loading ? 'Refreshing...' : 'Refresh'}</button>
            <button onClick={exportCsv} className="btn btn-primary fw-bold rounded px-3 py-2 text-white">{t('exportCsv')}</button>
          </div>
        </div>

        {error && <div className="alert alert-warning mt-3 rounded-4 font-semibold">{error}</div>}

        <div className="mt-4 overflow-x-auto">
          <table className="table table-hover align-middle mb-0 w-full min-w-[720px] text-left">
            <thead className="table-header bg-white font-black uppercase tracking-[0.12em] text-[#64799e]">
              <tr>
                <th className="px-4 py-3">{t('names')}</th>
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-4 py-4 text-[14px] font-semibold text-[#53668a]">Loading audit logs...</td>
                </tr>
              ) : logs.length > 0 ? logs.map((l) => (
                <tr key={l.id} className="border-t border-[#edf2f8]">
                  <td className="px-4 py-3 text-[14px] font-extrabold text-[#071b49]">{l.name}</td>
                  <td className="px-4 py-3 text-[14px] font-semibold text-[#53668a]">{l.userId}</td>
                  <td className="px-4 py-3 text-[14px] font-semibold text-[#53668a]">{new Date(l.time).toLocaleString()}</td>
                  <td className="px-4 py-3 text-[14px] font-semibold text-[#53668a]">{l.action}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4" className="px-4 py-4 text-[14px] font-semibold text-[#53668a]">No audit activity recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

function AdminAction({ title, detail, icon = '', alertCount = 0, isActive = false, onClick }) {
  const hasAlert = alertCount > 0
  return (
    <button
      type="button"
      className={`card btn relative min-h-[112px] min-w-0 rounded-[12px] border px-4 py-4 text-left transition hover:border-[#b8cce6] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#1768f2] ${
        isActive
          ? 'border-[#1768f2] bg-white shadow-[0_12px_28px_rgba(23,104,242,0.14)]'
          : hasAlert
            ? 'border-[#dc2626] bg-[#fff5f5] shadow-[0_12px_28px_rgba(220,38,38,0.14)]'
          : 'border-[#d9e5f3] bg-[#f8fbff]'
      }`}
      onClick={onClick}
    >
      {hasAlert && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#dc2626] px-2 py-1 text-[11px] font-black text-white shadow-sm">
          <Icon name="alert" className="h-3.5 w-3.5" />
          {alertCount}
        </span>
      )}
      {icon && (
        <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-[10px] ${hasAlert ? 'bg-[#fee2e2] text-[#dc2626]' : 'bg-[#eaf2ff] text-[#1768f2]'}`}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
      )}
      <span className="body-text block break-words font-extrabold text-[#071b49]">{title}</span>
      <span className="small-text mt-2 block break-words font-semibold text-[#64799e]">{detail}</span>
    </button>
  )
}

function UsersTable({ users, loading, editingUserId, roleOptions, onRegister, onResetPassword, onUpdateStatus, onDeleteUser, onEdit, onRoleChange, onSave, onDiscard }) {
  const { t } = useTranslation()
  const [registrationOpen, setRegistrationOpen] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [registrationError, setRegistrationError] = useState('')
  const [createdCredentials, setCreatedCredentials] = useState(null)
  const [resettingUserId, setResettingUserId] = useState(null)
  const [statusLoadingUserId, setStatusLoadingUserId] = useState(null)
  const [deletingUserId, setDeletingUserId] = useState(null)
  const [temporaryPassword, setTemporaryPassword] = useState(null)
  const [actionError, setActionError] = useState('')
  const [registrationForm, setRegistrationForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Doctor',
  })

  function updateRegistrationField(field, value) {
    setRegistrationForm((current) => ({ ...current, [field]: value }))
  }

  async function submitRegistration(event) {
    event.preventDefault()
    setRegistrationError('')

    const name = registrationForm.name.trim()
    const username = registrationForm.username.trim().toLowerCase()
    const email = registrationForm.email.trim().toLowerCase()
    const password = registrationForm.password
    const role = registrationForm.role

    if (!name) {
      setRegistrationError('Full name is required.')
      return
    }
    if (!validateEmail(email)) {
      setRegistrationError('Enter a valid email address.')
      return
    }
    if (username && !/^[a-z0-9._-]{3,30}$/.test(username)) {
      setRegistrationError('Username must be 3-30 characters and use letters, numbers, dots, underscores, or hyphens.')
      return
    }
    if (password.length < 8) {
      setRegistrationError('Password must be at least 8 characters.')
      return
    }
    if (password !== registrationForm.confirmPassword) {
      setRegistrationError('Passwords do not match.')
      return
    }

    try {
      setRegistering(true)
      const user = await onRegister({ name, username, email, password, role })
      setCreatedCredentials({
        name: user.name,
        username: user.username,
        password,
        role: user.role,
      })
      setRegistrationForm({
        name: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'Doctor',
      })
      setRegistrationOpen(false)
    } catch (error) {
      setRegistrationError(error.message || 'Could not register user.')
    } finally {
      setRegistering(false)
    }
  }

  async function resetPassword(user) {
    const password = window.prompt(`Enter a temporary password for ${user.name}. Leave blank to auto-generate one.`) || ''
    if (password && password.length < 8) {
      setActionError('Temporary password must be at least 8 characters.')
      return
    }

    setTemporaryPassword(null)
    setActionError('')
    setResettingUserId(user.id)
    try {
      const data = await onResetPassword(user.id, password)
      setTemporaryPassword({
        userName: data.user?.name || user.name,
        username: data.user?.username || user.username,
        password: data.temporary_password,
      })
    } catch (error) {
      setActionError(error.message || 'Could not reset password.')
    } finally {
      setResettingUserId(null)
    }
  }

  async function changeStatus(user) {
    const nextStatus = !user.is_active
    const confirmed = window.confirm(`${nextStatus ? 'Activate' : 'Disable'} ${user.name}?`)
    if (!confirmed) return

    setActionError('')
    setStatusLoadingUserId(user.id)
    try {
      await onUpdateStatus(user.id, nextStatus)
    } catch (error) {
      setActionError(error.message || 'Could not update user status.')
    } finally {
      setStatusLoadingUserId(null)
    }
  }

  async function removeUser(user) {
    const confirmed = window.confirm(`Delete ${user.name}? This removes the account and cannot be undone.`)
    if (!confirmed) return

    setActionError('')
    setDeletingUserId(user.id)
    try {
      await onDeleteUser(user.id)
    } catch (error) {
      setActionError(error.message || 'Could not delete user.')
    } finally {
      setDeletingUserId(null)
    }
  }

  return (
    <div className="card border-0 shadow-sm rounded-4 mt-5 min-w-0 overflow-hidden rounded-[14px] border border-[#d9e5f3] bg-white">
      <div className="flex min-w-0 flex-col gap-2 border-b border-[#e5edf7] bg-[#f8fbff] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="section-title font-black text-[#071b49]">{t('userManagement')}</h2>
          <p className="small-text mt-1 font-semibold text-[#64799e]">{t('manageUserRoles')}</p>
        </div>
        <button
          type="button"
          onClick={() => setRegistrationOpen((current) => !current)}
          className="btn btn-primary fw-bold inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-white"
        >
          <Icon name="plus" className="h-5 w-5" />
          <span>{registrationOpen ? 'Close registration' : 'Register the new user'}</span>
        </button>
      </div>

      {createdCredentials && (
        <div className="border-b border-[#e5edf7] bg-[#ecfdf5] px-4 py-4 text-[14px] font-semibold text-[#14532d]">
          Created active account for <strong>{createdCredentials.name}</strong>: username <code className="rounded bg-white px-2 py-1 font-black text-[#071b49]">{createdCredentials.username}</code>, password <code className="rounded bg-white px-2 py-1 font-black text-[#071b49]">{createdCredentials.password}</code>, role <strong>{createdCredentials.role}</strong>.
        </div>
      )}

      {registrationOpen && (
        <form onSubmit={submitRegistration} className="border-b border-[#e5edf7] bg-white px-4 py-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_180px]">
            <RegistrationField
              label="Full name"
              value={registrationForm.name}
              onChange={(value) => updateRegistrationField('name', value)}
              placeholder="Clinical staff name"
              autoComplete="name"
            />
            <RegistrationField
              label="Username"
              value={registrationForm.username}
              onChange={(value) => updateRegistrationField('username', value)}
              placeholder="Optional login name"
              autoComplete="username"
            />
            <RegistrationField
              label="Email"
              type="email"
              value={registrationForm.email}
              onChange={(value) => updateRegistrationField('email', value)}
              placeholder="name@hospital.org"
              autoComplete="email"
            />
            <RegistrationField
              label="Password"
              type="password"
              value={registrationForm.password}
              onChange={(value) => updateRegistrationField('password', value)}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
            />
            <RegistrationField
              label="Confirm password"
              type="password"
              value={registrationForm.confirmPassword}
              onChange={(value) => updateRegistrationField('confirmPassword', value)}
              placeholder="Repeat password"
              autoComplete="new-password"
            />
            <label className="block">
              <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.1em] text-[#64799e]">Role</span>
              <RoleSelect value={registrationForm.role} roleOptions={registrationRoleOptions} onChange={(role) => updateRegistrationField('role', role)} />
            </label>
          </div>

          {registrationError && (
            <div className="alert alert-danger rounded-4 mt-3 px-4 py-3 text-[14px] font-bold" role="alert">
              {registrationError}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setRegistrationOpen(false)
                setRegistrationError('')
              }}
              className="btn btn-light fw-bold min-h-11 rounded-[10px] px-4 py-2 text-[#172a53]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={registering}
              className="btn btn-success fw-bold min-h-11 rounded-[10px] px-4 py-2 text-white disabled:opacity-70"
            >
              {registering ? 'Registering...' : 'Create user'}
            </button>
          </div>
        </form>
      )}

      {temporaryPassword && (
        <div className="border-b border-[#e5edf7] bg-[#ecfdf5] px-4 py-4 text-[14px] font-semibold text-[#14532d]">
          Temporary password for <strong>{temporaryPassword.userName}</strong>
          {temporaryPassword.username ? <> ({temporaryPassword.username})</> : null}: <code className="rounded bg-white px-2 py-1 font-black text-[#071b49]">{temporaryPassword.password}</code>
          <span className="ml-2">Share it securely and ask the user to change it after login.</span>
        </div>
      )}

      {actionError && (
        <div className="alert alert-danger rounded-0 mb-0 border-x-0 border-t-0 px-4 py-3 text-[14px] font-bold" role="alert">
          {actionError}
        </div>
      )}

      <div className="hidden overflow-x-auto lg:block">
        <table className="table table-hover align-middle mb-0 w-full min-w-[1180px] text-left">
          <thead className="table-header bg-white font-black uppercase tracking-[0.12em] text-[#64799e]">
            <tr>
              <th className="px-4 py-3">{t('names')}</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">User ID</th>
              <th className="px-4 py-3">{t('email')}</th>
              <th className="px-4 py-3">{t('role')}</th>
              <th className="px-4 py-3">Password</th>
              <th className="px-4 py-3">Last login</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Help</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" className="px-4 py-6 text-center text-[14px] font-semibold text-[#64799e]">Loading users...</td>
              </tr>
            ) : users.length ? users.map((user) => (
              <tr key={user.id} className="border-t border-[#edf2f8]">
                <td className="px-4 py-4 text-[14px] font-extrabold text-[#071b49]">{user.name}</td>
                <td className="px-4 py-4 text-[14px] font-semibold text-[#53668a]">{user.username || 'Not recorded'}</td>
                <td className="px-4 py-4 text-[14px] font-semibold text-[#53668a]">{user.user_id || user.id}</td>
                <td className="px-4 py-4 text-[14px] font-semibold text-[#53668a]">{user.email}</td>
                <td className="px-4 py-4">
                  {editingUserId === user.id ? (
                    <RoleSelect value={user.role} roleOptions={roleOptions} onChange={(role) => onRoleChange(user.id, role)} />
                  ) : (
                    <span className="badge rounded-pill bg-[#1768f2] px-3 py-2 text-[13px] font-extrabold text-white opacity-100 inline-flex items-center">
                      <svg className="hidden sm:inline-block mr-2 h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                      <span>{user.role}</span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 text-[14px] font-black tracking-[0.1em] text-[#53668a]">{user.password_display || '********'}</td>
                <td className="px-4 py-4 text-[13px] font-semibold text-[#53668a]">{formatUserDate(user.last_login)}</td>
                <td className="px-4 py-4">
                  <span className={`rounded-full px-3 py-2 text-[12px] font-black ${user.is_active ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#991b1b]'}`}>
                    {user.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="inline-flex items-center justify-end gap-2">
                    {editingUserId === user.id && (
                      <>
                        <button
                          type="button"
                          aria-label={`${user.is_active ? 'Disable' : 'Activate'} ${user.name}`}
                          disabled={statusLoadingUserId === user.id}
                          onClick={() => changeStatus(user)}
                          className={`btn fw-bold min-h-10 rounded-full px-3 py-2 text-[13px] disabled:opacity-60 ${user.is_active ? 'btn-outline-warning' : 'btn-outline-success'}`}
                        >
                          {statusLoadingUserId === user.id ? 'Saving...' : user.is_active ? 'Disable' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${user.name}`}
                          disabled={deletingUserId === user.id}
                          onClick={() => removeUser(user)}
                          className="btn btn-outline-danger fw-bold min-h-10 rounded-full px-3 py-2 text-[13px] disabled:opacity-60"
                        >
                          {deletingUserId === user.id ? 'Deleting...' : 'Delete'}
                        </button>
                        <button
                          type="button"
                          aria-label={`Reset ${user.name} password`}
                          disabled={resettingUserId === user.id}
                          onClick={() => resetPassword(user)}
                          className="btn btn-outline-primary fw-bold min-h-10 rounded-full px-3 py-2 text-[13px] disabled:opacity-60"
                        >
                          {resettingUserId === user.id ? 'Resetting...' : 'Reset'}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      aria-label={`Edit ${user.name} role`}
                      onClick={() => onEdit(editingUserId === user.id ? null : user.id)}
                      className="btn btn-light inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f1f6fd] text-[#172a53]"
                    >
                      <Icon name="edit" className="h-5 w-5" />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="9" className="px-4 py-8 text-center text-[14px] font-semibold text-[#64799e]">
                  No users found. Register a new user to start managing account access.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-3 lg:hidden">
        {loading ? (
          <div className="rounded-[12px] border border-[#e5edf7] bg-[#f8fbff] p-4 text-[14px] font-semibold text-[#64799e]">Loading users...</div>
        ) : users.length ? users.map((user) => (
          <div key={user.id} className="card rounded-4 rounded-[12px] border border-[#e5edf7] bg-[#f8fbff] p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-[15px] font-extrabold text-[#071b49]">{user.name}</p>
                <p className="mt-1 break-words text-[13px] font-semibold text-[#64799e]">{user.email}</p>
                <p className="mt-1 text-[12px] font-black uppercase tracking-[0.12em] text-[#8aa0bf]">{user.username || 'No username'} | {user.user_id || user.id}</p>
              </div>
              <button
                type="button"
                aria-label={`Edit ${user.name} role`}
                onClick={() => onEdit(editingUserId === user.id ? null : user.id)}
                className="btn btn-light flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#172a53]"
              >
                <Icon name="edit" className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3">
              <p className="mb-2 text-[12px] font-black uppercase tracking-[0.12em] text-[#64799e]">{t('role')}</p>
              {editingUserId === user.id ? (
                <RoleSelect value={user.role} roleOptions={roleOptions} onChange={(role) => onRoleChange(user.id, role)} />
              ) : (
                <span className="badge rounded-pill bg-[#1768f2] px-3 py-2 text-[13px] font-extrabold text-white opacity-100 inline-flex items-center">
                  <svg className="hidden sm:inline-block mr-2 h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                  <span>{user.role}</span>
                </span>
              )}
            </div>
            <div className="mt-3 grid gap-2 rounded-[10px] bg-white px-3 py-3 text-[13px] font-semibold text-[#53668a]">
              <p>Password: <span className="font-black tracking-[0.1em]">{user.password_display || '********'}</span></p>
              <p>Status: <span className={user.is_active ? 'text-[#166534]' : 'text-[#991b1b]'}>{user.is_active ? 'Active' : 'Disabled'}</span></p>
              <p>Last login: {formatUserDate(user.last_login)}</p>
            </div>
            {editingUserId === user.id && (
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={statusLoadingUserId === user.id}
                  onClick={() => changeStatus(user)}
                  className={`btn fw-bold min-h-10 rounded-full px-3 py-2 ${user.is_active ? 'btn-outline-warning' : 'btn-outline-success'} disabled:opacity-60`}
                >
                  {statusLoadingUserId === user.id ? 'Saving...' : user.is_active ? 'Disable' : 'Activate'}
                </button>
                <button
                  type="button"
                  disabled={deletingUserId === user.id}
                  onClick={() => removeUser(user)}
                  className="btn btn-outline-danger fw-bold min-h-10 rounded-full px-3 py-2 disabled:opacity-60"
                >
                  {deletingUserId === user.id ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  type="button"
                  disabled={resettingUserId === user.id}
                  onClick={() => resetPassword(user)}
                  className="btn btn-outline-primary fw-bold min-h-10 rounded-full px-3 py-2 disabled:opacity-60"
                >
                  {resettingUserId === user.id ? 'Resetting...' : 'Reset password'}
                </button>
                <button
                  type="button"
                  onClick={() => onDiscard(user.id)}
                  className="btn btn-light fw-bold min-h-10 rounded-full px-3 py-2 text-[#172a53]"
                >
                  {t('discardChanges')}
                </button>
                <button
                  type="button"
                  onClick={() => onSave(user.id)}
                  className="btn btn-success fw-bold min-h-10 rounded-full px-3 py-2 text-white"
                >
                  {t('saveChanges')}
                </button>
              </div>
            )}
          </div>
        )) : (
          <div className="rounded-[12px] border border-[#e5edf7] bg-[#f8fbff] p-4 text-[14px] font-semibold text-[#64799e]">
            No users found. Register a new user to start managing account access.
          </div>
        )}
      </div>
      {editingUserId && (
        <div className="border-t border-[#e5edf7] bg-white px-4 py-4 sm:flex sm:items-center sm:justify-end">
          <div className="mt-2 sm:mt-0 inline-flex gap-3">
            <button
              type="button"
              onClick={() => onDiscard(editingUserId)}
              className="btn btn-light fw-bold min-h-12 rounded-full px-4 py-2 text-[#172a53]"
            >
              {t('discardChanges')}
            </button>
            <button
              type="button"
              onClick={() => onSave(editingUserId)}
              className="btn btn-success fw-bold min-h-12 rounded-full px-4 py-2 text-white"
            >
              {t('saveChanges')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function RegistrationField({ label, value, onChange, type = 'text', placeholder = '', autoComplete = 'off' }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.1em] text-[#64799e]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="form-control h-10 w-full rounded-[10px] border border-[#c9d8eb] bg-white px-3 text-[14px] font-semibold text-[#071b49] outline-none transition placeholder:text-[#7a8aa6] focus:border-[#1768f2] focus:ring-2 focus:ring-[#b8d3ff]"
      />
    </label>
  )
}

function RoleSelect({ value, roleOptions, onChange }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="form-select h-10 w-full min-w-[150px] rounded-[10px] border border-[#c9d8eb] bg-white px-3 text-[14px] font-extrabold text-[#071b49] outline-none transition focus:border-[#1768f2] focus:ring-2 focus:ring-[#b8d3ff] lg:w-auto"
    >
      {roleOptions.map((role) => (
        <option key={role} value={role}>{role}</option>
      ))}
    </select>
  )
}

function Icon({ name, className = '' }) {
  if (name === 'spanners') {
    return (
      <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
        <g stroke="#071b49" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4">
          <path d="M12 54 40 26l-6-6 11-11 10 3-9 9 4 4 9-9 3 10-11 11-6-6-28 28Z" fill="#f8c64f" />
          <path d="M13 52h8" stroke="#fff" strokeWidth="3" />
          <path d="M24 41h11" stroke="#fff" strokeWidth="3" />
          <circle cx="12" cy="54" r="3" fill="#fff" />
          <path d="M52 54 24 26l6-6L19 9 9 12l9 9-4 4-9-9-3 10 11 11 6-6 28 28Z" fill="#38c6ec" />
          <path d="M27 26 46 45" stroke="#8aa0bf" strokeWidth="6" />
          <path d="M27 26 46 45" stroke="#071b49" strokeWidth="2" />
          <path d="M44 17c2 1 3 2 4 4" stroke="#fff" strokeWidth="3" />
          <path d="M21 43c-3 2-5 5-6 8" stroke="#fff" strokeWidth="3" />
        </g>
      </svg>
    )
  }

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
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
        <path d="M16 3.1a4 4 0 0 1 0 7.8" />
      </>
    ),
    audit: (
      <>
        <path d="M9 11h6" />
        <path d="M9 15h4" />
        <path d="M8 3h8l3 3v15H5V3h3Z" />
        <path d="M16 3v4h4" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="7" ry="3" />
        <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
        <path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
      </>
    ),
    qr: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <path d="M14 14h3v3h-3z" />
        <path d="M18 18h3v3h-3z" />
        <path d="M18 14h3" />
        <path d="M14 21h3" />
      </>
    ),
    alert: (
      <>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
  }

  return <svg {...common}>{paths[name]}</svg>
}
