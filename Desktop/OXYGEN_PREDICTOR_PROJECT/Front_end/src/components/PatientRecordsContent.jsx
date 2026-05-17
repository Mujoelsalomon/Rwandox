import React, { useEffect, useMemo, useState } from 'react'

import { API_URL } from '../authSession.js'

const pageSizes = [10, 25, 50, 100]

export default function PatientRecordsContent() {
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('All')
  const [wardFilter, setWardFilter] = useState('All')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  useEffect(() => {
    let active = true

    async function loadPatients() {
      try {
        const resp = await fetch(`${API_URL}/patients`, { credentials: 'include' })
        const data = await resp.json()
        if (!active) return
        if (!resp.ok) throw new Error(data.error || 'Could not load patient records.')
        setPatients(Array.isArray(data.patients) ? data.patients.map(normalizePatient) : [])
        setStatus('')
      } catch (error) {
        console.error(error)
        if (active) {
          setPatients([])
          setStatus('Could not load patient records from the backend.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadPatients()
    return () => {
      active = false
    }
  }, [])

  const filteredPatients = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return patients.filter((patient) => {
      const matchesSearch = !normalizedSearch
        || patient.id.toLowerCase().includes(normalizedSearch)
        || patient.name.toLowerCase().includes(normalizedSearch)
        || patient.surgeryType.toLowerCase().includes(normalizedSearch)
      const matchesRisk = riskFilter === 'All' || patient.risk === riskFilter
      const matchesWard = wardFilter === 'All' || patient.ward === wardFilter

      return matchesSearch && matchesRisk && matchesWard
    })
  }, [riskFilter, search, wardFilter])

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const visiblePatients = filteredPatients.slice(startIndex, startIndex + pageSize)

  function updateFilter(setter, value) {
    setter(value)
    setPage(1)
  }

  return (
    <div className="container-fluid px-0">
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-4">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-xl">
              <div className="text-primary fw-bold text-uppercase small mb-2" style={{ letterSpacing: '0.14em' }}>
                Patient Records
              </div>
              <h1 className="fw-black mb-2" style={{ color: '#071b49', fontSize: 35, fontWeight: 900, lineHeight: 1.15 }}>
                Surgical patient registry
              </h1>
              <p className="mb-0 text-secondary fs-6">
                Search, filter, and review postoperative oxygen risk assessments.
              </p>
            </div>
            <div className="col-12 col-xl-auto">
              <button className="btn btn-dark rounded-pill fw-bold px-4 py-2">
                Export records
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-4">
          <div className="row g-3">
            <div className="col-12 col-xl-5">
              <label className="form-label fw-bold text-secondary">Search</label>
              <input
                className="form-control form-control-lg rounded-4"
                placeholder="Search by ID, name, surgery"
                value={search}
                onChange={(event) => updateFilter(setSearch, event.target.value)}
              />
            </div>
            <div className="col-12 col-md-4 col-xl">
              <FilterSelect label="Risk" value={riskFilter} onChange={(value) => updateFilter(setRiskFilter, value)} options={['All', 'High', 'Moderate', 'Low']} />
            </div>
            <div className="col-12 col-md-4 col-xl">
              <FilterSelect label="Ward" value={wardFilter} onChange={(value) => updateFilter(setWardFilter, value)} options={['All', 'PACU', 'Surgical Ward', 'Recovery', 'ICU']} />
            </div>
            <div className="col-12 col-md-4 col-xl">
              <FilterSelect label="Table size" value={String(pageSize)} onChange={(value) => {
                setPageSize(Number(value))
                setPage(1)
              }} options={pageSizes.map(String)} />
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        {status && (
          <div className="alert alert-warning rounded-0 fw-semibold mb-0" role="alert">
            {status}
          </div>
        )}
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr className="text-uppercase small text-secondary">
                <th className="px-4 py-3">Patient ID</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3">Sex</th>
                <th className="px-4 py-3">Ward</th>
                <th className="px-4 py-3">Surgery</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Probability</th>
                <th className="px-4 py-3">Last assessment</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-secondary fw-semibold" colSpan="9">Loading patient records...</td>
                </tr>
              ) : visiblePatients.length > 0 ? (
                visiblePatients.map((patient) => (
                  <tr key={patient.id}>
                    <td className="px-4 py-3 fw-bold" style={{ color: '#071b49' }}>{patient.id}</td>
                    <td className="px-4 py-3 fw-semibold">{patient.name}</td>
                    <td className="px-4 py-3">{patient.age}</td>
                    <td className="px-4 py-3">{patient.sex}</td>
                    <td className="px-4 py-3">{patient.ward}</td>
                    <td className="px-4 py-3">{patient.surgeryType}</td>
                    <td className="px-4 py-3"><RiskBadge risk={patient.risk} /></td>
                    <td className="px-4 py-3 fw-bold" style={{ color: '#071b49' }}>{patient.probability}%</td>
                    <td className="px-4 py-3">{patient.lastAssessment}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-4 text-secondary fw-semibold" colSpan="9">No patient records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card-footer bg-white border-top">
          <div className="row g-3 align-items-center">
            <div className="col-12 col-md">
              <span className="text-secondary fw-semibold">
                Showing {filteredPatients.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + pageSize, filteredPatients.length)} of {filteredPatients.length}
              </span>
            </div>
            <div className="col-12 col-md-auto">
              <nav aria-label="Patient records pagination">
                <ul className="pagination mb-0">
                  <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button className="page-link rounded-start-pill" onClick={() => setPage((value) => Math.max(1, value - 1))}>
                      Previous
                    </button>
                  </li>
                  <li className="page-item active">
                    <span className="page-link">
                      {currentPage} / {totalPages}
                    </span>
                  </li>
                  <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <button className="page-link rounded-end-pill" onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                      Next
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function normalizePatient(patient) {
  return {
    id: patient.hospital_id || String(patient.id || ''),
    name: patient.name || `Patient ${patient.hospital_id || patient.id || ''}`,
    age: patient.age || '',
    sex: patient.sex || '',
    ward: patient.ward || patient.latest_record?.ward || 'Not recorded',
    surgeryType: patient.surgery_type || patient.latest_record?.surgery_type || 'Not recorded',
    probability: Math.round(Number(patient.predicted_probability || 0)),
    risk: patient.risk_level || 'Not assessed',
    lastAssessment: formatDate(patient.last_assessment),
  }
}

function formatDate(value) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <>
      <label className="form-label fw-bold text-secondary">{label}</label>
      <select
        className="form-select form-select-lg rounded-4"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </>
  )
}

function RiskBadge({ risk }) {
  const cls = risk === 'High'
    ? 'text-bg-danger'
    : risk === 'Moderate'
      ? 'text-bg-warning'
      : risk === 'Low'
        ? 'text-bg-success'
        : 'text-bg-secondary'

  return (
    <span className={`badge rounded-pill px-3 py-2 ${cls}`}>
      {risk}
    </span>
  )
}
