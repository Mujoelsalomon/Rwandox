import React, { useEffect, useMemo, useState } from 'react'
import { PREDICTION_HISTORY_UPDATED_EVENT } from '../predictionEvents.js'
import { API_BASE_URL } from '../config/api.js'

const pageSizes = [10, 25, 50, 100]

export default function PredictionHistoryContent() {
  const [predictions, setPredictions] = useState([])
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('All')
  const [dispositionFilter, setDispositionFilter] = useState('All')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => {
    let active = true

    async function loadHistory({ showLoading = false } = {}) {
      if (showLoading) setLoading(true)
      try {
        const resp = await fetch(`${API_BASE_URL}/prediction-history`, { credentials: 'include' })
        const data = await resp.json()
        if (!active) return
        if (!resp.ok) throw new Error(data.error || 'Could not load prediction history.')
        setPredictions(data.predictions || [])
        setStatus('')
      } catch (error) {
        console.error(error)
        if (active) {
          setPredictions([])
          setStatus('Could not load prediction history from the backend.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadHistory()
    function handlePredictionHistoryUpdated() {
      loadHistory({ showLoading: true })
      setPage(1)
    }

    window.addEventListener(PREDICTION_HISTORY_UPDATED_EVENT, handlePredictionHistoryUpdated)
    return () => {
      active = false
      window.removeEventListener(PREDICTION_HISTORY_UPDATED_EVENT, handlePredictionHistoryUpdated)
    }
  }, [])

  const filteredPredictions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return predictions.filter((prediction) => {
      const matchesSearch = !normalizedSearch
        || prediction.patient_id?.toLowerCase().includes(normalizedSearch)
        || prediction.surgery_type?.toLowerCase().includes(normalizedSearch)
        || prediction.model_version?.toLowerCase().includes(normalizedSearch)
      const matchesRisk = riskFilter === 'All' || prediction.risk_level === riskFilter
      const matchesDisposition = dispositionFilter === 'All' || prediction.patient_disposition === dispositionFilter

      return matchesSearch && matchesRisk && matchesDisposition
    })
  }, [dispositionFilter, predictions, riskFilter, search])

  const summary = useMemo(() => {
    const total = predictions.length
    const high = predictions.filter((prediction) => prediction.risk_level === 'High').length
    const average = total
      ? Math.round(predictions.reduce((sum, prediction) => sum + Number(prediction.predicted_probability || 0), 0) / total)
      : 0
    const latest = predictions[0]?.generated_at

    return { total, high, average, latest }
  }, [predictions])

  const totalPages = Math.max(1, Math.ceil(filteredPredictions.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const visiblePredictions = filteredPredictions.slice(startIndex, startIndex + pageSize)

  function updateFilter(setter, value) {
    setter(value)
    setPage(1)
  }

  function downloadHistory() {
    const rows = filteredPredictions.map((prediction) => ({
      generated: formatDate(prediction.generated_at),
      patient_id: prediction.patient_id || '',
      age: prediction.age || '',
      sex: prediction.sex || '',
      surgery_type: prediction.surgery_type || '',
      patient_disposition: prediction.patient_disposition || '',
      risk_level: prediction.risk_level || '',
      probability: `${Math.round(Number(prediction.predicted_probability || 0))}%`,
      model_version: prediction.model_version || '',
      clinical_note: clinicalNote(prediction),
    }))

    const csv = toCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `prediction-history-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setExportOpen(false)
  }

  function shareByEmail() {
    const subject = 'Postoperative oxygen prediction history'
    const body = [
      `Prediction history export`,
      `Total records: ${filteredPredictions.length}`,
      `High-risk cases: ${filteredPredictions.filter((prediction) => prediction.risk_level === 'High').length}`,
      '',
      'Open the system to review or download the full filtered history.',
    ].join('\n')

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    setExportOpen(false)
  }

  return (
    <div className="container-fluid px-0">
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-4">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-xl">
              <div className="text-primary fw-bold text-uppercase small mb-2" style={{ letterSpacing: '0.14em' }}>
                Prediction History
              </div>
              <h1 className="fw-black mb-2" style={{ color: '#071b49', fontSize: 35, fontWeight: 900, lineHeight: 1.15 }}>
                Oxygen risk prediction log
              </h1>
              <p className="mb-0 text-secondary fs-6">
                Review generated predictions, patient disposition, model version, and clinical follow-up notes.
              </p>
            </div>
            <div className="col-12 col-xl-auto position-relative">
              <button
                className="btn btn-dark rounded-pill fw-bold px-4 py-2 w-100 w-xl-auto"
                type="button"
                onClick={() => setExportOpen((open) => !open)}
                aria-expanded={exportOpen}
              >
                Export history
              </button>
              {exportOpen && (
                <div
                  className="position-absolute end-0 mt-2 rounded-4 bg-white shadow border p-2"
                  style={{ zIndex: 20, minWidth: 240 }}
                >
                  <button
                    className="btn btn-success rounded-4 fw-bold w-100 mb-2 py-2"
                    type="button"
                    onClick={downloadHistory}
                  >
                    Download CSV
                  </button>
                  <button
                    className="btn btn-warning rounded-4 fw-bold w-100 py-2"
                    type="button"
                    onClick={shareByEmail}
                  >
                    Share by email
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <SummaryCard label="Total predictions" value={summary.total} accent="#1265dc" />
        <SummaryCard label="High-risk cases" value={summary.high} accent="#ef4444" />
        <SummaryCard label="Average probability" value={`${summary.average}%`} accent="#facc15" />
        <SummaryCard label="Latest generated" value={summary.latest ? formatDate(summary.latest, true) : 'None'} accent="#22c55e" />
      </div>

      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-4">
          <div className="row g-3">
            <div className="col-12 col-xl-5">
              <label className="form-label fw-bold text-secondary">Search</label>
              <input
                className="form-control form-control-lg rounded-4"
                placeholder="Search by patient ID, surgery, model"
                value={search}
                onChange={(event) => updateFilter(setSearch, event.target.value)}
              />
            </div>
            <div className="col-12 col-md-4 col-xl">
              <FilterSelect label="Risk" value={riskFilter} onChange={(value) => updateFilter(setRiskFilter, value)} options={['All', 'High', 'Moderate', 'Low']} />
            </div>
            <div className="col-12 col-md-4 col-xl">
              <FilterSelect label="Disposition" value={dispositionFilter} onChange={(value) => updateFilter(setDispositionFilter, value)} options={['All', 'OPD', 'Ward', 'HDU', 'ICU']} />
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

      {status && (
        <div className="alert alert-warning rounded-4 fw-semibold" role="alert">
          {status}
        </div>
      )}

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr className="text-uppercase small text-secondary">
                <th className="px-4 py-3">Generated</th>
                <th className="px-4 py-3">Patient ID</th>
                <th className="px-4 py-3">Surgery</th>
                <th className="px-4 py-3">Disposition</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Probability</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Clinical note</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-secondary fw-semibold" colSpan="8">Loading prediction history...</td>
                </tr>
              ) : visiblePredictions.length > 0 ? (
                visiblePredictions.map((prediction) => (
                  <tr key={prediction.id}>
                    <td className="px-4 py-3 fw-semibold text-nowrap">{formatDate(prediction.generated_at)}</td>
                    <td className="px-4 py-3 fw-bold" style={{ color: '#071b49' }}>{prediction.patient_id}</td>
                    <td className="px-4 py-3">{prediction.surgery_type || 'Not recorded'}</td>
                    <td className="px-4 py-3">{prediction.patient_disposition || 'Not recorded'}</td>
                    <td className="px-4 py-3"><RiskBadge risk={prediction.risk_level} /></td>
                    <td className="px-4 py-3 fw-bold" style={{ color: '#071b49' }}>{Math.round(Number(prediction.predicted_probability || 0))}%</td>
                    <td className="px-4 py-3">{prediction.model_version || 'v1.0'}</td>
                    <td className="px-4 py-3 text-secondary">
                      {clinicalNote(prediction)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-4 text-secondary fw-semibold" colSpan="8">No prediction history found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card-footer bg-white border-top">
          <div className="row g-3 align-items-center">
            <div className="col-12 col-md">
              <span className="text-secondary fw-semibold">
                Showing {filteredPredictions.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + pageSize, filteredPredictions.length)} of {filteredPredictions.length}
              </span>
            </div>
            <div className="col-12 col-md-auto">
              <nav aria-label="Prediction history pagination">
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

function SummaryCard({ label, value, accent }) {
  return (
    <div className="col-12 col-sm-6 col-xl-3">
      <div className="card border-0 shadow-sm rounded-4 h-100">
        <div className="card-body p-3">
          <div className="d-flex align-items-center gap-3">
            <span className="rounded-circle d-inline-block" style={{ width: 12, height: 12, backgroundColor: accent }} />
            <div>
              <div className="text-secondary fw-bold small">{label}</div>
              <div className="fw-black fs-3" style={{ color: '#071b49', fontWeight: 900 }}>{value}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
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
      : 'text-bg-success'

  return (
    <span className={`badge rounded-pill px-3 py-2 ${cls}`}>
      {risk || 'Unknown'}
    </span>
  )
}

function formatDate(value, compact = false) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: compact ? undefined : 'numeric',
    hour: compact ? undefined : '2-digit',
    minute: compact ? undefined : '2-digit',
  })
}

function clinicalNote(prediction) {
  const recommendation = prediction.recommendations?.[0]
  const factor = prediction.contributing_factors?.[0]
  if (recommendation && factor) return `${recommendation} - key factor: ${factor}`
  return recommendation || factor || 'No recommendation recorded'
}

function toCsv(rows) {
  if (!rows.length) return 'generated,patient_id,age,sex,surgery_type,patient_disposition,risk_level,probability,model_version,clinical_note\n'
  const headers = Object.keys(rows[0])
  const lines = rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))
  return `${headers.join(',')}\n${lines.join('\n')}\n`
}

function csvCell(value) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}
